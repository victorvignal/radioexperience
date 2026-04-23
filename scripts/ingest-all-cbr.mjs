import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const SUPABASE_URL = 'https://pcdequsipbkxcfsewiow.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    text += '\n' + (await page.getTextContent()).items.map(i => i.str).join(' ')
  }
  return text
}

// Match "n A" or "n B" where n is any number of digits, separated by spaces
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

// Match "nA" or "nB" (no space between number and letter)
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

// Merge results preferring the parser with more answers
function mergeGabaritos(a, b) {
  const merged = { ...a }
  for (const [k, v] of Object.entries(b)) {
    if (!merged[k]) merged[k] = v
  }
  return merged
}

// Extract answers from a PDF, trying multiple approaches
async function extractGabarito(pdfPath, approaches = ['spaced', 'dense']) {
  const text = await extractTextFromPDF(pdfPath)
  const results = {}
  
  // Try to find the relevant section
  const gabMatch = text.match(/GABARITO.*$/is) || text.match(/QUESTÕES\s+ALTERNATIVA.*$/is)
  const gabText = gabMatch ? gabMatch[0] : text.slice(-500)
  
  if (approaches.includes('spaced')) {
    results.spaced = parseSpacedGabarito(text)
  }
  if (approaches.includes('dense')) {
    results.dense = parseDenseGabarito(text)
  }
  
  // Pick the one with more answers
  let best = results.spaced || results.dense || {}
  if (results.dense && Object.keys(results.dense).length > Object.keys(best).length) {
    best = results.dense
  }
  
  return best
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

function deletePool(sourcePattern) {
  return new Promise((resolve) => {
    const req = require('https').request(`${SUPABASE_URL}/rest/v1/challenge_question_pool?source_title=ilike.*${encodeURIComponent(sourcePattern)}*`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode })) })
    req.on('error', e => resolve({ status: 0 }))
    req.end()
  })
}

function formatOptions(opts) {
  if (!opts) return {}
  if (typeof opts[0] === 'string') {
    const out = {}
    for (const o of opts) {
      const letter = o.charAt(0).toUpperCase()
      if (letter >= 'A' && letter <= 'E') out[letter] = o.substring(3).trim()
    }
    return out
  }
  return opts
}

function isNonEmptyImage(b64) {
  return b64 && b64.length > 5000
}

function isValidAnswer(a) {
  return a && /^[A-E]$/.test(a)
}

