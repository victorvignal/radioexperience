/**
 * RDDI 2025 full image extraction + Q# mapping
 * PDF has 66 pages: page 3 = Q1, page 4 = Q2, ..., page 62 = Q60
 * Remaining pages (63-66) = gabarito/cover
 */
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')

const PDF_PATH = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf'
const OUT = path.join(__dirname, 'cbr_output')

async function main() {
  console.log('Loading RDDI 2025 PDF...')
  const buffer = fs.readFileSync(PDF_PATH)
  const data = new Uint8Array(buffer)
  const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  
  const pdfjsDoc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false }).promise
  const pdfLibDoc = await PDFDocument.load(arrayBuf)
  
  console.log('Pages:', pdfjsDoc.numPages)
  
  // Step 1: Get page->images mapping from pdfjs operator list
  const pageImageInfo = {} // pageNum -> [{name, width, height}]
  
  for (let i = 1; i <= pdfjsDoc.numPages; i++) {
    const page = await pdfjsDoc.getPage(i)
    const ops = await page.getOperatorList()
    const imgs = []
    for (let j = 0; j < ops.fnArray.length; j++) {
      const fn = ops.fnArray[j]
      if (fn === 85 || fn === 86) {
        const args = ops.argsArray[j]
        if (args && args.length >= 3) {
          imgs.push({
            name: args[0].toString(),
            width: parseInt(args[1]) || 0,
            height: parseInt(args[2]) || 0
          })
        }
      }
    }
    if (imgs.length > 0) pageImageInfo[i] = imgs
  }
  
  console.log('\nPages with images:')
  for (const [pg, imgs] of Object.entries(pageImageInfo)) {
    console.log('  Page', pg + ':', imgs.length, 'image(s)')
    for (const img of imgs) console.log('    -', img.name, img.width + 'x' + img.height)
  }

  // Step 2: Extract via pdf-lib XObject
  const pages = pdfLibDoc.getPages()
  const extractedImages = [] // [{pageNum, name, width, height, base64, filterType}]
  
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageNum = pageIdx + 1
    const page = pages[pageIdx]
    
    let resources = null
    try { resources = page.node.get(PDFName.of('Resources')) } catch {}
    if (!resources) try { resources = page.node.lookup(PDFName.of('Resources')) } catch {}
    if (!resources || !(resources instanceof PDFDict)) continue
    
    let xObject = null
    try { xObject = resources.get(PDFName.of('XObject')) } catch {}
    if (!xObject) try { xObject = resources.lookup(PDFName.of('XObject')) } catch {}
    if (!xObject || !(xObject instanceof PDFDict)) continue
    
    for (const [name, ref] of xObject.entries()) {
      const imgName = name.toString()
      const stream = pdfLibDoc.context.lookup(ref)
      if (!stream) continue
      const dict = stream.dict || stream
      
      let subtype = null
      try { subtype = dict.get(PDFName.of('Subtype')) } catch {}
      if (!subtype) try { subtype = dict.lookup(PDFName.of('Subtype')) } catch {}
      if (!subtype || subtype.toString() !== '/Image') continue
      
      let width = 0, height = 0
      try { width = dict.get(PDFName.of('Width')) } catch {}
      if (!width) try { width = dict.lookup(PDFName.of('Width')) } catch {}
      try { height = dict.get(PDFName.of('Height')) } catch {}
      if (!height) try { height = dict.lookup(PDFName.of('Height')) } catch {}
      
      let filter = null
      try { filter = dict.get(PDFName.of('Filter')) } catch {}
      if (!filter) try { filter = dict.lookup(PDFName.of('Filter')) } catch {}
      const filterStr = filter ? filter.toString() : ''
      
      let rawBytes = null
      try {
        if (typeof stream.getContents === 'function') {
          rawBytes = stream.getContents()
        }
      } catch {}
      
      if (!rawBytes || rawBytes.length < 1000) continue
      
      let base64 = null
      let filterType = 'unknown'
      
      if (filterStr.includes('DCTDecode')) {
        // JPEG direct
        base64 = Buffer.from(rawBytes).toString('base64')
        filterType = 'jpeg'
      } else if (filterStr.includes('FlateDecode')) {
        // zlib compressed
        filterType = 'flate'
        continue
      } else if (filterStr === '') {
        // Raw image
        filterType = 'raw'
        continue
      } else {
        filterType = filterStr
        console.log('  Unknown filter:', filterStr)
        continue
      }
      
      if (base64) {
        extractedImages.push({ pageNum, name: imgName, width, height, base64, filterType })
        console.log('  Extracted:', 'Page', pageNum, imgName, width + 'x' + height, filterType, (rawBytes.length / 1024).toFixed(0) + 'KB')
      }
    }
  }
  
  console.log('\nTotal extracted images:', extractedImages.length)
  
  // Step 3: Map to questions (Q# = page# - 2)
  const questionImages = {} // qNum -> [{name, width, height, base64}]
  
  for (const img of extractedImages) {
    const qNum = img.pageNum - 2
    if (qNum >= 1 && qNum <= 60) {
      if (!questionImages[qNum]) questionImages[qNum] = []
      questionImages[qNum].push(img)
    }
  }
  
  console.log('\nQuestions with images:')
  for (const [qNum, imgs] of Object.entries(questionImages)) {
    console.log('  Q' + qNum + ':', imgs.map(i => i.name + '(' + i.width + 'x' + i.height + ')').join(', '))
  }
  
  // Step 4: Load existing JSON and update with images
  const jsonFile = path.join(OUT, 'cbr_rddi_2025_with_images.json')
  let jsonData = null
  try {
    jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  } catch(e) {
    console.error('Could not load JSON:', e.message)
    return
  }
  
  const questions = Array.isArray(jsonData) ? jsonData : (jsonData.questions ? Object.values(jsonData.questions) : Object.values(jsonData))
  
  let updated = 0
  for (const q of questions) {
    const qNum = q.question_number || q.number
    if (questionImages[qNum] && questionImages[qNum].length > 0) {
      // Use the largest image for the question
      const mainImg = questionImages[qNum].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0]
      q.image_base64 = mainImg.base64
      q.has_image = true
      updated++
    }
  }
  
  console.log('\nUpdated', updated, 'questions with images')
  
  // Save updated JSON
  fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2))
  console.log('Saved to', jsonFile)
  
  // Summary
  const qWithImg = Object.keys(questionImages).filter(k => questionImages[k].length > 0)
  console.log('\nTotal Q with images:', qWithImg.length, '/ 60')
  if (qWithImg.length < 10) {
    console.log('Questions with images:', qWithImg.map(k => 'Q' + k).join(', '))
  }
}

main().catch(console.error)
