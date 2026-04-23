/**
 * RDDI 2024 - Complete image extraction + question mapping
 * 
 * Mapping: Q# = page# - 2  (page 3 = Q1)
 * 
 * Uses the operator list to determine which page each extracted image belongs to.
 * Then assigns images to questions based on page number.
 * 
 * For RDDI 2024: only questions with "observe" or image references get images.
 * Most questions DON'T have images (only specific clinical case questions do).
 */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const { PDFDocument } = require('pdf-lib')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const PDF = path.join(CBR_BASE, 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')

// ============================================================
// Image extraction (byte scan + zlib)
// ============================================================
function byteIndexOf(buf, needle, start = 0) {
  for (let i = start; i <= buf.length - needle.length; i++) {
    let found = true
    for (let j = 0; j < needle.length; j++) {
      if (buf[i+j] !== needle[j]) { found = false; break }
    }
    if (found) return i
  }
  return -1
}

function findImageStreams(buffer) {
  const results = []
  const key = Buffer.from('/Subtype/Image')
  let pos = 0

  while ((pos = byteIndexOf(buffer, key, pos)) !== -1) {
    const sliceStart = Math.max(0, pos - 400)
    const dictSlice = buffer.slice(sliceStart, pos + 100)
    const latin1 = dictSlice.toString('latin1')

    const wMatch = latin1.match(/Width[\s\/]+(\d+)/)
    const hMatch = latin1.match(/Height[\s\/]+(\d+)/)
    const fMatch = latin1.match(/\/Filter\/(\w+)/)
    const lMatch = latin1.match(/Length[\s\/]+(\d+)/)

    const width = wMatch ? parseInt(wMatch[1]) : 0
    const height = hMatch ? parseInt(hMatch[1]) : 0
    const filterKey = fMatch ? '/' + fMatch[1] : null
    const length = lMatch ? parseInt(lMatch[1]) : 0

    const relStreamPos = byteIndexOf(buffer, Buffer.from('stream'), pos)
    if (relStreamPos === -1) { pos += key.length; continue }

    let streamDataStart = relStreamPos + 6
    while (streamDataStart < buffer.length && (buffer[streamDataStart] === 10 || buffer[streamDataStart] === 13 || buffer[streamDataStart] === 32)) streamDataStart++

    const endstreamMarker = Buffer.from('endstream')
    let streamDataEnd = byteIndexOf(buffer, endstreamMarker, streamDataStart + 1)
    if (streamDataEnd === -1) { pos += key.length; continue }

    if (width > 0 && height > 0) {
      results.push({ streamOffset: streamDataStart, streamEnd: streamDataEnd, width, height, filter: filterKey, length })
    }
    pos += key.length
  }
  return results
}

function extractImageData(buffer, stream) {
  const { streamOffset, streamEnd, filter } = stream
  if (!streamOffset || !streamEnd || streamOffset >= streamEnd) return null
  const rawBytes = buffer.slice(streamOffset, streamEnd)

  if (filter === '/DCTDecode') {
    if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) return { data: rawBytes, format: 'jpeg' }
  } else if (filter === '/FlateDecode') {
    try {
      const dec = zlib.inflateSync(rawBytes)
      return { data: dec, format: 'raw' }
    } catch {}
    try {
      const dec = zlib.inflateRawSync(rawBytes)
      return { data: dec, format: 'raw' }
    } catch {}
  }
  return null
}

function rawToJpeg(data, width, height) {
  return new Promise((resolve) => {
    try {
      const { createCanvas } = require('canvas')
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')
      const imgData = ctx.createImageData(width, height)
      for (let i = 0; i < width * height; i++) {
        const g = data[i] || 0
        imgData.data[i*4] = g; imgData.data[i*4+1] = g; imgData.data[i*4+2] = g; imgData.data[i*4+3] = 255
      }
      ctx.putImageData(imgData, 0, 0)
      resolve(canvas.toBuffer('image/jpeg', { quality: 85 }))
    } catch (e) { resolve(null) }
  })
}

