/**
 * Hybrid image extractor for CBR PDFs
 * Combines: raw byte scan + pdfjs operator list + pdf-lib XObject lookup
 * 
 * Strategy:
 * 1. Use pdfjs getOperatorList() to find image names per page
 * 2. Use pdf-lib to look up those images by name in the PDF's XObject table
 * 3. For PDFs where XObject lookup fails (RDDI 2024), fall back to raw byte scan
 *    and map by comparing image dimensions
 */
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import zlib from 'zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

// ============================================================
// 1. Raw byte scan for all JPEGs in a PDF
// ============================================================
function scanRawJPEGs(buffer) {
  const jpegs = []
  let i = 0
  while (i < buffer.length - 1) {
    if (buffer[i] === 0xFF && buffer[i+1] === 0xD8) {
      let end = i + 2
      while (end < buffer.length - 1) {
        if (buffer[end] === 0xFF && buffer[end+1] === 0xD9) { end += 2; break }
        end++
      }
      if (end - i > 5000) {
        jpegs.push({ offset: i, length: end - i, data: buffer.slice(i, end) })
      }
      i = end
    } else {
      i++
    }
  }
  return jpeGs // sort by offset ascending
}

// ============================================================
// 2. Get operator list with image names per page
// ============================================================
async function getOperatorList(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false }).promise
  const pageImages = {} // pageNum -> [{name, width, height}]

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const ops = await page.getOperatorList()
    const imgs = []
    for (let j = 0; j < ops.fnArray.length; j++) {
      const fn = ops.fnArray[j]
      // fn 85 = paintJpegXObject, fn 86 = paintImageXObject
      if (fn === 85 || fn === 86) {
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
  return { doc, pageImages }
}

// ============================================================
// 3. pdf-lib XObject lookup by image name
// ============================================================
async function extractXObjectImages(pdfDoc, pageImages) {
  const results = {} // pageNum -> [{name, width, height, base64}]

  for (const [pageNumStr, imgs] of Object.entries(pageImages)) {
    const pageNum = parseInt(pageNumStr)
    const pageIdx = pageNum - 1
    const page = pdfDoc.getPages()[pageIdx]
    if (!page) continue

    const pageResults = []

    // Get resources
    let resources = null
    try { resources = page.node.get(PDFName.of('Resources')) } catch {}
    if (!resources) try { resources = page.node.lookup(PDFName.of('Resources')) } catch {}
    if (!resources || !(resources instanceof PDFDict)) continue

    // Get XObject
    let xObject = null
    try { xObject = resources.get(PDFName.of('XObject')) } catch {}
    if (!xObject) try { xObject = resources.lookup(PDFName.of('XObject')) } catch {}
    if (!xObject || !(xObject instanceof PDFDict)) continue

    for (const imgInfo of imgs) {
      // Find XObject with this name
      let found = false
      for (const [name, ref] of xObject.entries()) {
        if (name.toString() === imgInfo.name) {
          const stream = pdfDoc.context.lookup(ref)
          if (!stream) continue
          const dict = stream.dict || stream

          // Get subtype
          let subtype = null
          try { subtype = dict.get(PDFName.of('Subtype')) } catch {}
          if (!subtype) try { subtype = dict.lookup(PDFName.of('Subtype')) } catch {}
          if (!subtype || subtype.toString() !== '/Image') continue

          // Get filter
          let filter = null
          try { filter = dict.get(PDFName.of('Filter')) } catch {}
          if (!filter) try { filter = dict.lookup(PDFName.of('Filter')) } catch {}

          // Get raw bytes
          let rawBytes = null
          try {
            if (typeof stream.getContents === 'function') {
              const c = stream.getContents()
              rawBytes = Buffer.isBuffer(c) || c instanceof Uint8Array ? c : Buffer.from(c)
            } else if (stream.asUint8Array) {
              rawBytes = stream.asUint8Array()
            }
          } catch {}

          if (!rawBytes || rawBytes.length < 100) continue

          // JPEG?
          if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
            pageResults.push({ ...imgInfo, base64: Buffer.from(rawBytes).toString('base64'), method: 'xobj' })
            found = true
          }
          // Deflate->JPEG
          else if (rawBytes[0] === 0x78) {
            try {
              const dec = zlib.inflateSync(Buffer.from(rawBytes))
              if (dec[0] === 0xFF && dec[1] === 0xD8) {
                pageResults.push({ ...imgInfo, base64: Buffer.from(dec).toString('base64'), method: 'deflate' })
                found = true
              }
            } catch {}
          }
        }
      }

      // XObject not found — will need raw byte fallback
      if (!found) {
        // Mark as needing raw byte extraction
        pageResults.push({ ...imgInfo, base64: null, method: 'needs_raw', offsetHint: null })
      }
    }

    if (pageResults.length > 0) results[pageNum] = pageResults
  }

  return results
}

// ============================================================
// 4. Extract JPEG dimensions from raw bytes (without full decode)
// ============================================================
function getJpegDimensions(jpegData) {
  // JPEG structure: SOI (FF D8) ... SOF0 (FF C0) ... FF D9 (EOI)
  // SOF0: FF C0 + length(2) + precision(1) + height(2) + width(2)
  for (let i = 2; i < jpegData.length - 8; i++) {
    if (jpegData[i] === 0xFF && jpegData[i+1] === 0xC0) {
      const height = (jpegData[i+5] << 8) | jpegData[i+6]
      const width = (jpegData[i+7] << 8) | jpegData[i+8]
      return { width, height }
    }
  }
  return { width: 0, height: 0 }
}

