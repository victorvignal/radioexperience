/**
 * CBR Final Ingest — Smart merge with correct file paths
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

function loadJSON(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')) } catch { return null }
}

function toArray(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && data.questions) {
    if (Array.isArray(data.questions)) return data.questions
    return Object.values(data.questions)
  }
  if (data && typeof data === 'object') return Object.values(data)
  return []
}

function normalizeOptions(opts) {
  if (!opts || !Array.isArray(opts)) return []
  return opts.map(function(o) {
    if (typeof o === 'string') return o
    const label = o.label || o.option_label || ''
    const text = o.text || o.option_text || ''
    return label + ') ' + text
  }).filter(function(o) { return o.length > 2 })
}

function mergeQuestions(textSource, imgSource) {
  const textQuestions = toArray(textSource)
  const imgQuestions = toArray(imgSource)
  const imgByNum = {}
  for (const q of imgQuestions) {
    const num = q.number || q.question_number
    if (!imgByNum[num]) imgByNum[num] = {}
    if (q.has_image && q.image_base64) {
      imgByNum[num] = { image_base64: q.image_base64, has_image: true }
    }
  }
  const textByNum = {}
  for (const q of textQuestions) {
    textByNum[q.question_number || q.number] = q
  }
  const allNums = new Set([...Object.keys(textByNum), ...Object.keys(imgByNum)])
  const merged = []
  for (const num of allNums) {
    const tq = textByNum[num]
    const iq = imgByNum[num]
    const text = (tq && tq.question_text) || (tq && tq.text) || (iq && iq.text) || ''
    const opts = normalizeOptions((tq && tq.options) || (iq && iq.options))
    const answer = (tq && tq.correct_answer) || (iq && iq.correct_answer) || null
    const imgData = (iq && iq.image_base64) || null
    const hasImg = !!(iq && iq.has_image && imgData)
    if (!answer || !text || text.length < 5) continue
    if (opts.length < 2) continue
    merged.push({
      specialty: 'Geral',
      question_text: text.slice(0, 2000),
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: answer.toUpperCase(),
      explanation: (tq && tq.explanation) || (iq && iq.explanation) || '',
      source_title: 'CBR ' + ((tq && tq.source) || (iq && iq.source) || 'USG') + ' — Questão ' + num,
      difficulty: 'medium',
      image_base64: hasImg ? imgData : null,
      has_image: hasImg,
      times_used: 0,
    })
  }
  return merged.sort(function(a, b) {
    const na = parseInt((a.source_title.match(/Questão (\d+)/) || [])[1] || 0)
    const nb = parseInt((b.source_title.match(/Questão (\d+)/) || [])[1] || 0)
    return na - nb
  })
}

function processSingle(filepath, specialty, year) {
  const data = loadJSON(filepath)
  if (!data) return []
  const questions = toArray(data)
  const processed = []
  for (const q of questions) {
    const num = q.question_number || q.number || 0
    const text = q.question_text || q.text || ''
    const opts = normalizeOptions(q.options)
    const answer = q.correct_answer || null
    const imgBase64 = q.image_base64 || null
    const hasImg = !!(q.has_image && imgBase64)
    if (!answer || !text || text.length < 5) continue
    if (opts.length < 2) continue
    processed.push({
      specialty: specialty || 'Geral',
      question_text: text.slice(0, 2000),
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: answer.toUpperCase(),
      explanation: q.explanation || '',
      source_title: specialty + ' ' + year + ' — Questão ' + num,
      difficulty: 'medium',
      image_base64: hasImg ? imgBase64 : null,
      has_image: hasImg,
      times_used: 0,
    })
  }
  return processed
}

function httpDelete(pathStr, cb) {
  const req = https.request('https://pcdequsipbkxcfsewiow.supabase.co' + pathStr, {
    method: 'DELETE',
    headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
  }, function(res) {
    let d = ''
    res.on('data', function(c) { d += c })
    res.on('end', function() { cb({ status: res.statusCode, body: d }) })
  })
  req.on('error', function(e) { cb({ status: 0, body: e.message }) })
  req.end()
}

function httpPost(body, cb) {
  const data = JSON.stringify(body)
  const req = https.request('https://pcdequsipbkxcfsewiow.supabase.co/rest/v1/challenge_question_pool', {
    method: 'POST',
    headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
  }, function(res) {
    let d = ''
    res.on('data', function(c) { d += c })
    res.on('end', function() { cb({ ok: res.statusCode < 300, status: res.statusCode, body: d }) })
  })
  req.on('error', function(e) { cb({ ok: false, status: 0, body: e.message }) })
  req.write(data)
  req.end()
}

async function ingestToSupabase(questions) {
  const del = await new Promise(function(resolve) {
    httpDelete('/rest/v1/challenge_question_pool?source_title=ilike.*CBR*', resolve)
  })
  console.log('\nDelete:', del.status, del.body || 'OK')

  console.log('\nIngesting ' + questions.length + ' questions...')
  let inserted = 0
  for (let i = 0; i < questions.length; i += 50) {
    const chunk = questions.slice(i, i + 50)
    const result = await new Promise(function(resolve) { httpPost(chunk, resolve) })
    if (result.ok) {
      inserted += chunk.length
      process.stdout.write('  ' + inserted + '/' + questions.length + '\r')
    } else {
      console.error('\nInsert error at ' + i + ': ' + result.status + ' ' + result.body)
    }
  }
  console.log('\nDone! ' + inserted + '/' + questions.length + ' questions ingested.')
}

async function main() {
  console.log('=== CBR Final Ingest ===\n')

  const allQuestions = []

  const r24 = processSingle(path.join(OUT, 'cbr_rddi_2024_with_images_v2.json'), 'Geral', 2024)
  console.log('RDDI 2024: ' + r24.length + ' Q (' + r24.filter(function(q){return q.has_image}).length + ' img)')
  allQuestions.push.apply(allQuestions, r24)

  const r25 = processSingle(path.join(OUT, 'cbr_rddi_2025_with_images.json'), 'Geral', 2025)
  console.log('RDDI 2025: ' + r25.length + ' Q (' + r25.filter(function(q){return q.has_image}).length + ' img)')
  allQuestions.push.apply(allQuestions, r25)

  const r20 = processSingle(path.join(OUT, 'extracted_RDDI_2020.json'), 'Geral', 2020)
  console.log('RDDI 2020: ' + r20.length + ' Q')
  allQuestions.push.apply(allQuestions, r20)

  const u3v1 = mergeQuestions(
    loadJSON(path.join(OUT, 'usg-2023-v1.json')),
    loadJSON(path.join(OUT, 'cbr_usg_2023_v1_with_images.json'))
  )
  console.log('USG 2023 V1: ' + u3v1.length + ' Q (' + u3v1.filter(function(q){return q.has_image}).length + ' img)')
  allQuestions.push.apply(allQuestions, u3v1)

  const u3v2 = mergeQuestions(
    loadJSON(path.join(OUT, 'usg-2023-v2.json')),
    loadJSON(path.join(OUT, 'cbr_usg_2023_v2_with_images.json'))
  )
  console.log('USG 2023 V2: ' + u3v2.length + ' Q (' + u3v2.filter(function(q){return q.has_image}).length + ' img)')
  allQuestions.push.apply(allQuestions, u3v2)

  const u19 = processSingle(path.join(OUT, 'usg-2019.json'), 'USG', 2019)
  console.log('USG 2019: ' + u19.length + ' Q')
  allQuestions.push.apply(allQuestions, u19)

  const total = allQuestions.length
  const withImages = allQuestions.filter(function(q){return q.has_image}).length
  console.log('\n=== TOTAL: ' + total + ' questions | ' + withImages + ' with images ===')

  const outFile = path.join(OUT, 'cbr_final_combined.json')
  fs.writeFileSync(outFile, JSON.stringify(allQuestions, null, 2))
  console.log('Saved (' + Math.round(fs.statSync(outFile).size / 1024) + 'KB)')

  if (process.argv.includes('--ingest')) {
    await ingestToSupabase(allQuestions)
  } else {
    console.log('\n(Run with --ingest to upload to Supabase)')
  }
}

main().catch(console.error)
