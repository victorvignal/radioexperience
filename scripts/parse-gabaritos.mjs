import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  // RDDI 2021 gabarito parsing
  const pdf2Path = CBR_BASE + '\\RDDI\\2021\\Prova-Anual-R3-2021.pdf'
  const data2 = new Uint8Array(fs.readFileSync(pdf2Path))
  const doc2 = await pdfjsLib.getDocument({ data: data2, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  // Pages 78-81 have gabarito
  console.log('RDDI 2021 gabarito pages:')
  for (let i = 78; i <= 81; i++) {
    const p = await doc2.getPage(i)
    const c = await p.getTextContent()
    const t = c.items.map(it => it.str).join('')
    console.log(`Page ${i}:`, t.substring(0, 300))
  }
  
  // USG 2020 - parse 50 answers
  console.log('\n--- USG 2020 ---')
  const pdfPath = CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  let fullText = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map(it => it.str).join('') + '\n'
  }
  console.log('USG 2020 text:', fullText.substring(0, 300))
  
  // Parse "N A" pattern
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(fullText)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  console.log('USG 2020 answers:', Object.keys(answers).sort((a, b) => a - b).map(n => n + answers[n]).join(' '))
}

main().catch(console.error)