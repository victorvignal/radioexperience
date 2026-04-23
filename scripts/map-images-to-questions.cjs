/**
 * Map extracted JPEG images to questions for RDDI 2024
 * 
 * Approach:
 * 1. Load all 114 extracted images (from extract-images-v3.cjs output)
 * 2. Get full operator list with page→dimensions mapping
 * 3. Map each extracted image to a page via dimensions
 * 4. Map pages to questions (page ~ question# + offset)
 * 5. Verify using v2 JSON (Q49-Q59 known correct images)
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const PDF = path.join(CBR_BASE, 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')

// ============================================================
// Step 1: Extract all images with offsets (from PDF byte scan)
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

// ============================================================
// Step 2: Get full operator list from pdfjs
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
          imgs.push({
            name: args[0].toString(),
            width: typeof args[1] === 'number' ? args[1] : parseInt(args[1]),
            height: typeof args[2] === 'number' ? args[2] : parseInt(args[2])
          })
        }
      }
    }
    if (imgs.length > 0) pageImages[i] = imgs
  }
  return pageImages
}

// ============================================================
// Step 3: Build page→question mapping
// ============================================================
// RDDI 2024: Cover page = 1, Instructions ~2, Q1 starts at page ~2 or ~3
// Each question is roughly 1 page
function buildPageToQuestionMap(numPages, totalQuestions) {
  const map = {}
  // Find Q1 page by looking at text content
  return map
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('Loading PDF...')
  const buffer = fs.readFileSync(PDF)
  const pdfDoc = await PDFDocument.load(buffer)

  console.log('Extracting images...')
  const streams = findImageStreams(buffer)
  console.log('Found ' + streams.length + ' image streams\n')

  const images = []
  for (const s of streams) {
    if (s.width === 0 || s.height === 0) continue
    const imgData = extractImageData(buffer, s)
    if (!imgData) continue

    let base64
    if (imgData.format === 'jpeg') {
      base64 = Buffer.from(imgData.data).toString('base64')
    } else {
      // FlateDecode — try canvas
      try {
        const { createCanvas } = require('canvas')
        const canvas = createCanvas(s.width, s.height)
        const ctx = canvas.getContext('2d')
        const imgDataObj = ctx.createImageData(s.width, s.height)
        for (let i = 0; i < s.width * s.height; i++) {
          const g = imgData.data[i] || 0
          imgDataObj.data[i*4] = g; imgDataObj.data[i*4+1] = g; imgDataObj.data[i*4+2] = g; imgDataObj.data[i*4+3] = 255
        }
        ctx.putImageData(imgDataObj, 0, 0)
        base64 = canvas.toBuffer('image/jpeg', { quality: 85 }).toString('base64')
      } catch (e) { continue }
    }

    if (base64 && base64.length > 5000) {
      images.push({ offset: s.streamOffset, width: s.width, height: s.height, filter: s.filter, base64, size: base64.length })
    }
  }

  images.sort((a, b) => a.offset - b.offset)
  console.log('Extracted ' + images.length + ' usable images\n')

  console.log('Getting operator list...')
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
  const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalEnabled: false }).promise
  const pageImages = await getOperatorList(pdfjsDoc)
  console.log('Pages with images: ' + Object.keys(pageImages).length + '\n')

  // Build dimensions→page map
  const dimsToPage = new Map()
  for (const [pageNum, imgs] of Object.entries(pageImages)) {
    for (const img of imgs) {
      const key = img.width + 'x' + img.height
      if (!dimsToPage.has(key)) dimsToPage.set(key, [])
      dimsToPage.get(key).push(parseInt(pageNum))
    }
  }

  // For each extracted image, find which page it belongs to
  const pageAssigned = {}
  for (const img of images) {
    const key = img.width + 'x' + img.height
    const pages = dimsToPage.get(key) || []
    img.pages = pages // pages that have an image of this exact size
  }

  // Count images per page
  const pageImageCount = {}
  for (const [pageNum, imgs] of Object.entries(pageImages)) {
    pageImageCount[pageNum] = imgs.length
  }

  console.log('Images per page (from operator list):')
  for (const [pg, cnt] of Object.entries(pageImageCount)) {
    if (cnt > 0) console.log('  Page ' + pg + ': ' + cnt + ' images')
  }

  // Save for analysis
  console.log('\nExtracted image dimensions and their page matches:')
  images.forEach((img, i) => {
    console.log('  [' + i + '] ' + img.width + 'x' + img.height + ' page=' + (img.pages ? img.pages.join(',') : '?') + ' filter=' + img.filter + ' size=' + Math.round(img.size/1024) + 'KB')
  })

  // Load v2 JSON to compare
  const v2Path = path.join(OUT, 'cbr_rddi_2024_with_images_v2.json')
  if (fs.existsSync(v2Path)) {
    const v2 = JSON.parse(fs.readFileSync(v2Path, 'utf8'))
    console.log('\nv2 JSON Q49-Q59 image sizes:')
    for (const q of v2.questions.filter(q => q.number >= 49 && q.number <= 60 && q.image_base64)) {
      console.log('  Q' + q.number + ': ' + q.image_base64.length + 'b (' + Math.round(q.image_base64.length/1024) + 'KB)')
    }
  }
}

main().catch(console.error)
