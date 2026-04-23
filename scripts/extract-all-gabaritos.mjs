import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'

function parseGabaritoSpaced(text) {
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

// Try to parse gabarito from dense format (no space): "1B2C3A..."
function parseGabaritoDense(text) {
  const answers = {}
  // Match number followed by letter, repeatedly
  const re = /(\d{1,3})([A-E])(?=\d|$)/g
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

// Parse "Questão Gabarito1 B2 C3..." format
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

async function main() {
  console.log('=== Extraindo gabaritos faltantes ===\n')
  
  // 1. RDDI 2025
  console.log('--- RDDI 2025 ---')
  const r2025Text = await extractText(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')
  const r2025Answers = parseGabaritoSpaced(r2025Text)
  console.log('Spaced found:', Object.keys(r2025Answers).length)
  if (Object.keys(r2025Answers).length < 30) {
    const dense = parseGabaritoDense(r2025Text)
    console.log('Dense found:', Object.keys(dense).length)
    if (Object.keys(dense).length > Object.keys(r2025Answers).length) {
      Object.assign(r2025Answers, dense)
    }
  }
  
  // Look at last 500 chars for "N A" patterns
  const lastPart = r2025Text.slice(-500)
  console.log('Last 500:', JSON.stringify(lastPart))
  console.log('RDDI 2025 answers:', Object.keys(r2025Answers).sort((a,b)=>a-b).map(n=>n+r2025Answers[n]).join(' '))
  console.log('Count:', Object.keys(r2025Answers).length)
  
  // 2. USG 2018
  console.log('\n--- USG 2018 ---')
  const usg2018Text = await extractText(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
  const usg2018Answers = parseGabaritoSpaced(usg2018Text)
  console.log('Spaced found:', Object.keys(usg2018Answers).length)
  if (Object.keys(usg2018Answers).length < 30) {
    const dense = parseGabaritoDense(usg2018Text)
    console.log('Dense found:', Object.keys(dense).length)
    if (Object.keys(dense).length > Object.keys(usg2018Answers).length) {
      Object.assign(usg2018Answers, dense)
    }
  }
  
  // Last page
  console.log('USG 2018 last 300:', JSON.stringify(usg2018Text.slice(-300)))
  console.log('USG 2018 answers:', Object.keys(usg2018Answers).sort((a,b)=>a-b).map(n=>n+usg2018Answers[n]).join(' '))
  console.log('Count:', Object.keys(usg2018Answers).length)
  
  // 3. USG 2020
  console.log('\n--- USG 2020 ---')
  const usg2020Text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
  const usg2020Answers = parseGabaritoSpaced(usg2020Text)
  console.log('Spaced found:', Object.keys(usg2020Answers).length)
  if (Object.keys(usg2020Answers).length < 30) {
    const dense = parseGabaritoDense(usg2020Text)
    console.log('Dense found:', Object.keys(dense).length)
    if (Object.keys(dense).length > Object.keys(usg2020Answers).length) {
      Object.assign(usg2020Answers, dense)
    }
  }
  console.log('USG 2020 answers:', Object.keys(usg2020Answers).sort((a,b)=>a-b).map(n=>n+usg2020Answers[n]).join(' '))
  console.log('Count:', Object.keys(usg2020Answers).length)
  
  // 4. USG 2025
  console.log('\n--- USG 2025 ---')
  const usg2025Text = await extractText(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf')
  const usg2025Answers = parseGabaritoSpaced(usg2025Text)
  console.log('Spaced found:', Object.keys(usg2025Answers).length)
  if (Object.keys(usg2025Answers).length < 30) {
    const dense = parseGabaritoDense(usg2025Text)
    console.log('Dense found:', Object.keys(dense).length)
    if (Object.keys(dense).length > Object.keys(usg2025Answers).length) {
      Object.assign(usg2025Answers, dense)
    }
  }
  console.log('USG 2025 answers:', Object.keys(usg2025Answers).sort((a,b)=>a-b).map(n=>n+usg2025Answers[n]).join(' '))
  console.log('Count:', Object.keys(usg2025Answers).length)
  
  // Save all gabaritos
  fs.writeFileSync(OUT + '\\extracted_gabaritos.json', JSON.stringify({
    rddi_2025: r2025Answers,
    usg_2018: usg2018Answers,
    usg_2020: usg2020Answers,
    usg_2025: usg2025Answers,
  }, null, 2))
  console.log('\n✅ Gabaritos salvos em extracted_gabaritos.json')
}

main().catch(console.error)