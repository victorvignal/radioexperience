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
  // Fix RDDI 2025 JSON - re-extract with correct answers
  console.log('=== Re-extracting RDDI 2025 with correct answers ===')
  
  // Load current JSON
  const r2025JSON = JSON.parse(fs.readFileSync(OUT + '\\cbr_rddi_2025_with_images.json', 'utf8'))
  console.log('RDDI 2025 JSON questions:', r2025JSON.questions.length)
  
  // Get correct gabarito
  const r2025Text = await extractText(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')
  const r2025Gab = parsePage62Style(r2025Text)
  console.log('RDDI 2025 gabarito:', Object.keys(r2025Gab).sort((a,b)=>a-b).map(n=>n+r2025Gab[n]).join(' '))
  
  // Update questions with correct answers
  let matched = 0
  r2025JSON.questions.forEach(q => {
    const num = parseInt(q.number)
    const answer = r2025Gab[num]
    if (answer && /^[A-E]$/.test(answer)) {
      q.correct_answer = answer
      matched++
    } else {
      q.correct_answer = null
    }
  })
  
  console.log('Matched:', matched, '/', r2025JSON.questions.length)
  
  // Save corrected JSON
  fs.writeFileSync(OUT + '\\cbr_rddi_2025_with_images.json', JSON.stringify(r2025JSON, null, 2))
  console.log('Saved corrected cbr_rddi_2025_with_images.json')
  
  // Now extract USG 2018 questions with answers from the prova text
  // The answers are at the very end of the PDF
  console.log('\n=== Re-extracting USG 2018 ===')
  const usg2018Text = await extractText(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
  
  // Find all "Questão N" and options
  const usg2018Questions = []
  const parts = usg2018Text.split(/(?=Questão\s*\d+)/i)
  
  for (const part of parts) {
    if (!part.trim()) continue
    const numMatch = part.match(/Questão\s*(\d+)/i)
    if (!numMatch) continue
    const qNum = parseInt(numMatch[1])
    if (qNum < 1 || qNum > 200) continue
    
    let body = part.replace(/Questão\s*\d+/i, '')
    const sections = body.split(/(?=[A-E]\)\s*)/)
    
    const questionText = (sections[0] || body).replace(/\s+/g, ' ').trim()
    const options = []
    
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      const optMatch = sec.match(/^([A-E])\)\s*(.+)/s)
      if (optMatch) {
        options.push(optMatch[0].trim())
      }
    }
    
    if (questionText.length > 5 && options.length >= 2) {
      usg2018Questions.push({
        number: String(qNum),
        text: questionText,
        options,
        correct_answer: null,
        difficulty: 'medium',
        explanation: '',
      })
    }
  }
  
  // Deduplicate
  const seen = new Set()
  const deduped = usg2018Questions.filter(q => {
    if (seen.has(q.number)) return false
    seen.add(q.number)
    return true
  })
  console.log('USG 2018 extracted:', deduped.length, 'questions')
  
  // USG 2018 doesn't have visible gabarito in the PDF text
  // The answers might be in a separate gabarito PDF or embedded differently
  fs.writeFileSync(OUT + '\\extracted_USG_2018_questions.json', JSON.stringify({ questions: deduped }, null, 2))
  console.log('Saved extracted_USG_2018_questions.json (no answers yet)')
  
  // Check USG 2020
  console.log('\n=== USG 2020 ===')
  const usg2020Text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
  
  // Find Questão Gabarito
  const idx = usg2020Text.indexOf('Questão Gabarito')
  if (idx >= 0) {
    console.log('Found Questão Gabarito at', idx)
    console.log('After:', usg2020Text.slice(idx, idx + 100))
  } else {
    console.log('No Questão Gabarito found')
    // Check last 300 chars
    console.log('Last 300:', usg2020Text.slice(-300))
  }
  
  // Parse all numbers and letters from last part
  const lastPart = usg2020Text.slice(-500)
  console.log('Last 500:', JSON.stringify(lastPart))
  
  // Extract USG 2020 questions
  const usg2020Questions = []
  const usgParts = usg2020Text.split(/(?=Questão\s*\d+)/i)
  
  for (const part of usgParts) {
    if (!part.trim()) continue
    const numMatch = part.match(/Questão\s*(\d+)/i)
    if (!numMatch) continue
    const qNum = parseInt(numMatch[1])
    if (qNum < 1 || qNum > 200) continue
    
    let body = part.replace(/Questão\s*\d+/i, '')
    const sections = body.split(/(?=[A-E]\)\s*)/)
    
    const questionText = (sections[0] || body).replace(/\s+/g, ' ').trim()
    const options = []
    
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      const optMatch = sec.match(/^([A-E])\)\s*(.+)/s)
      if (optMatch) {
        options.push(optMatch[0].trim())
      }
    }
    
    if (questionText.length > 5 && options.length >= 2) {
      usg2020Questions.push({
        number: String(qNum),
        text: questionText,
        options,
        correct_answer: null,
        difficulty: 'medium',
        explanation: '',
      })
    }
  }
  
  const seen2020 = new Set()
  const deduped2020 = usg2020Questions.filter(q => {
    if (seen2020.has(q.number)) return false
    seen2020.add(q.number)
    return true
  })
  console.log('USG 2020 extracted:', deduped2020.length, 'questions')
  
  fs.writeFileSync(OUT + '\\extracted_USG_2020_questions.json', JSON.stringify({ questions: deduped2020 }, null, 2))
  console.log('Saved extracted_USG_2020_questions.json')
}

main().catch(console.error)