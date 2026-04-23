// Test text extraction from RDDI 2024 - check quality
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const fs = require('fs')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const pdfPath = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, disableFontFace: true, useSystemFonts: true }).promise
  
  console.log('Total pages:', doc.numPages)
  
  // Extract text from first 5 question pages (pages 3-7)
  for (let i = 3; i <= 7; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join('')
    console.log(`\n=== Page ${i} (${text.length} chars) ===`)
    console.log(text.substring(0, 300))
    console.log('...')
  }
}

main().catch(console.error)