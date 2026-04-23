import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  // RDDI 2019 Anual
  const pdfPath = CBR_BASE + '\\RDDI\\2019\\Prova-A-Avaliacao-Anual-2019.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  console.log('RDDI 2019 Anual - Pages:', doc.numPages)
  
  // Extract first 5 pages text
  for (let i = 1; i <= 5; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join(' ')
    console.log(`\nPage ${i} (first 200):`, text.substring(0, 200))
  }
  
  // Check last 3 pages
  for (let i = doc.numPages - 2; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join('')
    console.log(`\nPage ${i} (last 200):`, text.slice(-200))
  }
}

main().catch(console.error)