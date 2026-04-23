import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  // Check RDDI 2018 page 3 text
  const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\RDDI\\2018\\Prova-Anual-2018.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  // Look at page 3
  const p3 = await doc.getPage(3)
  const c3 = await p3.getTextContent()
  const t3 = c3.items.map(i => i.str).join(' ')
  console.log('Page 3 first 500:', t3.substring(0, 500))
  console.log('\nPage 3 QUESTAO matches:', [...t3.matchAll(/QUEST[AO]\s*(\d+)/gi)].map(m => m[1]))
  
  // Also check what happens with split on Questão vs QUESTÃO
  console.log('\nSplit on "Questão":', t3.split(/Questão\s*/i).slice(0, 3).map(s => s.trim().substring(0, 40)))
  
  // Check page 1 for the format
  const p1 = await doc.getPage(1)
  const c1 = await p1.getTextContent()
  const t1 = c1.items.map(i => i.str).join('')
  console.log('\nPage 1 last 200:', t1.slice(-200))
  
  // Check last page for gabarito
  const pLast = await doc.getPage(doc.numPages)
  const cLast = await pLast.getTextContent()
  const tLast = cLast.items.map(i => i.str).join('')
  console.log('\nLast page first 300:', tLast.substring(0, 300))
}

main().catch(console.error)