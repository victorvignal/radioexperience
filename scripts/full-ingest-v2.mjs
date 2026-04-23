import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'
const SUPABASE_URL = 'https://pcdequsipbkxcfsewiow.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    text += '\n' + (await page.getTextContent()).items.map(item => item.str).join(' ')
  }
  return text
}

function parseSpacedGabarito(text) {
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

function parseDenseGabarito(text) {
  const answers = {}
  const re = /(\d{1,3})([A-E])(?=\d|$)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

function parsePage62Gabarito(text) {
  // The PDF page has "Questão   Gabarito" (variable spaces) or "Questão Gabarito" (single space)
  // First find the marker flexibly
  let markerIdx = text.indexOf('Questão Gabarito')
  if (markerIdx < 0) {
    // Try with flexible whitespace
    const flexMatch = text.match(/Questão\s+Gabarito/)
    if (flexMatch) markerIdx = flexMatch.index
  }
  if (markerIdx < 0) return {}
  
  const after = text.slice(markerIdx + 'Questão Gabarito'.length).replace(/^\s+/, '')
  
  const answers = {}
  let i = 0
  while (i < after.length) {
    // Skip non-digits
    while (i < after.length && (after.charCodeAt(i) < 48 || after.charCodeAt(i) > 57)) { i++ }
    if (i >= after.length) break
    let numStr = ''
    while (i < after.length && after.charCodeAt(i) >= 48 && after.charCodeAt(i) <= 57) {
      numStr += after[i++]
    }
    // Skip spaces
    while (i < after.length && after[i] === ' ') { i++ }
    if (i >= after.length) break
    const letter = after[i++].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 200) answers[n] = letter
    }
  }
  return answers
}

function httpPost(table, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const req = require('https').request(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: JSON.parse(d) }) } catch { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: d }) } })
    })
    req.on('error', e => resolve({ ok: false, status: 0, body: e.message }))
    req.write(data)
    req.end()
  })
}

function deletePool(pattern) {
  return new Promise((resolve) => {
    const req = require('https').request(`${SUPABASE_URL}/rest/v1/challenge_question_pool?source_title=ilike.*${encodeURIComponent(pattern)}*`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode })) })
    req.on('error', e => resolve({ status: 0 }))
    req.end()
  })
}

function formatOptions(opts) {
  if (!opts) return {}
  // Array of strings like ["A) Text", "B) Text", ...]
  if (Array.isArray(opts) && typeof opts[0] === 'string') {
    const out = {}
    for (const o of opts) {
      if (!o) continue
      const letter = o.charAt(0).toUpperCase()
      if (letter >= 'A' && letter <= 'E') out[letter] = o.substring(3).trim()
    }
    return out
  }
  // Array of objects [{letter, text}] or similar
  if (Array.isArray(opts)) {
    const out = {}
    for (const o of opts) {
      if (typeof o === 'object' && o !== null) {
        const letter = (o.letter || o.option_letter || o.key || '').charAt(0).toUpperCase()
        if (letter >= 'A' && letter <= 'E') out[letter] = o.text || o.content || JSON.stringify(o)
      }
    }
    return out
  }
  // Already a {A: text, B: text} object
  return opts
}

function isNonEmptyImage(b64) {
  return b64 && b64.length > 5000
}

// Load questions from JSON and match with gabarito
function loadJsonWithGabarito(jsonPath, gabarito, label) {
  if (!fs.existsSync(jsonPath)) return []
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const questions = []
  const seen = new Set()
  
  for (const q of data.questions || []) {
    const num = parseInt(q.number)
    if (isNaN(num) || seen.has(num)) continue
    seen.add(num)
    
    const answer = gabarito[num]
    if (!answer || !/^[A-E]$/.test(answer)) continue
    
    const hasImage = isNonEmptyImage(q.image_base64)
    
    // v2 JSON: q.text, q.options is array of strings like "A) Text"
    // other JSON: q.question_text, q.options is object {A: text, B: text, ...}
    const questionText = q.question_text || q.text || ''
    const opts = q.options || {}
    
    questions.push({
      specialty: 'Geral',
      question_text: questionText,
      question_type: 'multiple_choice',
      options: formatOptions(opts),
      correct_answer: answer,
      explanation: q.explanation || '',
      source_title: `${label} — Questão ${num}`,
      difficulty: q.difficulty || 'medium',
      image_base64: hasImage ? q.image_base64 : null,
      has_image: hasImage,
      times_used: 0,
    })
  }
  
  return questions
}

