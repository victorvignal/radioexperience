import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const https = require('https')
const fs = require('fs')

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

function httpPost(body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const req = https.request('https://pcdequsipbkxcfsewiow.supabase.co/rest/v1/challenge_question_pool', {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
    }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: d }) })
    })
    req.on('error', e => resolve({ ok: false, status: 0, body: e.message }))
    req.write(data)
    req.end()
  })
}

function formatOptions(opts) {
  if (!opts || !Array.isArray(opts)) return {}
  const out = {}
  for (const o of opts) {
    if (typeof o !== 'string') continue
    const letter = o.charAt(0).toUpperCase()
    if (letter >= 'A' && letter <= 'E') out[letter] = o.substring(3).trim()
  }
  return out
}

async function main() {
  // Load extracted RDDI 2020
  const r2020 = JSON.parse(fs.readFileSync(OUT + '\\extracted_RDDI_2020.json', 'utf8'))
  console.log('RDDI 2020:', r2020.questions.length, 'questions')
  
  // Load extracted RDDI 2019
  const r2019 = JSON.parse(fs.readFileSync(OUT + '\\extracted_RDDI_2019.json', 'utf8'))
  console.log('RDDI 2019:', r2019.questions.length, 'questions')
  
  const allQuestions = []
  
  // RDDI 2020 - 97 Qs
  for (const q of r2020.questions) {
    if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral',
      question_text: q.text || '',
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: q.correct_answer,
      explanation: q.explanation || '',
      source_title: 'CBR RDDI 2020 — Questão ' + q.number,
      difficulty: q.difficulty || 'medium',
      image_base64: null,
      has_image: false,
      times_used: 0,
    })
  }
  
  // RDDI 2019 - 1 Q
  for (const q of r2019.questions) {
    if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral',
      question_text: q.text || '',
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: q.correct_answer,
      explanation: q.explanation || '',
      source_title: 'CBR RDDI 2019 — Questão ' + q.number,
      difficulty: q.difficulty || 'medium',
      image_base64: null,
      has_image: false,
      times_used: 0,
    })
  }
  
  console.log('Total to ingest:', allQuestions.length)
  
  // Ingest in batches
  const BATCH = 50
  let total = 0
  for (let i = 0; i < allQuestions.length; i += BATCH) {
    const batch = allQuestions.slice(i, i + BATCH)
    const r = await httpPost(batch)
    if (r.ok) {
      total += batch.length
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.length} ✓ (${total}/${allQuestions.length})`)
    } else {
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ERROR ${r.status} — individual fallback`)
      for (const q of batch) {
        const r2 = await httpPost([q])
        if (r2.ok) total++
      }
    }
  }
  console.log(`\n✅ ${total} additional questions ingested`)
}

main().catch(console.error)