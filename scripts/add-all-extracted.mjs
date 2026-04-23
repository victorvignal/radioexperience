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
  // Load and ingest all extracted files
  const files = fs.readdirSync(OUT).filter(f => f.startsWith('extracted_') && f.endsWith('.json'))
  console.log('Found extracted files:', files.join(', '))
  
  let totalIngested = 0
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(OUT + '\\' + file, 'utf8'))
    const label = file.replace('extracted_', '').replace('.json', '').replace(/_/g, ' ')
    
    const questions = []
    for (const q of data.questions || []) {
      if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
      const opts = formatOptions(q.options)
      questions.push({
        specialty: 'Geral',
        question_text: q.text || '',
        question_type: 'multiple_choice',
        options: opts,
        correct_answer: q.correct_answer,
        explanation: q.explanation || '',
        source_title: 'CBR ' + label + ' — Questão ' + q.number,
        difficulty: q.difficulty || 'medium',
        image_base64: null,
        has_image: false,
        times_used: 0,
      })
    }
    
    if (questions.length === 0) {
      console.log(file + ': 0 questions to ingest')
      continue
    }
    
    console.log(file + ': ' + questions.length + ' questions')
    
    // Ingest in batches of 50
    for (let i = 0; i < questions.length; i += 50) {
      const batch = questions.slice(i, i + 50)
      const r = await httpPost(batch)
      if (r.ok) {
        console.log('  Batch ' + (Math.floor(i/50)+1) + ': ' + batch.length + ' ✓')
      } else {
        console.log('  Batch ' + (Math.floor(i/50)+1) + ': ERROR ' + r.status + ' — individual fallback')
        for (const q of batch) {
          const r2 = await httpPost([q])
          if (r2.ok) totalIngested++
        }
      }
    }
    totalIngested += questions.length
  }
  
  console.log('\n✅ Total additional ingested:', totalIngested)
}

main().catch(console.error)