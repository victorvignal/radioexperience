import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    text += '\n' + (await page.getTextContent()).items.map(item => item.str).join(' ')
  }
  return text
}

// Count images in a PDF by looking for image XObjects
async function countPdfImages(pdfPath) {
  try {
    const data = fs.readFileSync(pdfPath)
    // Count JPEG markers in binary
    let count = 0
    for (let i = 0; i < data.length - 2; i++) {
      if (data[i] === 0xFF && data[i+1] === 0xD8 && data[i+2] === 0xFF) count++
    }
    return count
  } catch {
    return 0
  }
}

// Try to extract images from a PDF page
async function tryRenderPage(pdfPath, pageNum, scale = 2.0) {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath))
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
    if (pageNum > doc.numPages) return null
    
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    
    // Try to render to canvas
    const canvas = require('canvas')
    const c = canvas.createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
    const ctx = c.getContext('2d')
    
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise
    
    return c.toBuffer('image/jpeg', 0.85).toString('base64')
  } catch(e) {
    return null
  }
}

async function main() {
  console.log('=== Checking PDFs for embedded images ===\n')
  
  const pdfs = [
    { name: 'USG 2018', path: 'USG/2018/Prova-Teorico-Pratica-Maio-2018.pdf' },
    { name: 'USG 2019', path: 'USG/2019/Prova-Anual-2019.pdf' },
    { name: 'USG 2020', path: 'USG/2020/Prova-Teorica-Teorico-Pratica-2020.pdf' },
    { name: 'USG 2023 V1', path: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf' },
    { name: 'USG 2023 V2', path: 'USG/2023/Prova-Teorica-TP-v2-2023.pdf' },
    { name: 'RDDI 2023 TP', path: 'RDDI/2023/Prova-Teorico-Pratica-v3-2023.pdf' },
    { name: 'RDDI 2024', path: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf' },
  ]
  
  for (const pdf of pdfs) {
    const fp = CBR_BASE + '\\' + pdf.path.replace('/', '\\')
    const sizeMB = (fs.statSync(fp).size / 1024 / 1024).toFixed(2)
    const jpegCount = await countPdfImages(fp)
    console.log(`${pdf.name}: ${sizeMB} MB | ~${jpegCount} JPEGs embedded`)
  }
  
  console.log('\n=== Checking USG 2023 V1/V2 JSON for missing questions ===')
  
  const usgV1Path = OUT + '\\cbr_usg_2023_v1_with_images.json'
  const usgV1 = JSON.parse(fs.readFileSync(usgV1Path, 'utf8'))
  
  // Questions 1-40, each appearing once (50 stored = some dupes)
  // Q7, Q8, Q9, Q10 in V1 have images
  // V1 gabarito has answers for Q1-Q40
  // Let's find which Q numbers from 1-40 are actually missing
  
  const seenV1 = new Set()
  const uniqueV1 = []
  for (const q of usgV1.questions) {
    const n = parseInt(q.number)
    if (!seenV1.has(n)) {
      seenV1.add(n)
      uniqueV1.push(q)
    }
  }
  
  const sortedNumsV1 = [...seenV1].sort((a,b)=>a-b)
  console.log(`\nV1: ${usgV1.questions.length} stored → ${uniqueV1.length} unique Qs`)
  console.log('Range:', sortedNumsV1[0], '-', sortedNumsV1[sortedNumsV1.length-1])
  
  // Find missing numbers 1-40
  const missingV1 = []
  for (let i = 1; i <= 40; i++) {
    if (!seenV1.has(i)) missingV1.push(i)
  }
  console.log('Missing Q numbers (1-40):', missingV1.join(', '))
  
  // Check which of the missing have images in the raw questions
  const withImg = usgV1.questions.filter(q => q.image_base64 && q.image_base64.length > 5000)
  console.log('\nV1 Qs with images:', withImg.length, '→ Q numbers:', withImg.map(q => q.number).sort().join(', '))
  
  // USG May 2023 gabarito (40 answers for Q1-40)
  // USG June 2023 gabarito (39 answers, some anulled)
  // Both versions have images for Q7, Q8, Q9, Q10
  // But only Q10 in V1 and Q30 in V2 have answers in gabaritos...
  // Wait - let me recheck the gabarito parsing
  console.log('\n=== Re-checking USG May 2023 gabarito ===')
  const mayText = await extractTextFromPDF(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf')
  const mayIdx = mayText.indexOf('GABARITO')
  const maySnippet = mayText.slice(mayIdx, mayIdx + 400).replace(/\s+/g, ' ')
  console.log('May snippet:', maySnippet.slice(0, 200))
}

main().catch(console.error)