// ============================================================
// 5. Raw byte fallback: match by dimensions
// ============================================================
async function extractRawFallback(pageImages, pdfBuffer) {
  const jpegs = scanRawJPEGs(pdfBuffer)
  console.log(`  Raw byte scan: ${jpegs.length} JPEGs found`)

  // Index by dimensions
  const byDim = new Map()
  for (const j of jpegs) {
    const { width, height } = getJpegDimensions(j.data)
    const key = `${width}x${height}`
    if (!byDim.has(key)) byDim.set(key, [])
    byDim.get(key).push(j)
  }

  // For each page that needs raw extraction, try to match by dimensions
  const results = {}
  for (const [pageNumStr, imgs] of Object.entries(pageImages)) {
    const pageResults = []
    for (const img of imgs) {
      if (img.base64) {
        pageResults.push(img)
        continue
      }
      // Try to find by dimensions
      const key = `${img.width}x${img.height}`
      const candidates = byDim.get(key) || []
      if (candidates.length > 0) {
        // Pick the first unused candidate
        const picked = candidates[0]
        byDim.delete(key) // remove to avoid reuse
        pageResults.push({ ...img, base64: Buffer.from(picked.data).toString('base64'), method: 'raw' })
      } else {
        pageResults.push({ ...img, base64: null, method: 'not_found' })
      }
    }
    if (pageResults.length > 0) results[parseInt(pageNumStr)] = pageResults
  }
  return results
}

// ============================================================
// 6. Get raw JPEG offset in PDF file (for mapping to operator list names)
// ============================================================
function getRawJpegOffsets(buffer) {
  const jpegs = []
  let i = 0
  while (i < buffer.length - 1) {
    if (buffer[i] === 0xFF && buffer[i+1] === 0xD8) {
      let end = i + 2
      while (end < buffer.length - 1) {
        if (buffer[end] === 0xFF && buffer[end+1] === 0xD9) { end += 2; break }
        end++
      }
      const len = end - i
      if (len > 5000) {
        const data = buffer.slice(i, end)
        const { width, height } = getJpegDimensions(data)
        jpegs.push({ offset: i, length: len, width, height, data })
      }
      i = end
    } else {
      i++
    }
  }
  return jpegs.sort((a, b) => a.offset - b.offset)
}

// ============================================================
// MAIN
// ============================================================
async function extractImagesForPDF(pdfPath) {
  const filename = pdfPath.split(path.sep).pop()
  console.log(`\n=== Extracting images from ${filename} ===`)

  const buffer = fs.readFileSync(pdfPath)
  console.log(`  PDF size: ${(buffer.length/1024/1024).toFixed(1)} MB`)

  // Step 1: Get operator list (which pages have which images by name+size)
  const { doc, pageImages } = await getOperatorList(pdfPath)
  const totalPagesWithImages = Object.keys(pageImages).length
  const totalImages = Object.values(pageImages).reduce((s, imgs) => s + imgs.length, 0)
  console.log(`  Operator list: ${totalImages} images on ${totalPagesWithImages} pages`)

  // Step 2: Try pdf-lib XObject lookup
  const pdfDoc = await PDFDocument.load(buffer)
  let xobjResults = await extractXObjectImages(pdfDoc, pageImages)
  const xobjFound = Object.values(xobjResults).flat().filter(r => r.base64).length
  const xobjMiss = Object.values(xobjResults).flat().filter(r => !r.base64).length
  console.log(`  XObject lookup: ${xobjFound} found, ${xobjMiss} missing`)

  // Step 3: Raw byte fallback for missing images
  if (xobjMiss > 0) {
    console.log(`  Attempting raw byte fallback for ${xobjMiss} images...`)
    const rawResults = await extractRawFallback(xobjResults, buffer)
    // Merge: use xobj where available, raw for missing
    for (const [pageNum, rawImgs] of Object.entries(rawResults)) {
      if (!xobjResults[pageNum]) xobjResults[pageNum] = []
      for (const rawImg of rawImgs) {
        const existing = xobjResults[pageNum].find(r => r.name === rawImg.name)
        if (existing && !existing.base64 && rawImg.base64) {
          existing.base64 = rawImg.base64
          existing.method = 'raw'
        } else if (!existing) {
          xobjResults[pageNum].push(rawImg)
        }
      }
    }
  }

  // Summary
  let totalBase64 = 0, totalNull = 0
  for (const [pg, imgs] of Object.entries(xobjResults)) {
    for (const img of imgs) {
      if (img.base64) totalBase64++
      else totalNull++
    }
  }
  console.log(`  FINAL: ${totalBase64} images extracted, ${totalNull} failed`)

  // Return: pageNum -> images[]
  return { pageImages: xobjResults, doc }
}

// ============================================================
// TEST on key files
// ============================================================
async function main() {
  const tests = [
    [path.join(CBR_BASE, 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'), 'RDDI 2024'],
    [path.join(CBR_BASE, 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf'), 'RDDI 2025'],
    [path.join(CBR_BASE, 'USG/2023/Prova-Teorica-TP-v1-2023.pdf'), 'USG 2023 V1'],
  ]

  for (const [pdfPath, label] of tests) {
    await extractImagesForPDF(pdfPath)
  }
}

main().catch(console.error)