async function main() {
  console.log('=== Step 1: Parse all gabaritos ===\n')
  
  const gabaritos = {}
  
  // USG 2018 (embedded at end of prova PDF)
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
    const answers = parseSpacedGabarito(text)
    console.log('USG 2018:', Object.keys(answers).length, 'answers, sample:', Object.keys(answers).slice(0,5).map(n=>n+answers[n]).join(' '))
    gabaritos.usg_2018 = answers
  } catch(e) { console.log('USG 2018 FAILED:', e.message) }
  
  // USG 2019 TP gabarito
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\USG\\2019\\Gabarito-Teorico-Pratica-2019.pdf')
    const answers = parseSpacedGabarito(text)
    console.log('USG 2019 TP:', Object.keys(answers).length, 'answers, sample:', Object.keys(answers).slice(0,5).map(n=>n+answers[n]).join(' '))
    gabaritos.usg_2019_tp = answers
  } catch(e) { console.log('USG 2019 TP FAILED:', e.message) }
  
  // USG 2019 USGO gabarito
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\USG\\2019\\Gabarito-USGO-2019.pdf')
    const answers = parseSpacedGabarito(text)
    console.log('USG 2019 USGO:', Object.keys(answers).length, 'answers, sample:', Object.keys(answers).slice(0,5).map(n=>n+answers[n]).join(' '))
    gabaritos.usg_2019_usgo = answers
  } catch(e) { console.log('USG 2019 USGO FAILED:', e.message) }
  
  // USG 2020 (answers embedded in prova)
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
    const answers = parseSpacedGabarito(text)
    console.log('USG 2020:', Object.keys(answers).length, 'answers, sample:', Object.keys(answers).slice(0,5).map(n=>n+answers[n]).join(' '))
    gabaritos.usg_2020 = answers
  } catch(e) { console.log('USG 2020 FAILED:', e.message) }
  
  // USG 2022 Gin-Obs
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\USG\\2022\\Gabarito-Ginecologia-Obstetricia-2022.pdf')
    const answers = parseSpacedGabarito(text)
    console.log('USG 2022 Gin-Obs:', Object.keys(answers).length, 'answers, sample:', Object.keys(answers).slice(0,5).map(n=>n+answers[n]).join(' '))
    gabaritos.usg_2022 = answers
  } catch(e) { console.log('USG 2022 FAILED:', e.message) }
  
  // USG 2023 May & June
  try {
    const may = await extractTextFromPDF(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf')
    gabaritos.usg_2023_may = parseSpacedGabarito(may)
    console.log('USG 2023 May:', Object.keys(gabaritos.usg_2023_may).length, 'answers')
    
    const june = await extractTextFromPDF(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-junho-2023.pdf')
    gabaritos.usg_2023_june = parseSpacedGabarito(june)
    console.log('USG 2023 June:', Object.keys(gabaritos.usg_2023_june).length, 'answers')
  } catch(e) { console.log('USG 2023 FAILED:', e.message) }
  
  // USG 2025 (small PDF, check contents)
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf')
    const answers = parseSpacedGabarito(text)
    console.log('USG 2025:', Object.keys(answers).length, 'answers')
    if (Object.keys(answers).length > 0) gabaritos.usg_2025 = answers
    else {
      // Try dense
      const dense = parseDenseGabarito(text)
      console.log('  Dense:', Object.keys(dense).length, 'answers')
      if (Object.keys(dense).length > 0) gabaritos.usg_2025 = dense
    }
  } catch(e) { console.log('USG 2025 FAILED:', e.message) }
  
  // RDDI 2019
  try {
    const gabAnual = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2019\\Gabarito-Avaliacao-Anual-2019.pdf')
    gabaritos.rddi_2019_anual = parseSpacedGabarito(gabAnual)
    console.log('RDDI 2019 Anual:', Object.keys(gabaritos.rddi_2019_anual).length, 'answers')
    
    const gabTP = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2019\\Gabarito-Prova-Titulo-2019.pdf')
    gabaritos.rddi_2019_tp = parseSpacedGabarito(gabTP)
    console.log('RDDI 2019 TP:', Object.keys(gabaritos.rddi_2019_tp).length, 'answers')
  } catch(e) { console.log('RDDI 2019 FAILED:', e.message) }
  
  // RDDI 2020
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2020\\Gabarito-2020-v2.pdf')
    const answers = parseSpacedGabarito(text)
    console.log('RDDI 2020:', Object.keys(answers).length, 'answers, sample:', Object.keys(answers).slice(0,5).map(n=>n+answers[n]).join(' '))
    gabaritos.rddi_2020 = answers
  } catch(e) { console.log('RDDI 2020 FAILED:', e.message) }
  
  // RDDI 2023
  try {
    const gabTP = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2023\\Gabarito-Teorico-Pratica-2023.pdf')
    gabaritos.rddi_2023_tp = parseSpacedGabarito(gabTP)
    console.log('RDDI 2023 TP:', Object.keys(gabaritos.rddi_2023_tp).length, 'answers, sample:', Object.keys(gabaritos.rddi_2023_tp).slice(0,5).map(n=>n+gabaritos.rddi_2023_tp[n]).join(' '))
    
    const gabGeral = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2023\\Gabarito-Geral-2023.pdf')
    gabaritos.rddi_2023_geral = parseSpacedGabarito(gabGeral)
    console.log('RDDI 2023 Geral:', Object.keys(gabaritos.rddi_2023_geral).length, 'answers, sample:', Object.keys(gabaritos.rddi_2023_geral).slice(0,5).map(n=>n+gabaritos.rddi_2023_geral[n]).join(' '))
  } catch(e) { console.log('RDDI 2023 FAILED:', e.message) }
  
  // RDDI 2024
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')
    const answers = parsePage62Gabarito(text)
    console.log('RDDI 2024:', Object.keys(answers).length, 'answers, sample:', Object.keys(answers).slice(0,5).map(n=>n+answers[n]).join(' '))
    gabaritos.rddi_2024 = answers
  } catch(e) { console.log('RDDI 2024 FAILED:', e.message) }
  
  // RDDI 2025
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')
    const answers = parseSpacedGabarito(text)
    console.log('RDDI 2025:', Object.keys(answers).length, 'answers, sample:', Object.keys(answers).slice(0,5).map(n=>n+answers[n]).join(' '))
    gabaritos.rddi_2025 = answers
  } catch(e) { console.log('RDDI 2025 FAILED:', e.message) }
  
  console.log('\n=== Step 2: Build all questions ===\n')
  
  const allQuestions = []
  
  // RDDI 2024 (v2 JSON with images)
  const v2 = loadJsonWithGabarito(OUT + '\\cbr_rddi_2024_with_images_v2.json', gabaritos.rddi_2024, 'CBR RDDI 2024')
  console.log('RDDI 2024 from JSON:', v2.length, 'ingested', v2.filter(q=>q.has_image).length, 'images')
  allQuestions.push(...v2)
  
  // RDDI 2025
  const rddi2025 = loadJsonWithGabarito(OUT + '\\cbr_rddi_2025_with_images.json', gabaritos.rddi_2025, 'CBR RDDI 2025')
  console.log('RDDI 2025 from JSON:', rddi2025.length, 'ingested')
  allQuestions.push(...rddi2025)
  
  // USG 2023 V1 & V2
  const usgV1 = loadJsonWithGabarito(OUT + '\\cbr_usg_2023_v1_with_images.json', gabaritos.usg_2023_may, 'CBR USG 2023 V1')
  console.log('USG 2023 V1:', usgV1.length, 'ingested', usgV1.filter(q=>q.has_image).length, 'images')
  allQuestions.push(...usgV1)
  
  const usgV2 = loadJsonWithGabarito(OUT + '\\cbr_usg_2023_v2_with_images.json', gabaritos.usg_2023_june, 'CBR USG 2023 V2')
  console.log('USG 2023 V2:', usgV2.length, 'ingested', usgV2.filter(q=>q.has_image).length, 'images')
  allQuestions.push(...usgV2)
  
  console.log(`\nTotal from JSON: ${allQuestions.length} (${allQuestions.filter(q=>q.has_image).length} with images)`)
  
  console.log('\n=== Step 3: Delete and re-ingest ===\n')
  
  // Delete all CBR pools
  for (const p of ['RDDI', 'USG']) {
    const r = await deletePool(p)
    console.log(`Deleted ${p}: ${r.status}`)
  }
  
  // Ingest in batches
  const BATCH = 50
  let total = 0
  for (let i = 0; i < allQuestions.length; i += BATCH) {
    const batch = allQuestions.slice(i, i + BATCH)
    const { ok, status: s, body } = await httpPost('challenge_question_pool', batch)
    if (ok) {
      total += batch.length
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.length} ✓ (${total}/${allQuestions.length})`)
    } else {
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ERROR ${s} — ${JSON.stringify(body).slice(0,80)}`)
      // One by one fallback
      for (const q of batch) {
        const r = await httpPost('challenge_question_pool', [q])
        if (r.ok) total++
        else console.log(`  FAIL: ${q.source_title}`)
      }
    }
  }
  
  const imgCount = allQuestions.filter(q => q.has_image).length
  console.log(`\n✅ Final: ${total}/${allQuestions.length} ingested, ${imgCount} with images`)
}

main().catch(e => { console.error(e); process.exit(1) })