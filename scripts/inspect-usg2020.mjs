import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  // Check USG 2020 - why so little text?
  const pdfPath = CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  console.log('USG 2020 - Pages:', doc.numPages)
  
  // Page 1
  const p1 = await doc.getPage(1)
  const c1 = await p1.getTextContent()
  console.log('Page 1 text:', c1.items.map(i => i.str).join(' ').substring(0, 200))
  
  // Page 2
  const p2 = await doc.getPage(2)
  const c2 = await p2.getTextContent()
  console.log('Page 2 text:', c2.items.map(i => i.str).join(' ').substring(0, 200))
  
  // Check last page
  const pLast = await doc.getPage(doc.numPages)
  const cLast = await pLast.getTextContent()
  console.log('Last page text:', cLast.items.map(i => i.str).join('').slice(-200))
  
  // Try RDDI 2021 page 1
  console.log('\n--- RDDI 2021 ---')
  const pdf2Path = CBR_BASE + '\\RDDI\\2021\\Prova-Anual-R3-2021.pdf'
  const data2 = new Uint8Array(fs.readFileSync(pdf2Path))
  const doc2 = await pdfjsLib.getDocument({ data: data2, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  console.log('RDDI 2021 - Pages:', doc2.numPages)
  
  const rp1 = await doc2.getPage(1)
  const rc1 = await rp1.getTextContent()
  console.log('Page 1 text:', rc1.items.map(i => i.str).join(' ').substring(0, 200))
  
  // Check for "QUESTÃO" or "Questão" in page 1
  const p1text = rc1.items.map(i => i.str).join(' ')
  console.log('Has QUESTÃO:', p1text.includes('QUESTÃO') || p1text.includes('Questão'))
  console.log('Has 57A:', p1text.includes('57A') || p1text.includes('57 A'))
  
  // Page 2
  const rp2 = await doc2.getPage(2)
  const rc2 = await rp2.getTextContent()
  console.log('Page 2 text:', rc2.items.map(i => i.str).join(' ').substring(0, 200))
  
  // Check last pages for gabarito
  for (let i = Math.max(1, doc2.numPages - 3); i <= doc2.numPages; i++) {
    const p = await doc2.getPage(i)
    const c = await p.getTextContent()
    const t = c.items.map(i => i.str).join('')
    console.log(`Page ${i} last 100:`, t.slice(-100))
  }
}

main().catch(console.error)