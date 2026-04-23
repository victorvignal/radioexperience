/**
 * Full pipeline: extract all CBR questions, parse gabaritos, ingest with images
 */
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

// ── Gabarito parsers ──────────────────────────────────────────────────────────

async function gabaritoPage62(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const page = await doc.getPage(doc.numPages)
  const text = (await page.getTextContent()).items.map(i => i.str).join('')
  
  const answers = {}
  const raw = text.slice(text.indexOf('Gabarito') + 8).replace(/\s+/g, ' ').trim()
  let i = 0
  while (i < raw.length) {
    let numStr = '', letter
    while (i < raw.length && raw[i] >= '0' && raw[i] <= '9') numStr += raw[i++]
    while (i < raw.length && raw[i] === ' ') i++
    letter = raw[i++]
    if (numStr && letter && letter >= 'A' && letter <= 'Z') {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 200) answers[n] = letter
    }
    while (i < raw.length && raw[i] === ' ') i++
  }
  return answers
}

async function gabaritoDense(pdfPath) {
  // For PDFs where answers are densely packed without clear separators
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    text += ' ' + (await (await doc.getPage(i)).getTextContent()).items.map(i => i.str).join('')
  }
  
  const answers = {}
  
  // Try dense pattern: number immediately followed by letter (no space)
  // e.g. "1A2B3C" or "31E32C33E"
  const re1 = /(\d+)([A-E])(?=\d|$)/g
  let m
  while ((m = re1.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 200) answers[n] = m[2]
  }
  
  // If still empty, try spaced pattern
  if (Object.keys(answers).length === 0) {
    for (const n of text.matchAll(/(\d{2})\s+([A-E])\b/g)) {
      const num = parseInt(n[1])
      if (num >= 1 && num <= 200) answers[num] = n[2]
    }
  }
  
  return answers
}

async function gabaritoGeneral(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    text += ' ' + (await (await doc.getPage(i)).getTextContent()).items.map(i => i.str).join('')
  }
  
  const answers = {}
  
  // First try standard spaced pattern "01 A", "02 B"
  for (const n of text.matchAll(/(\d{2})\s+([A-E])\b/g)) {
    const num = parseInt(n[1])
    if (num >= 1 && num <= 200) answers[num] = n[2]
  }
  
  // If empty, try dense
  if (Object.keys(answers).length === 0) {
    const re = /(\d+)([A-E])(?=\d|$)/g
    let m
    while ((m = re.exec(text)) !== null) {
      const num = parseInt(m[1])
      if (num >= 1 && num <= 200) answers[num] = m[2]
    }
  }
  
  return answers
}

// ── Supabase REST ─────────────────────────────────────────────────────────────

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

function deletePool() {
  return new Promise((resolve) => {
    const req = require('https').request(`${SUPABASE_URL}/rest/v1/challenge_question_pool?source_title=ilike.*CBR*`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode })) })
    req.on('error', e => resolve({ status: 0 }))
    req.end()
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapSpecialty(t) {
  t = (t || '').toLowerCase()
  if (t.includes('mama')) return 'Mama'
  if (t.includes('neuro') || t.includes('cérebro')) return 'Neurorradiologia'
  if (t.includes('torax') || t.includes('pulmão')) return 'Tórax'
  if (t.includes('abdome') || t.includes('fígado') || t.includes('renal')) return 'Abdome'
  if (t.includes('vascular') || t.includes('aorta')) return 'Vascular'
  if (t.includes('msk') || t.includes('óssea') || t.includes('fratura')) return 'Musculoesquelético'
  if (t.includes('pediatria')) return 'Pediatria'
  if (t.includes('medicina nuclear') || t.includes('cintilografia')) return 'Medicina Nuclear'
  return 'Geral'
}

function formatOptions(opts) {
  if (!opts) return {}
  if (typeof opts[0] === 'string') {
    const out = {}
    for (const o of opts) {
      const letter = o.charAt(0).toUpperCase()
      out[letter] = o.substring(3).trim()
    }
    return out
  }
  return opts
}

function mapDifficulty(d) {
  const x = (d || '').toLowerCase()
  if (x.includes('básica') || x.includes('easy')) return 'easy'
  if (x.includes('avançada') || x.includes('hard')) return 'hard'
  return 'medium'
}

