import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const SUPABASE_URL = 'https://pcdequsipbkxcfsewiow.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

const jpegDir = __dirname + '\\cbr_output\\jpeg_src'

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

// Load RDDI 2024 JPEG file by index
function loadJpeg(idx) {
  // Try both _NNN.jpg and _NNN_offNNNNNN.jpg formats
  const base = jpegDir + '\\rddi_2024_jpeg_' + String(idx).padStart(3, '0')
  for (const suffix of ['', '_off']) {
    try {
      // Find first matching file
      const files = fs.readdirSync(jpegDir).filter(f => f.startsWith('rddi_2024_jpeg_' + String(idx).padStart(3, '0') + (suffix ? '_off' : '.')) && f.endsWith('.jpg'))
      if (files.length > 0) {
        const data = fs.readFileSync(jpegDir + '\\' + files[0])
        if (data.length > 5000) return data.toString('base64')
      }
    } catch {}
  }
  return null
}

// Try to load JPEG by multiple possible index formats
function findJpeg(idx) {
  const padded = String(idx).padStart(3, '0')
  try {
    const files = fs.readdirSync(jpegDir).filter(f => f.startsWith('rddi_2024_jpeg_' + padded + '.jpg'))
    if (files.length > 0) {
      const data = fs.readFileSync(jpegDir + '\\' + files[0])
      return data.toString('base64')
    }
    // Try offset format
    const offFiles = fs.readdirSync(jpegDir).filter(f => f.startsWith('rddi_2024_jpeg_' + padded + '_off'))
    if (offFiles.length > 0) {
      const data = fs.readFileSync(jpegDir + '\\' + offFiles[0])
      return data.toString('base64')
    }
  } catch {}
  return null
}

// Parse RDDI 2024 gabarito from PDF page 62
async function parseRddi2024Gabarito() {
  const pdfPath = CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  // Page 62 = last page
  const page = await doc.getPage(doc.numPages)
  const content = await page.getTextContent()
  const text = content.items.map(i => i.str).join('')
  
  // Find "Questão Gabarito" pattern
  const idx = text.indexOf('Questão Gabarito')
  if (idx < 0) { console.log('Questão Gabarito not found'); return {} }
  
  const raw = text.slice(idx + 'Questão Gabarito'.length)
  console.log('Gab raw (first 100):', raw.slice(0, 100).replace(/\s+/g, ' '))
  
  // Parse: number (1-3 digits) followed by space then letter A-E
  const answers = {}
  const re = /(\d+)\s+([A-E])/g
  let m
  while ((m = re.exec(raw)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 200) answers[n] = m[2]
  }
  
  return answers
}

async function main() {
  console.log('=== Parsing RDDI 2024 gabarito ===')
  const gab = await parseRddi2024Gabarito()
  const nums = Object.keys(gab).map(Number).sort((a,b)=>a-b)
  console.log('RDDI 2024 gabarito:', Object.keys(gab).length, 'answers')
  console.log('Sample:', nums.slice(0, 15).map(n => n + gab[n]).join(' '))
  console.log('Last 5:', nums.slice(-5).map(n => n + gab[n]).join(' '))
  
  console.log('\n=== Loading v2 JSON ===')
  const v2Path = __dirname + '\\cbr_output\\cbr_rddi_2024_with_images_v2.json'
  const v2 = JSON.parse(fs.readFileSync(v2Path, 'utf8'))
  console.log('v2 questions:', v2.questions.length)
  
  // Build questions
  const questions = []
  const seen = new Set()
  
  for (const q of v2.questions) {
    const num = parseInt(q.number)
    if (isNaN(num) || seen.has(num)) continue
    seen.add(num)
    
    const answer = gab[num]
    if (!answer || !/^[A-E]$/.test(answer)) {
      // console.log(`  Q${num}: no answer (gab[${num}]=${answer})`)
      continue
    }
    
    const hasImage = isNonEmptyImage(q.image_base64)
    questions.push({
      specialty: 'Geral',
      question_text: q.text,
      question_type: 'multiple_choice',
      options: formatOptions(q.options),
      correct_answer: answer,
      explanation: q.explanation || '',
      source_title: `CBR RDDI 2024 — Questão ${num}`,
      difficulty: 'medium',
      image_base64: hasImage ? q.image_base64 : null,
      has_image: hasImage,
      times_used: 0,
    })
  }
  
  console.log('Matched questions:', questions.length, '| with images:', questions.filter(q=>q.has_image).length)
  
  // Also check for Q49-Q59 that should have images from jpeg_src
  console.log('\n=== Checking JPEG availability ===')
  // Based on previous analysis, Q49-Q59 should be images
  // JPEG indices 97-111 (largest JPEGs) = question images
  // JPEG index 97 → Q49, 98 → Q50, etc.
  // But let's verify what we actually have
  const testIdx = [97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]
  for (const idx of testIdx) {
    const b64 = findJpeg(idx)
    console.log(`  JPEG ${idx}: ${b64 ? b64.length + ' chars' : 'NOT FOUND'}`)
  }
  
  console.log('\n=== Ingesting ===')
  
  // First delete existing RDDI 2024
  const deleteReq = require('https').request(`${SUPABASE_URL}/rest/v1/challenge_question_pool?source_title=ilike.*RDDI*2024*`, {
    method: 'DELETE',
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => console.log('Delete status:', res.statusCode)) })
  deleteReq.on('error', e => console.log('Delete error:', e.message))
  deleteReq.end()
  
  await new Promise(r => setTimeout(r, 500))
  
  // Ingest in batches
  const BATCH = 50
  let total = 0
  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH)
    const { ok, status: s, body } = await httpPost('challenge_question_pool', batch)
    if (ok) {
      total += batch.length
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.length} ✓ (${total}/${questions.length})`)
    } else {
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ERROR ${s}`)
      for (const q of batch) {
        const r = await httpPost('challenge_question_pool', [q])
        if (r.ok) total++
        else console.log(`  FAIL: ${q.source_title}`)
      }
    }
  }
  
  console.log(`\n✅ Ingested: ${total}/${questions.length}, ${questions.filter(q=>q.has_image).length} with images`)
}

main().catch(e => { console.error(e); process.exit(1) })