async function main() {
  console.log('=== Parsing all gabaritos ===\n')
  
  const gab = {}
  
  // RDDI 2024 (page 62 format)
  try {
    const text = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')
    const idx = text.indexOf('GABARITO')
    const raw = text.slice(idx + 8).replace(/\s+/g, ' ').trim()
    const answers = {}
    let i = 0
    while (i < raw.length) {
      let numStr = '', letter
      while (i < raw.length && raw[i] >= '0' && raw[i] <= '9') numStr += raw[i++]
      while (i < raw.length && raw[i] === ' ') i++
      letter = raw[i++]
      const n = parseInt(numStr)
        if (n >= 1 && n <= 200 && letter >= 'A' && letter <= 'E') answers[n] = letter
      while (i < raw.length && raw[i] === ' ') i++
    }
    gab.rddi_2024 = answers
    const nums = Object.keys(answers).map(Number).sort((a,b)=>a-b)
    console.log('RDDI 2024:', Object.keys(answers).length, 'answers, sample:', nums.slice(0,10).map(n=>n+answers[n]).join(' '))
  } catch(e) { console.log('RDDI 2024 FAILED:', e.message) }
  
  // RDDI 2025
  try {
    gab.rddi_2025 = await extractGabarito(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')
    const nums = Object.keys(gab.rddi_2025).map(Number).sort((a,b)=>a-b)
    console.log('RDDI 2025:', Object.keys(gab.rddi_2025).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.rddi_2025[n]).join(' '))
  } catch(e) { console.log('RDDI 2025 FAILED:', e.message) }
  
  // RDDI 2023 TP
  try {
    gab.rddi_2023_tp = await extractGabarito(CBR_BASE + '\\RDDI\\2023\\Gabarito-Teorico-Pratica-2023.pdf')
    const nums = Object.keys(gab.rddi_2023_tp).map(Number).sort((a,b)=>a-b)
    console.log('RDDI 2023 TP:', Object.keys(gab.rddi_2023_tp).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.rddi_2023_tp[n]).join(' '))
  } catch(e) { console.log('RDDI 2023 TP FAILED:', e.message) }
  
  // RDDI 2023 Geral
  try {
    gab.rddi_2023_geral = await extractGabarito(CBR_BASE + '\\RDDI\\2023\\Gabarito-Geral-2023.pdf')
    const nums = Object.keys(gab.rddi_2023_geral).map(Number).sort((a,b)=>a-b)
    console.log('RDDI 2023 Geral:', Object.keys(gab.rddi_2023_geral).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.rddi_2023_geral[n]).join(' '))
  } catch(e) { console.log('RDDI 2023 Geral FAILED:', e.message) }
  
  // USG 2018 (answers embedded in prova PDF)
  try {
    gab.usg_2018 = await extractGabarito(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
    const nums = Object.keys(gab.usg_2018).map(Number).sort((a,b)=>a-b)
    console.log('USG 2018:', Object.keys(gab.usg_2018).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.usg_2018[n]).join(' '))
  } catch(e) { console.log('USG 2018 FAILED:', e.message) }
  
  // USG 2019 TP
  try {
    gab.usg_2019_tp = await extractGabarito(CBR_BASE + '\\USG\\2019\\Gabarito-Teorico-Pratica-2019.pdf')
    const nums = Object.keys(gab.usg_2019_tp).map(Number).sort((a,b)=>a-b)
    console.log('USG 2019 TP:', Object.keys(gab.usg_2019_tp).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.usg_2019_tp[n]).join(' '))
  } catch(e) { console.log('USG 2019 TP FAILED:', e.message) }
  
  // USG 2019 USGO
  try {
    gab.usg_2019_usgo = await extractGabarito(CBR_BASE + '\\USG\\2019\\Gabarito-USGO-2019.pdf')
    const nums = Object.keys(gab.usg_2019_usgo).map(Number).sort((a,b)=>a-b)
    console.log('USG 2019 USGO:', Object.keys(gab.usg_2019_usgo).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.usg_2019_usgo[n]).join(' '))
  } catch(e) { console.log('USG 2019 USGO FAILED:', e.message) }
  
  // USG 2020
  try {
    gab.usg_2020 = await extractGabarito(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
    const nums = Object.keys(gab.usg_2020).map(Number).sort((a,b)=>a-b)
    console.log('USG 2020:', Object.keys(gab.usg_2020).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.usg_2020[n]).join(' '))
  } catch(e) { console.log('USG 2020 FAILED:', e.message) }
  
  // USG 2022 Gab
  try {
    gab.usg_2022 = await extractGabarito(CBR_BASE + '\\USG\\2022\\Gabarito-Ginecologia-Obstetricia-2022.pdf')
    const nums = Object.keys(gab.usg_2022).map(Number).sort((a,b)=>a-b)
    console.log('USG 2022:', Object.keys(gab.usg_2022).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.usg_2022[n]).join(' '))
  } catch(e) { console.log('USG 2022 FAILED:', e.message) }
  
  // USG 2023 May & June
  try {
    gab.usg_2023_may = await extractGabarito(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf')
    gab.usg_2023_june = await extractGabarito(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-junho-2023.pdf')
    console.log('USG May 2023:', Object.keys(gab.usg_2023_may).length, 'answers')
    console.log('USG June 2023:', Object.keys(gab.usg_2023_june).length, 'answers')
  } catch(e) { console.log('USG 2023 FAILED:', e.message) }
  
  // USG 2025 Gab
  try {
    gab.usg_2025 = await extractGabarito(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf')
    const nums = Object.keys(gab.usg_2025).map(Number).sort((a,b)=>a-b)
    console.log('USG 2025:', Object.keys(gab.usg_2025).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.usg_2025[n]).join(' '))
  } catch(e) { console.log('USG 2025 FAILED:', e.message) }
  
  // RDDI 2019 Gab
  try {
    gab.rddi_2019_anual = await extractGabarito(CBR_BASE + '\\RDDI\\2019\\Gabarito-Avaliacao-Anual-2019.pdf')
    gab.rddi_2019_tp = await extractGabarito(CBR_BASE + '\\RDDI\\2019\\Gabarito-Prova-Titulo-2019.pdf')
    console.log('RDDI 2019 Anual:', Object.keys(gab.rddi_2019_anual).length, '| RDDI 2019 TP:', Object.keys(gab.rddi_2019_tp).length)
  } catch(e) { console.log('RDDI 2019 FAILED:', e.message) }
  
  // RDDI 2020 Gab
  try {
    gab.rddi_2020 = await extractGabarito(CBR_BASE + '\\RDDI\\2020\\Gabarito-2020-v2.pdf')
    const nums = Object.keys(gab.rddi_2020).map(Number).sort((a,b)=>a-b)
    console.log('RDDI 2020 Gab:', Object.keys(gab.rddi_2020).length, 'answers, sample:', nums.slice(0,10).map(n=>n+gab.rddi_2020[n]).join(' '))
  } catch(e) { console.log('RDDI 2020 FAILED:', e.message) }
  
  console.log('\n=== Loading JSONs and matching with gabaritos ===\n')
  
  const jsonConfigs = {
    'cbr_rddi_2024_with_images_v2.json': { gab: gab.rddi_2024, label: 'CBR RDDI 2024' },
    'cbr_rddi_2025_with_images.json': { gab: gab.rddi_2025, label: 'CBR RDDI 2025' },
    'cbr_usg_2023_v1_with_images.json': { gab: gab.usg_2023_may, label: 'CBR USG 2023 V1' },
    'cbr_usg_2023_v2_with_images.json': { gab: gab.usg_2023_june, label: 'CBR USG 2023 V2' },
  }
  
  const allQuestions = []
  
  for (const [file, cfg] of Object.entries(jsonConfigs)) {
    const fp = OUT + '\\' + file
    if (!fs.existsSync(fp)) { console.log('Missing:', file); continue }
    if (!cfg.gab || Object.keys(cfg.gab).length === 0) { console.log(`${file}: NO GABARITO, skipping`); continue }
    
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'))
    
    // Deduplicate by question number - use first occurrence only
    const seen = new Set()
    let ingested = 0, withImg = 0
    
    for (const q of data.questions || []) {
      const qNum = parseInt(q.number)
      if (isNaN(qNum) || seen.has(qNum)) continue
      seen.add(qNum)
      
      const answer = cfg.gab[qNum]
      if (!isValidAnswer(answer)) continue
      
      const hasImage = isNonEmptyImage(q.image_base64)
      
      allQuestions.push({
        specialty: 'Geral',
        question_text: q.text,
        question_type: 'multiple_choice',
        options: formatOptions(q.options),
        correct_answer: answer,
        explanation: q.explanation || '',
        source_title: `${cfg.label} — Questão ${qNum}`,
        difficulty: 'medium',
        image_base64: hasImage ? q.image_base64 : null,
        has_image: hasImage,
        times_used: 0,
      })
      
      if (hasImage) withImg++
      ingested++
    }
    
    console.log(`${file}: ${data.questions.length} Qs → ${ingested} ingested (${withImg} with images)`)
  }
  
  console.log(`\nTotal: ${allQuestions.length} questions (${allQuestions.filter(q=>q.has_image).length} with images)`)
  
  console.log('\n=== Deleting and ingesting ===\n')
  
  for (const pattern of ['RDDI', 'USG']) {
    const r = await deletePool(pattern)
    console.log(`Deleted ${pattern}: status ${r.status}`)
  }
  
  const BATCH = 50
  let total = 0
  for (let i = 0; i < allQuestions.length; i += BATCH) {
    const batch = allQuestions.slice(i, i + BATCH)
    const { ok, status: s, body } = await httpPost('challenge_question_pool', batch)
    if (ok) {
      total += batch.length
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.length} ✓ (${total}/${allQuestions.length})`)
    } else {
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ERROR ${s} — ${JSON.stringify(body).slice(0,100)}`)
      for (const q of batch) {
        const r = await httpPost('challenge_question_pool', [q])
        if (r.ok) total++
        else console.log(`  FAIL: ${q.source_title}`)
      }
    }
  }
  
  const imgCount = allQuestions.filter(q => q.has_image).length
  console.log(`\n✅ Ingested: ${total}/${allQuestions.length}, ${imgCount} with images`)
}

main().catch(e => { console.error(e); process.exit(1) })