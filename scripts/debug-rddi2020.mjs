import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'

async function extractText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += '\n' + content.items.map(item => item.str).join('')
  }
  return text
}

async function main() {
  // Debug RDDI 2020 gabarito
  console.log('=== RDDI 2020 Gabarito ===')
  const text = await extractText(CBR_BASE + '\\RDDI\\2020\\Gabarito-2020-v2.pdf')
  console.log('Text length:', text.length)
  console.log('First 200:', text.substring(0, 200))
  console.log('Last 200:', text.slice(-200))
  
  // Try spaced
  const spaced = {}
  const re1 = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re1.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) spaced[n] = m[2] }
  console.log('Spaced answers:', Object.keys(spaced).length)
  
  // Try page 62 style
  const idx = text.indexOf('Questão Gabarito')
  console.log('Questão Gabarito idx:', idx)
  if (idx >= 0) {
    const raw = text.slice(idx + 'Questão Gabarito'.length).replace(/^\s+/, '')
    console.log('After marker:', JSON.stringify(raw.substring(0, 80)))
  }
  
  // Check all pages
  const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\RDDI\\2020\\Gabarito-2020-v2.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  console.log('Pages:', doc.numPages)
  
  // Page 1
  const p1 = await doc.getPage(1)
  const c1 = await p1.getTextContent()
  console.log('Page 1 text:', c1.items.map(i => i.str).join('').substring(0, 200))
  
  // Try "N A" pattern in first page
  const firstPageText = c1.items.map(i => i.str).join('')
  const answers1 = {}
  const reA = /(\d+)\s+([A-E])\b/g
  while ((m = reA.exec(firstPageText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) answers1[n] = m[2] }
  console.log('First page answers:', Object.keys(answers1).length)
  
  // Check last page
  const pLast = await doc.getPage(doc.numPages)
  const cLast = await pLast.getTextContent()
  const lastText = cLast.items.map(i => i.str).join('')
  console.log('Last page:', JSON.stringify(lastText))
  const answersLast = {}
  const reLast = /(\d+)\s+([A-E])\b/g
  while ((m = reLast.exec(lastText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) answersLast[n] = m[2] }
  console.log('Last page answers:', Object.keys(answersLast).length)
}

main().catch(console.error)