import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'

function parsePage62Style(text) {
  const idx = text.indexOf('Questão Gabarito')
  const flexIdx = idx < 0 ? (text.match(/Questão\s+Gabarito/) || { index: -1 }).index : idx
  if (flexIdx < 0) return {}
  const raw = text.slice(flexIdx + 'Questão Gabarito'.length).replace(/^\s+/, '')
  const answers = {}
  let i = 0
  while (i < raw.length) {
    while (i < raw.length && (raw.charCodeAt(i) < 48 || raw.charCodeAt(i) > 57)) { i++ }
    if (i >= raw.length) break
    let numStr = ''
    while (i < raw.length && raw.charCodeAt(i) >= 48 && raw.charCodeAt(i) <= 57) { numStr += raw[i++] }
    while (i < raw.length && raw[i] === ' ') { i++ }
    if (i >= raw.length) break
    const letter = raw[i++].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 200) answers[n] = letter
    }
  }
  return answers
}

function parseSpaced(text) {
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

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
  const gab = JSON.parse(fs.readFileSync(OUT + '\\extracted_gabaritos.json', 'utf8'))
  
  // Fix RDDI 2025 - the "Spaced" parser is wrong. The actual answers are in "Questão Gabarito" at end.
  console.log('=== Fixing RDDI 2025 gabarito ===')
  const r2025Text = await extractText(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')
  const r2025Real = parsePage62Style(r2025Text)
  console.log('Real RDDI 2025 answers:', Object.keys(r2025Real).sort((a,b)=>a-b).map(n=>n+r2025Real[n]).join(' '))
  console.log('Count:', Object.keys(r2025Real).length)
  gab.rddi_2025 = r2025Real
  
  // USG 2020 - fix
  console.log('\n=== Fixing USG 2020 gabarito ===')
  const usg2020Text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
  // Look for the "Questão Gabarito" section
  const usg2020Real = parsePage62Style(usg2020Text)
  console.log('Page62 style answers:', Object.keys(usg2020Real).length)
  
  // USG 2018 - fix
  console.log('\n=== Fixing USG 2018 gabarito ===')
  const usg2018Text = await extractText(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
  const usg2018Real = parsePage62Style(usg2018Text)
  console.log('Page62 style answers:', Object.keys(usg2018Real).length)
  
  // USG 2025 fix
  console.log('\n=== Fixing USG 2025 gabarito ===')
  const usg2025Text = await extractText(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf')
  const usg2025Real = parsePage62Style(usg2025Text)
  console.log('Page62 style answers:', Object.keys(usg2025Real).length)
  if (Object.keys(usg2025Real).length === 0) {
    // Try last page of USG 2025
    const lastPage = await (async () => {
      const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf'))
      const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
      const page = await doc.getPage(doc.numPages)
      const content = await page.getTextContent()
      return content.items.map(item => item.str).join('')
    })()
    console.log('USG 2025 last page:', JSON.stringify(lastPage))
    const usg2025Last = parsePage62Style(lastPage)
    console.log('From last page:', Object.keys(usg2025Last).length)
    if (Object.keys(usg2025Last).length > 0) gab.usg_2025 = usg2025Last
  } else {
    gab.usg_2025 = usg2025Real
  }
  
  // Save fixed gabaritos
  fs.writeFileSync(OUT + '\\extracted_gabaritos.json', JSON.stringify(gab, null, 2))
  console.log('\n✅ Gabaritos corrigidos salvos')
  
  // Now check which exams still need re-extraction
  // RDDI 2024 has 51 Q with images - verified
  // RDDI 2025 needs to be re-ingested with correct answers
  console.log('\n=== RDDI 2025 wrong answers fix ===')
  console.log('Old r2025 (first 10):', Object.keys(gab.rddi_2025).sort((a,b)=>a-b).slice(0,10).map(n=>n+gab.rddi_2025[n]).join(' '))
  // These are WRONG - need to replace with correct ones
  // We need to RE-EXTRACT RDDI 2025 questions with correct answers
}

main().catch(console.error)