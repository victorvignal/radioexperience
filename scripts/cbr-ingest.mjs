/**
 * Re-ingest CBR questions with correct answers from gabarito PDFs.
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_DIR = path.join(__dirname, 'cbr_output')
const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const SUPABASE_URL = 'https://pcdequsipbkxcfsewiow.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

// ── Gabarito parser ────────────────────────────────────────────────────────────

async function parseGabarito(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += ' ' + content.items.map(item => item.str).join('')
  }
  return text
}

async function parseGabaritoRDDI(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += ' ' + content.items.map(item => item.str).join('')
  }

  const answers = {}

  // Try to find "GABARITO" patterns: "01 A", "02 B", etc.
  // Pattern: number followed by single letter A-E
  const matches = [...text.matchAll(/(\d{2})\s+([A-E])\b/g)]
  for (const m of matches) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 200) {
      answers[n] = m[2]
    }
  }

  return { answers, raw: text.slice(0, 500) }
}

// ── Supabase REST ─────────────────────────────────────────────────────────────

function httpPost(table, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = require('https').request(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: JSON.parse(d) }) }
        catch { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: d }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapSpecialty(specialty, topic) {
  const t = (topic || '').toLowerCase()
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

function mapDifficulty(d) {
  const x = (d || '').toLowerCase()
  if (x.includes('básica') || x.includes('easy')) return 'easy'
  if (x.includes('avançada') || x.includes('hard')) return 'hard'
  return 'medium'
}

function formatOptions(opts) {
  if (!opts) return {}
  if (typeof opts[0] === 'string') {
    const out = {}
    for (const o of opts) {
      const letter = o.charAt(0).toUpperCase()
      const text = o.substring(3).trim()
      out[letter] = text
    }
    return out
  }
  return opts
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Parsing gabaritos...')

  // Parse RDDI gabaritos
  const rddiGab2024 = await parseGabaritoRDDI(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')
  const rddiGab2025 = await parseGabaritoRDDI(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')

  console.log(`RDDI 2024 gabarito: ${Object.keys(rddiGab2024.answers).length} answers found`)
  console.log(`RDDI 2025 gabarito: ${Object.keys(rddiGab2025.answers).length} answers found`)
  console.log('RDDI 2024 sample:', rddiGab2024.raw.slice(0, 200))
  console.log('RDDI 2025 sample:', rddiGab2025.raw.slice(0, 200))

  const gabaritos = {
    'may_2023': CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf',
    'june_2023': CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-junho-2023.pdf',
  }

  const gabAnswers = {}
  for (const [key, filePath] of Object.entries(gabaritos)) {
    try {
      const text = await parseGabarito(filePath)
      const answers = {}
      const p1 = [...text.matchAll(/(\d+)\s+(ANULADA|[A-E])/g)]
      for (const m of p1) {
        const n = parseInt(m[1])
        if (n >= 1 && n <= 200) answers[n] = m[2]
      }
      gabAnswers[key] = answers
      const valid = Object.keys(answers).filter(k => !String(k).startsWith('TP') && answers[k] !== 'ANULADA')
      console.log(`${key}: ${valid.length} valid`)
    } catch (e) {
      console.error(`Failed to parse ${key}: ${e.message}`)
    }
  }

  const cbrFiles = [
    { file: 'cbr_rddi_2025_with_images.json', gab: rddiGab2025.answers, year: '2025', specialty: 'RDDI' },
    { file: 'cbr_rddi_2024_with_images.json', gab: rddiGab2024.answers, year: '2024', specialty: 'RDDI' },
    { file: 'cbr_usg_2023_v1_with_images.json', gabKey: 'may_2023', year: '2023', specialty: 'USG', version: 'V1' },
    { file: 'cbr_usg_2023_v2_with_images.json', gabKey: 'june_2023', year: '2023', specialty: 'USG', version: 'V2' },
  ]

  const allToIngest = []

  for (const entry of cbrFiles) {
    const { file, gab, gabKey, year, specialty, version } = entry
    const filePath = path.join(CBR_DIR, file)
    if (!fs.existsSync(filePath)) { console.error('Missing: ' + file); continue }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const gabSource = gab || (gabKey ? gabAnswers[gabKey] : null)

    for (const q of (data.questions || [])) {
      let correctAnswer = q.correct_answer

      if (gabSource) {
        const qNum = parseInt(q.number)
        const fromGab = gabSource[qNum]
        if (fromGab && /^[A-E]$/.test(fromGab)) {
          correctAnswer = fromGab
          q.correct_answer = fromGab
        }
      }

      if (!correctAnswer || !/^[A-E]$/.test(correctAnswer)) continue

      const label = `CBR ${specialty} ${year}${version ? ' ' + version : ''}`
      allToIngest.push({
        specialty: mapSpecialty(specialty, q.topics?.[0] || q.topic),
        question_text: q.text,
        question_type: 'multiple_choice',
        options: formatOptions(q.options),
        correct_answer: correctAnswer,
        explanation: `${label} Q${q.number}. ${q.explanation || ''}`.trim(),
        source_title: `${label} — Questão ${q.number}`,
        difficulty: mapDifficulty(q.difficulty),
        image_base64: q.has_image ? (q.image_base64 || null) : null,
        has_image: q.has_image || false,
        times_used: 0,
      })
    }
    const withAnswer = (data.questions || []).filter(q => q.correct_answer && /^[A-E]$/.test(q.correct_answer)).length
    console.log(`${file}: ${data.questions?.length} loaded, ${withAnswer} with valid answer`);
  }

  // Delete old CBR questions
  console.log('Deleting old CBR from challenge_questions...')
  {
    const { status, body } = await new Promise((resolve) => {
      const req = require('https').request(`${SUPABASE_URL}/rest/v1/challenge_questions?pool_id=not.is.null&source_title=ilike.*CBR*`, {
        method: 'DELETE',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      }, res => {
        let d = ''
        res.on('data', c => d += c)
        res.on('end', () => resolve({ status: res.statusCode, body: d }))
      })
      req.on('error', e => resolve({ status: 0, body: e.message }))
      req.end()
    })
    console.log(`Deleted challenge_questions: ${status}`)
  }

  console.log('Deleting old CBR from pool...')
  {
    const { status, body } = await new Promise((resolve) => {
      const req = require('https').request(`${SUPABASE_URL}/rest/v1/challenge_question_pool?source_title=ilike.*CBR*`, {
        method: 'DELETE',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      }, res => {
        let d = ''
        res.on('data', c => d += c)
        res.on('end', () => resolve({ status: res.statusCode, body: d }))
      })
      req.on('error', e => resolve({ status: 0, body: e.message }))
      req.end()
    })
    console.log(`Deleted pool: ${status}`)
  }

  console.log(`\nTotal to ingest: ${allToIngest.length}`)

  const BATCH = 50
  let totalIngested = 0
  for (let i = 0; i < allToIngest.length; i += BATCH) {
    const batch = allToIngest.slice(i, i + BATCH)
    const { ok, status, body } = await httpPost('challenge_question_pool', batch)
    if (ok) {
      totalIngested += batch.length
      console.log(`Batch ${Math.floor(i / BATCH) + 1}: ${batch.length} ✓ (total: ${totalIngested})`)
    } else {
      const msg = typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body || {}).slice(0, 200)
      console.error(`Batch ${Math.floor(i / BATCH) + 1}: ERROR ${status} — ${msg}`)
    }
  }

  console.log(`\n${totalIngested > 0 ? '✅' : '⚠️'} Ingested ${totalIngested}/${allToIngest.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