function isNonEmptyImage(b64) {
  return b64 && b64.length > 5000
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Parsing all gabaritos ===')
  
  const gabaritos = {}
  
  // RDDI 2024 - 60 answers on page 62
  try {
    gabaritos['rddi_2024'] = await gabaritoPage62(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')
    console.log('RDDI 2024:', Object.keys(gabaritos['rddi_2024']).length, 'answers')
  } catch(e) { console.log('RDDI 2024 FAILED:', e.message) }
  
  // RDDI 2023 TP
  try {
    gabaritos['rddi_2023_tp'] = await gabaritoDense(CBR_BASE + '\\RDDI\\2023\\Gabarito-Teorico-Pratica-2023.pdf')
    console.log('RDDI 2023 TP:', Object.keys(gabaritos['rddi_2023_tp']).length, 'answers')
  } catch(e) { console.log('RDDI 2023 TP FAILED:', e.message) }
  
  // RDDI 2025
  try {
    gabaritos['rddi_2025'] = await gabaritoDense(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')
    console.log('RDDI 2025:', Object.keys(gabaritos['rddi_2025']).length, 'answers')
  } catch(e) { console.log('RDDI 2025 FAILED:', e.message) }
  
  // USG 2023
  try {
    gabaritos['usg_2023_may'] = await gabaritoGeneral(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf')
    gabaritos['usg_2023_june'] = await gabaritoGeneral(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-junho-2023.pdf')
    console.log('USG May:', Object.keys(gabaritos['usg_2023_may']).length, '| USG June:', Object.keys(gabaritos['usg_2023_june']).length)
  } catch(e) { console.log('USG FAILED:', e.message) }
  
  // RDDI 2023 Geral
  try {
    gabaritos['rddi_2023_geral'] = await gabaritoGeneral(CBR_BASE + '\\RDDI\\2023\\Gabarito-Geral-2023.pdf')
    console.log('RDDI 2023 Geral:', Object.keys(gabaritos['rddi_2023_geral']).length, 'answers')
  } catch(e) { console.log('RDDI 2023 Geral FAILED:', e.message) }
  
  console.log('\n=== Loading JSON files ===')
  
  const jsonFiles = {
    'cbr_rddi_2024_with_images.json': { gab: gabaritos['rddi_2024'], label: 'CBR RDDI 2024' },
    'cbr_rddi_2025_with_images.json': { gab: gabaritos['rddi_2025'], label: 'CBR RDDI 2025' },
    'cbr_usg_2023_v1_with_images.json': { gab: gabaritos['usg_2023_may'], label: 'CBR USG 2023 V1' },
    'cbr_usg_2023_v2_with_images.json': { gab: gabaritos['usg_2023_june'], label: 'CBR USG 2023 V2' },
  }
  
  // Also load the RDDI 2024 questions extracted earlier (which may have different numbering)
  // Load both the old extraction and new one
  const allQuestions = []
  
  for (const [file, config] of Object.entries(jsonFiles)) {
    const filePath = path.join(OUT, file)
    if (!fs.existsSync(filePath)) { console.log('Missing:', file); continue }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const questions = data.questions || []
    
    let ingested = 0, withImg = 0
    for (const q of questions) {
      const qNum = parseInt(q.number)
      const gabAnswer = config.gab ? config.gab[qNum] : null
      const hasValidAnswer = gabAnswer && /^[A-E]$/.test(gabAnswer)
      const hasImage = isNonEmptyImage(q.image_base64)
      
      if (!hasValidAnswer) continue
      
      if (hasImage) withImg++
      ingested++
      
      allQuestions.push({
        specialty: mapSpecialty(q.specialty || '', q.topics?.[0] || q.topic),
        question_text: q.text,
        question_type: 'multiple_choice',
        options: formatOptions(q.options),
        correct_answer: gabAnswer,
        explanation: q.explanation || '',
        source_title: `${config.label} — Questão ${q.number}`,
        difficulty: mapDifficulty(q.difficulty),
        image_base64: hasImage ? q.image_base64 : null,
        has_image: hasImage,
        times_used: 0,
      })
    }
    
    console.log(`${file}: ${questions.length} Qs → ${ingested} ingested, ${withImg} with images`)
  }
  
  // Also load RDDI 2023 questions if we have them
  const rddi2023Path = path.join(OUT, 'cbr_rddi_2023_with_images.json')
  if (fs.existsSync(rddi2023Path)) {
    const data = JSON.parse(fs.readFileSync(rddi2023Path, 'utf8'))
    const questions = data.questions || []
    console.log(`\nRDDI 2023 JSON: ${questions.length} questions`)
    
    // Try RDDI 2023 Geral first (60 questions)
    const gab = gabaritos['rddi_2023_geral']
    if (gab && Object.keys(gab).length > 0) {
      for (const q of questions) {
        const qNum = parseInt(q.number)
        const gabAnswer = gab[qNum]
        const hasValidAnswer = gabAnswer && /^[A-E]$/.test(gabAnswer)
        const hasImage = isNonEmptyImage(q.image_base64)
        if (!hasValidAnswer) continue
        
        allQuestions.push({
          specialty: mapSpecialty(q.specialty || ''),
          question_text: q.text,
          question_type: 'multiple_choice',
          options: formatOptions(q.options),
          correct_answer: gabAnswer,
          explanation: q.explanation || '',
          source_title: `CBR RDDI 2023 — Questão ${q.number}`,
          difficulty: mapDifficulty(q.difficulty),
          image_base64: hasImage ? q.image_base64 : null,
          has_image: hasImage,
          times_used: 0,
        })
      }
      console.log(`RDDI 2023: +${questions.length} from JSON`)
    }
  }
  
  console.log(`\n=== Total: ${allQuestions.length} questions (${allQuestions.filter(q => q.has_image).length} with images) ===`)
  
  // Delete and re-ingest
  console.log('\nDeleting old CBR pools...')
  const { status } = await deletePool()
  console.log('Deleted:', status)
  
  const BATCH = 50
  let total = 0
  for (let i = 0; i < allQuestions.length; i += BATCH) {
    const batch = allQuestions.slice(i, i + BATCH)
    const { ok, status: s, body } = await httpPost('challenge_question_pool', batch)
    if (ok) {
      total += batch.length
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.length} ✓ (${total}/${allQuestions.length})`)
    } else {
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ERROR ${s} — ${JSON.stringify(body).slice(0, 80)}`)
      // Try one by one
      for (const q of batch) {
        const r = await httpPost('challenge_question_pool', [q])
        if (r.ok) total++
        else console.log(`  FAILED ${q.source_title}: ${JSON.stringify(r.body).slice(0, 60)}`)
      }
    }
  }
  
  const finalCheck = allQuestions.filter(q => q.has_image).length
  console.log(`\n${total > 0 ? '✅' : '⚠️'} Ingested ${total}/${allQuestions.length} (${finalCheck} with images)`)
}

main().catch(e => { console.error(e); process.exit(1) })