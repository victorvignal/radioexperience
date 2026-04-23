import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')

const CBR = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = path.join(__dirname, 'cbr_output')

async function extractImagesFromPDF(pdfPath) {
  const buffer = fs.readFileSync(pdfPath)
  const data = new Uint8Array(buffer)
  const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  
  const pdfjsDoc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false }).promise
  const pdfLibDoc = await PDFDocument.load(arrayBuf)
  
  // Step 1: pdfjs operator list per page
  const pageImageInfo = {}
  for (let i = 1; i <= pdfjsDoc.numPages; i++) {
    const page = await pdfjsDoc.getPage(i)
    const ops = await page.getOperatorList()
    const imgs = []
    for (let j = 0; j < ops.fnArray.length; j++) {
      const fn = ops.fnArray[j]
      if (fn === 85 || fn === 86) {
        const args = ops.argsArray[j]
        if (args && args.length >= 3) {
          imgs.push({ name: args[0].toString(), width: parseInt(args[1]) || 0, height: parseInt(args[2]) || 0 })
        }
      }
    }
    if (imgs.length > 0) pageImageInfo[i] = imgs
  }
  
  // Step 2: pdf-lib extract
  const extractedImages = []
  const pages = pdfLibDoc.getPages()
  
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
      try { if (typeof stream.getContents === 'function') rawBytes = stream.getContents() } catch {}
      if (!rawBytes || rawBytes.length < 1000) continue
      
      let base64 = null
      if (filterStr.includes('DCTDecode')) {
        base64 = Buffer.from(rawBytes).toString('base64')
      } else if (filterStr.includes('FlateDecode')) {
        continue  // skip for now
      } else {
        continue
      }
      
      if (base64) {
        extractedImages.push({ pageNum, name: imgName, width, height, base64 })
      }
    }
  }
  
  return { pdfjsDoc, extractedImages, pageImageInfo }
}

function updateJSONWithImages(jsonPath, extractedImages, pageImageInfo, qOffset) {
  // qOffset: question number offset (page 3 = Q1 means offset = page - qNum)
  // For RDDI 2020: page 3 = Q1 → qOffset = 2
  // For USG 2019: need to determine from JSON's page_start fields
  
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const questions = Array.isArray(jsonData) ? jsonData : (jsonData.questions ? Object.values(jsonData.questions) : Object.values(jsonData))
  
  // Build page -> images mapping using dimensions as key
  const pageImages = {} // pageNum -> [{name, width, height, base64}]
  for (const img of extractedImages) {
    if (!pageImages[img.pageNum]) pageImages[img.pageNum] = []
    pageImages[img.pageNum].push(img)
  }
  
  // For each question, find its page from pageImageInfo (operator list)
  // Then find the matching image by dimensions
  let updated = 0
  
  for (const q of questions) {
    const qNum = q.question_number || q.number
    if (!qNum) continue
    
    // Find which page this question is on from pageImageInfo
    // We need to look at the source page info
    const page_start = q.page_start || (qNum + 2)  // fallback
    
    // Find images on this page
    const imgsOnPage = pageImages[page_start] || []
    
    // Filter to images that are large (actual question images, not logos/decorations)
    const largeImgs = imgsOnPage.filter(img => img.width > 100 && img.height > 100)
    
    if (largeImgs.length > 0) {
      // Use the largest image
      const mainImg = largeImgs.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0]
      q.image_base64 = mainImg.base64
      q.has_image = true
      updated++
    }
  }
  
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2))
  return updated
}

async function main() {
  console.log('=== Processing RDDI 2020 ===\n')
  
  // RDDI 2020
  // PDF: Prova-Anual-2020.pdf — check if it has images
  const rddi2020PDF = path.join(CBR, 'RDDI', '2020', 'Prova-Anual-2020.pdf')
  console.log('Checking:', rddi2020PDF)
  
  if (fs.existsSync(rddi2020PDF)) {
    const { pdfjsDoc, extractedImages, pageImageInfo } = await extractImagesFromPDF(rddi2020PDF)
    console.log('RDDI 2020 pages:', pdfjsDoc.numPages, '| Images extracted:', extractedImages.length)
    console.log('Pages with images:', Object.keys(pageImageInfo).join(','))
    
    // Count pages with images (questions pages start at 3 = Q1)
    let qPagesWithImg = 0
    for (let pg = 3; pg <= pdfjsDoc.numPages - 4; pg++) {
      if (pageImageInfo[pg]) qPagesWithImg++
    }
    console.log('Question pages with images:', qPagesWithImg)
    
    if (extractedImages.length > 0) {
      const jsonPath = path.join(OUT, 'extracted_rddi-2020-anual.json')
      if (fs.existsSync(jsonPath)) {
        const updated = updateJSONWithImages(jsonPath, extractedImages, pageImageInfo, 2)
        console.log('Updated JSON with', updated, 'images')
      }
    }
  }
  
  console.log('\n=== Processing USG 2019 ===\n')
  
  // USG 2019
  const usg2019PDF = path.join(CBR, 'USG', '2019', 'Prova-Anual-2019.pdf')
  console.log('Checking:', usg2019PDF)
  
  if (fs.existsSync(usg2019PDF)) {
    const { pdfjsDoc, extractedImages, pageImageInfo } = await extractImagesFromPDF(usg2019PDF)
    console.log('USG 2019 pages:', pdfjsDoc.numPages, '| Images extracted:', extractedImages.length)
    console.log('Pages with images:', Object.keys(pageImageInfo).join(','))
    
    if (extractedImages.length > 0) {
      const jsonPath = path.join(OUT, 'extracted_usg-2019-anual.json')
      if (fs.existsSync(jsonPath)) {
        const updated = updateJSONWithImages(jsonPath, extractedImages, pageImageInfo, 2)
        console.log('Updated JSON with', updated, 'images')
      }
    }
  }
  
  console.log('\n=== Processing RDDI 2019 (if readable) ===\n')
  
  // RDDI 2019 - Prova-A-Avaliacao-Anual-2019.pdf
  const rddi2019PDF = path.join(CBR, 'RDDI', '2019', 'Prova-A-Avaliacao-Anual-2019.pdf')
  console.log('Checking:', rddi2019PDF)
  
  if (fs.existsSync(rddi2019PDF)) {
    const { pdfjsDoc, extractedImages, pageImageInfo } = await extractImagesFromPDF(rddi2019PDF)
    console.log('RDDI 2019 pages:', pdfjsDoc.numPages, '| Images extracted:', extractedImages.length)
    console.log('Pages with images:', Object.keys(pageImageInfo).join(','))
  }
}

main().catch(console.error)