// ============================================================
// Get operator list (pdfjs)
// ============================================================
async function getOperatorList(doc) {
  const pageImages = {}
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const ops = await page.getOperatorList()
    const imgs = []
    for (let j = 0; j < ops.fnArray.length; j++) {
      if (ops.fnArray[j] === 85 || ops.fnArray[j] === 86) {
        const args = ops.argsArray[j]
        if (args && args.length >= 3) {
          imgs.push({ w: args[1], h: args[2] })
        }
      }
    }
    if (imgs.length > 0) pageImages[i] = imgs
  }
  return pageImages
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('Loading PDF...')
  const buffer = fs.readFileSync(PDF)
  const pdfDoc = await PDFDocument.load(buffer)
  console.log('Pages:', pdfDoc.getPages().length)

  console.log('\nExtracting images from PDF byte scan...')
  const streams = findImageStreams(buffer)
  console.log('Found', streams.length, 'image streams')

  const images = []
  for (const s of streams) {
    if (s.width === 0 || s.height === 0) continue
    const imgData = extractImageData(buffer, s)
    if (!imgData) continue

    let base64
    if (imgData.format === 'jpeg') {
      base64 = Buffer.from(imgData.data).toString('base64')
    } else {
      const jpegBuf = await rawToJpeg(imgData.data, s.width, s.height)
      if (!jpegBuf) continue
      base64 = jpegBuf.toString('base64')
    }

    if (base64 && base64.length > 5000) {
      images.push({ streamOffset: s.streamOffset, width: s.width, height: s.height, filter: s.filter, base64, size: base64.length })
    }
  }
  images.sort((a, b) => a.streamOffset - b.streamOffset)
  // Assign extracted index after sorting
  images.forEach((img, idx) => { img.extractedIdx = idx })
  console.log('Extracted', images.length, 'usable images\n')

  console.log('Getting operator list...')
  const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalEnabled: false }).promise
  const pageImages = await getOperatorList(pdfjsDoc)

  // Assign images to pages sequentially
  // For each page with images, take the next N images from the sorted list
  // Match by: extracted images sorted by offset, assign to pages in PDF order
  
  // Build: page → [{extractedImgIndex, w, h}]
  let extractedIdx = 0
  const pageToImages = {}
  
  for (let pageNum = 1; pageNum <= pdfDoc.getPages().length; pageNum++) {
    const pageImgList = pageImages[pageNum] || []
    if (pageImgList.length > 0) {
      const assigned = []
      for (const opImg of pageImgList) {
        if (extractedIdx < images.length) {
          // Verify dimensions match (within tolerance for small discrepancies)
          const extImg = images[extractedIdx]
          if (extImg.width === opImg.w && extImg.height === opImg.h) {
            assigned.push({ extractedIdx, ...extImg })
            extractedIdx++
          } else {
            // Dimension mismatch — skip this extracted image and try next
            console.log('  WARNING: Page', pageNum, 'expects', opImg.w + 'x' + opImg.h, 'but got', extImg.width + 'x' + extImg.height, '(idx=' + extractedIdx + ')')
            // Don't assign, try to find matching
            let found = false
            for (let lookAhead = 1; lookAhead < 10 && extractedIdx + lookAhead < images.length; lookAhead++) {
              const candidate = images[extractedIdx + lookAhead]
              if (candidate.width === opImg.w && candidate.height === opImg.h) {
                // Use this one
                assigned.push({ extractedIdx: extractedIdx + lookAhead, ...candidate })
                extractedIdx = extractedIdx + lookAhead + 1
                found = true
                break
              }
            }
            if (!found) {
              // Just use what we have
              assigned.push({ extractedIdx, ...extImg })
              extractedIdx++
            }
          }
        }
      }
      pageToImages[pageNum] = assigned
    }
  }

  // Now: Q# = page# - 2  (page 3 = Q1)
  // Build question → images map
  const questionImages = {}
  for (const [pageNum, imgs] of Object.entries(pageToImages)) {
    const qNum = parseInt(pageNum) - 2
    if (qNum >= 1 && qNum <= 60) {
      questionImages[qNum] = imgs
    }
  }

  console.log('\nQuestions with images:')
  const qWithImg = Object.keys(questionImages).map(Number).filter(q => questionImages[q].length > 0).sort((a, b) => a - b)
  console.log('  Total:', qWithImg.length, 'questions with images')
  for (const q of qWithImg) {
    const imgs = questionImages[q]
    console.log('  Q' + q + ': ' + imgs.length + ' image(s) - ' + imgs.map(i => i.width + 'x' + i.height + '(' + Math.round(i.size/1024) + 'KB)').join(', '))
  }

  // Save as JSON for use in next step
  const output = {
    extracted_count: images.length,
    question_images: questionImages,
    total_questions_with_images: qWithImg.length
  }
  
  // Also print the image indices for Q49-Q59 to compare with v2 JSON
  console.log('\nQ49-Q59 image indices:')
  for (let q = 49; q <= 59; q++) {
    const imgs = questionImages[q] || []
    console.log('  Q' + q + ': ' + imgs.map(i => 'idx=' + i.extractedIdx + ' ' + i.width + 'x' + i.height + ' ' + Math.round(i.size/1024) + 'KB').join(', ') || 'NO IMAGE')
  }

  // Save questionImages as JSON file for next step
  fs.writeFileSync(OUT + '/rddi2024_question_images.json', JSON.stringify(questionImages, null, 2))
  console.log('\nSaved mapping to rddi2024_question_images.json')
  console.log('\nDone!')
}

main().catch(console.error)
