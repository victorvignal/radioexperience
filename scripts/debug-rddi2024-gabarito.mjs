import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  const pdfPath = CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  // Check all pages for "Questão Gabarito"
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join('')
    if (text.includes('Questão') && text.includes('Gabarito')) {
      console.log(`Page ${i}: has "Questão" and "Gabarito"`)
      console.log('  Contains "Questão Gabarito":', text.includes('Questão Gabarito'))
      console.log('  Text snippet:', JSON.stringify(text.substring(0, 100)))
    }
  }
  
  // Now check full-text extraction - page 62 in context
  let fullText = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    fullText += '\n' + pageText
  }
  
  console.log('\nFull text length:', fullText.length)
  console.log('indexOf "Questão Gabarito":', fullText.indexOf('Questão Gabarito'))
  console.log('indexOf "Gabarito1":', fullText.indexOf('Gabarito1'))
  
  // Try different variations
  console.log('indexOf "Questao Gabarito":', fullText.indexOf('Questao Gabarito'))
  console.log('indexOf "GABARITO":', fullText.indexOf('GABARITO'))
  
  // Find where "Questão" appears
  const qIdx = fullText.indexOf('Questão')
  console.log('First "Questão" at:', qIdx)
  console.log('Snippet:', JSON.stringify(fullText.substring(qIdx, qIdx + 50)))
}

main().catch(console.error)