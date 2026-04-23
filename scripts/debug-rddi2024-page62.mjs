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
  
  console.log('Total pages:', doc.numPages)
  
  // Page 62
  const page = await doc.getPage(62)
  const content = await page.getTextContent()
  const text = content.items.map(item => item.str).join('')
  
  console.log('Page 62 text length:', text.length)
  console.log('Page 62 text (repr):', JSON.stringify(text))
  console.log('Page 62 text (raw):', text)
  
  // Find Questão Gabarito
  const idx = text.indexOf('Questão Gabarito')
  console.log('\nQuestão Gabarito idx:', idx)
  
  if (idx >= 0) {
    const after = text.slice(idx + 'Questão Gabarito'.length)
    console.log('After marker (repr):', JSON.stringify(after))
    console.log('After marker (raw):', after)
    
    // Try regex
    const re = /(\d+)\s+([A-E])/g
    let m
    let count = 0
    while ((m = re.exec(after)) !== null && count < 5) {
      console.log('Match:', m[1], m[2])
      count++
    }
  }
  
  // Also check all pages for this pattern
  console.log('\n=== Scanning all pages ===')
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i)
    const c = await p.getTextContent()
    const t = c.items.map(item => item.str).join('')
    if (t.includes('Questão Gabarito') || t.includes('GABARITO PRELIMINAR')) {
      console.log(`Page ${i}: ${t.replace(/\s+/g, ' ').slice(0, 100)}`)
    }
  }
}

main().catch(console.error)