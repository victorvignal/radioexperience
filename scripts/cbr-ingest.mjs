/**
 * Re-ingest CBR questions with correct answers from gabarito PDFs.
 * Reads cbr_output JSON + parses gabarito PDFs + upserts to Supabase
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

  const answers = {}
  const t1 = text.indexOf('GABARITO PROVA TEÓRICAQT. Gabarito')
  const t2 = text.indexOf('GABARITO PROVA TEÓRICO-PRÁTICA')

  if (t1 >= 0) {
    const block = text.slice(t1, t2 > t1 ? t2 : text.length)
    const p1 = [...block.matchAll(/(\d+)\s+(ANULADA|[A-E])/g)]
    for (const m of p1) {
      const n = parseInt(m[1])
      if (n >= 1 && n <= 200) answers[n] = m[2]
    }
  }
  if (t2 >= 0) {
    const block = text.slice(t2)
    const p1 = [...block.matchAll(/(\d+)\s+(ANULADA|[A-E])/g)]
    for (const m of p1) {
      const n = parseInt(m[1])
      if (n >= 1 && n <= 20) answers['TP' + n] = m[2]
    }
  }

  return answers
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

  const gabaritos = {
    'may_2023': CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf',
    'june_2023': CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-junho-2023.pdf',
  }

  const gabAnswers = {}
  for (const [key, filePath] of Object.entries(gabaritos)) {
    try {
      gabAnswers[key] = await parseGabarito(filePath)
      const valid = Object.keys(gabAnswers[key]).filter(k => !String(k).startsWith('TP') && gabAnswers[key][k] !== 'ANULADA')
      const anuladas = Object.keys(gabAnswers[key]).filter(k => gabAnswers[key][k] === 'ANULADA')
      console.log(`${key}: ${valid.length} valid, ${anuladas.length} cancelled, TP=${Object.keys(gabAnswers[key]).filter(k => String(k).startsWith('TP')).length}`)
    } catch (e) {
      console.error(`Failed to parse ${key}: ${e.message}`)
    }
  }

  const cbrFiles = [
    { file: 'cbr_rddi_2025_with_images.json', gabKey: null, version: null },
    { file: 'cbr_rddi_2024_with_images.json', gabKey: null, version: null },
    { file: 'cbr_usg_2023_v1_with_images.json', gabKey: 'may_2023', version: 'V1' },
    { file: 'cbr_usg_2023_v2_with_images.json', gabKey: 'june_2023', version: 'V2' },
  ]

  const allToIngest = []

  for (const { file, gabKey, version } of cbrFiles) {
    const filePath = path.join(CBR_DIR, file)
    if (!fs.existsSync(filePath)) { console.error('Missing: ' + file); continue }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const gab = gabKey ? gabAnswers[gabKey] : null
    // year and specialty are TOP-LEVEL fields in the JSON, not per-question
    const year = data.year
    const specialtyRoot = data.specialty  // e.g. 'RDDI' or 'USG'

    for (const q of (data.questions || [])) {
      let correctAnswer = q.correct_answer
      if (gab) {
        correctAnswer = gab[parseInt(q.number)] || q.correct_answer || null
        if (correctAnswer && /^[A-E]$/.test(correctAnswer)) q.correct_answer = correctAnswer
      }

      if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue

      const label = `CBR ${specialtyRoot} ${year}${version ? ' ' + version : ''}`
      allToIngest.push({
        specialty: mapSpecialty(specialtyRoot, q.topics?.[0] || q.topic),
        question_text: q.text,
        question_type: 'multiple_choice',
        options: formatOptions(q.options),
        correct_answer: q.correct_answer,
        explanation: `${label} Q${q.number}. ${q.explanation || ''}`.trim(),
        source_title: `${label} — Questão ${q.number}`,
        image_base64: q.has_image ? (q.image_base64 || null) : null,
        difficulty: mapDifficulty(q.difficulty),
        times_used: 0,
      })
    }
    const withAnswer = (data.questions || []).filter(q => q.correct_answer && /^[A-E]$/.test(q.correct_answer)).length
    console.log(`${file}: ${data.questions?.length} loaded, ${withAnswer} with valid answer`)
  }

  console.log(`\nTotal to ingest: ${allToIngest.length}`)

  // Ingest in batches
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
