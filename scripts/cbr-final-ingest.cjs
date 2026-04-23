/**
 * Final CBR ingest: all questions with gabarito + RDDI 2024 images
 */
const fs = require('fs')
const path = require('path')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const https = require('https')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

// ── Gabarito parsers ──────────────────────────────────────────────────────────

async function gabaritoPage62(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const text = (await (await doc.getPage(doc.numPages)).getTextContent()).items.map(i => i.str).join('')
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
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) text += ' ' + (await (await doc.getPage(i)).getTextContent()).items.map(i => i.str).join('')
  const answers = {}
  const re = /(\d+)([A-E])(?=\d|$)/g, re2 = /(\d{2})\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 200) answers[n] = m[2] }
  if (Object.keys(answers).length === 0) while ((m = re2.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 200) answers[n] = m[2] }
  return answers
}

async function gabaritoGeneral(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) text += ' ' + (await (await doc.getPage(i)).getTextContent()).items.map(i => i.str).join('')
  const answers = {}
  for (const m of text.matchAll(/(\d{2})\s+([A-E])\b/g)) { const n = parseInt(m[1]); if (n >= 1 && n <= 200) answers[n] = m[2] }
  return answers
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function httpPost(table, body) {
  return new Promise(resolve => {
    const data = JSON.stringify(body)
    const req = https.request(`https://pcdequsipbkxcfsewiow.supabase.co/rest/v1/${table}`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: JSON.parse(d) }) } catch { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: d }) } })
    })
    req.on('error', e => resolve({ ok: false, body: e.message }))
    req.write(data)
    req.end()
  })
}

function deletePool() {
  return new Promise(resolve => {
    const req = https.request(`https://pcdequsipbkxcfsewiow.supabase.co/rest/v1/challenge_question_pool?source_title=ilike.*CBR*`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode })) })
    req.on('error', () => resolve({ status: 0 }))
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

function isNonEmptyImage(b64) {
  return b64 && b64.length > 5000
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Parsing gabaritos ===')
  
  const gabaritos = {
    'rddi_2024': await gabaritoPage62(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'),
    'rddi_2023_tp': await gabaritoDense(CBR_BASE + '\\RDDI\\2023\\Gabarito-Teorico-Pratica-2023.pdf'),
    'rddi_2025': await gabaritoDense(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf'),
    'usg_2023_may': await gabaritoGeneral(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf'),
    'usg_2023_june': await gabaritoGeneral(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-junho-2023.pdf'),
  }
  
  for (const [k, v] of Object.entries(gabaritos)) {
    const valid = Object.keys(v).filter(x => /^[A-E]$/.test(v[x])).length
    console.log(`${k}: ${valid} answers`)
  }
  
  // Load RDDI 2024 images (JPEG indices 97-111)
  const imgDir = OUT + '\\jpeg_src'
  const rddiImages = {}
  for (let idx = 97; idx <= 111; idx++) {
    const name = `rddi_2024_jpeg_${String(idx).padStart(3, '0')}.jpg`
    if (fs.existsSync(imgDir + '\\' + name)) {
      const buf = fs.readFileSync(imgDir + '\\' + name)
      rddiImages[idx] = buf.toString('base64')
    }
  }
  console.log('\nRDDI 2024 images loaded:', Object.keys(rddiImages).length)
  
  // Map: Q49-Q60 → JPEG indices 100-111 (offset-order top 12 largest)
  // Actually map by offset order to get the right association
  // JPEG indices 97-111 sorted by offset (same order as file position)
  // Last 12 JPEGs by offset = indices 100-111 (these are the largest, page images)
  const imgMap = {
    49: 101, 50: 102, 51: 100, 52: 98, 53: 97,
    54: 111, 55: 99, 56: 106, 57: 103, 58: 104, 59: 105, 60: 110
  }
  
  // Build questions
  const files = {
    'cbr_rddi_2024_with_images.json': { gab: gabaritos['rddi_2024'], label: 'CBR RDDI 2024' },
    'cbr_rddi_2025_with_images.json': { gab: gabaritos['rddi_2025'], label: 'CBR RDDI 2025' },
    'cbr_usg_2023_v1_with_images.json': { gab: gabaritos['usg_2023_may'], label: 'CBR USG 2023 V1' },
    'cbr_usg_2023_v2_with_images.json': { gab: gabaritos['usg_2023_june'], label: 'CBR USG 2023 V2' },
  }
  
  const allQuestions = []
  
  for (const [file, config] of Object.entries(files)) {
    const data = JSON.parse(fs.readFileSync(OUT + '\\' + file, 'utf8'))
    const questions = data.questions || []
    
    let ingested = 0, withImg = 0
    for (const q of questions) {
      const qNum = parseInt(q.number)
      const gabAnswer = config.gab[qNum]
      const hasValidAnswer = gabAnswer && /^[A-E]$/.test(gabAnswer)
      
      if (!hasValidAnswer) continue
      
      // Check for image in RDDI 2024 last 12
      let hasImage = q.has_image && isNonEmptyImage(q.image_base64)
      let imgB64 = hasImage ? q.image_base64 : null
      
      // For RDDI 2024 Q49-Q60, assign from extracted JPEGs
      if (file === 'cbr_rddi_2024_with_images.json' && imgMap[qNum] && rddiImages[imgMap[qNum]]) {
        imgB64 = rddiImages[imgMap[qNum]]
        hasImage = true
      }
      
      ingested++
      if (hasImage && imgB64) withImg++
      
      allQuestions.push({
        specialty: mapSpecialty(q.specialty || '', q.topics?.[0] || q.topic),
        question_text: q.text,
        question_type: 'multiple_choice',
        options: formatOptions(q.options),
        correct_answer: gabAnswer,
        explanation: q.explanation || '',
        source_title: `${config.label} — Questão ${q.number}`,
        difficulty: 'medium',
        image_base64: imgB64,
        has_image: hasImage && imgB64 ? true : false,
        times_used: 0,
      })
    }
    console.log(`${file}: ${questions.length} Qs → ${ingested} ingested, ${withImg} with images`)
  }
  
  const totalWithImg = allQuestions.filter(q => q.has_image && isNonEmptyImage(q.image_base64)).length
  console.log(`\n=== Total: ${allQuestions.length} questions, ${totalWithImg} with images ===`)
  
  // Delete old and ingest
  console.log('\nDeleting old CBR...')
  const { status } = await deletePool()
  console.log('Deleted:', status)
  
  const BATCH = 50
  let total = 0, failed = 0
  for (let i = 0; i < allQuestions.length; i += BATCH) {
    const batch = allQuestions.slice(i, i + BATCH)
    const { ok, status: s, body } = await httpPost('challenge_question_pool', batch)
    if (ok) {
      total += batch.length
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.length} ✓ (${total})`)
    } else {
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ERROR ${s}`)
      // Try one by one
      for (const q of batch) {
        const r = await httpPost('challenge_question_pool', [q])
        if (r.ok) total++
        else { failed++; console.log(`  FAILED: ${q.source_title} — ${JSON.stringify(r.body).slice(0,60)}`) }
      }
    }
  }
  
  console.log(`\n${total > 0 ? '✅' : '⚠️'} Ingested: ${total} | Failed: ${failed} | With images: ${totalWithImg}`)
}

main().catch(e => { console.error(e); process.exit(1) })