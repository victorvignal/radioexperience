/**
 * Clean CBR ingest — deletes ALL CBR pools then re-ingests fresh
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
  for (var qi = 0; qi < imgQuestions.length; qi++) {
    var q = imgQuestions[qi]
    var num = q.number || q.question_number
    if (!imgByNum[num]) imgByNum[num] = {}
    if (q.has_image && q.image_base64) {
      imgByNum[num] = { image_base64: q.image_base64, has_image: true }
    }
  }
  var textByNum = {}
  for (var ti = 0; ti < textQuestions.length; ti++) {
    var tq2 = textQuestions[ti]
    textByNum[tq2.question_number || tq2.number] = tq2
  }
  var allNums = new Set([].concat(Object.keys(textByNum), Object.keys(imgByNum)))
  var merged = []
  allNums.forEach(function(num) {
    var tq = textByNum[num]
    var iq = imgByNum[num]
    var text = (tq && tq.question_text) || (tq && tq.text) || (iq && iq.text) || ''
    var opts = normalizeOptions((tq && tq.options) || (iq && iq.options))
    var answer = (tq && tq.correct_answer) || (iq && iq.correct_answer) || null
    var imgData = (iq && iq.image_base64) || null
    var hasImg = !!(iq && iq.has_image && imgData)
    if (!answer || !text || text.length < 5) return
    if (opts.length < 2) return
    merged.push({
      specialty: 'Geral',
      question_text: text.slice(0, 2000),
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: answer.toUpperCase(),
      explanation: (tq && tq.explanation) || (iq && iq.explanation) || '',
      source_title: 'CBR ' + ((tq && tq.source) || (iq && iq.source) || 'RDDI') + ' — Questão ' + num,
      difficulty: 'medium',
      image_base64: hasImg ? imgData : null,
      has_image: hasImg,
      times_used: 0,
    })
  })
  return merged
}

function processSingle(filepath, specialty, year) {
  var data = loadJSON(filepath)
  if (!data) return []
  var questions = toArray(data)
  var processed = []
  for (var qi = 0; qi < questions.length; qi++) {
    var q = questions[qi]
    var num = q.question_number || q.number || 0
    var text = q.question_text || q.text || ''
    var opts = normalizeOptions(q.options)
    var answer = q.correct_answer || null
    var imgBase64 = q.image_base64 || null
    var hasImg = !!(q.has_image && imgBase64)
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

function httpReq(method, pathStr, body, cb) {
  var data = body ? JSON.stringify(body) : null
  var headers = { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
  if (data) headers['Content-Type'] = 'application/json'
  if (method === 'POST') headers['Prefer'] = 'resolution=merge-duplicates'
  var options = { method: method, headers: headers }
  var req = https.request('https://pcdequsipbkxcfsewiow.supabase.co' + pathStr, options, function(res) {
    var d = ''
    res.on('data', function(c) { d += c })
    res.on('end', function() {
      try { cb({ ok: res.statusCode < 300, status: res.statusCode, body: d }) }
      catch(e) { cb({ ok: false, status: res.statusCode, body: d }) }
    })
  })
  req.on('error', function(e) { cb({ ok: false, status: 0, body: e.message }) })
  if (data) req.write(data)
  req.end()
}

function httpGet(pathStr, cb) { httpReq('GET', pathStr, null, cb) }
function httpPost(body, cb) { httpReq('POST', '/rest/v1/challenge_question_pool', body, cb) }
function httpDelete(pathStr, cb) { httpReq('DELETE', pathStr, null, cb) }

async function httpDeleteAwait(pathStr) {
  return new Promise(function(resolve) { httpDelete(pathStr, resolve) })
}
async function httpPostAwait(body) {
  return new Promise(function(resolve) { httpPost(body, resolve) })
}
async function httpGetAwait(pathStr) {
  return new Promise(function(resolve) { httpGet(pathStr, resolve) })
}

async function main() {
  console.log('=== CBR Clean Ingest ===\n')

  // Step 1: Build questions
  var allQuestions = []

  var r24 = processSingle(path.join(OUT, 'cbr_rddi_2024_with_images_v2.json'), 'Geral', 2024)
  console.log('RDDI 2024: ' + r24.length + ' Q (' + r24.filter(function(q){return q.has_image}).length + ' img)')
  allQuestions = allQuestions.concat(r24)

  var r25 = processSingle(path.join(OUT, 'cbr_rddi_2025_with_images.json'), 'Geral', 2025)
  console.log('RDDI 2025: ' + r25.length + ' Q (' + r25.filter(function(q){return q.has_image}).length + ' img)')
  allQuestions = allQuestions.concat(r25)

  var r20 = processSingle(path.join(OUT, 'extracted_RDDI_2020.json'), 'Geral', 2020)
  console.log('RDDI 2020: ' + r20.length + ' Q')
  allQuestions = allQuestions.concat(r20)

  var u3v1Src = loadJSON(path.join(OUT, 'usg-2023-v1.json'))
  var u3v1Img = loadJSON(path.join(OUT, 'cbr_usg_2023_v1_with_images.json'))
  var u3v1 = mergeQuestions(u3v1Src, u3v1Img)
  console.log('USG 2023 V1: ' + u3v1.length + ' Q (' + u3v1.filter(function(q){return q.has_image}).length + ' img)')
  allQuestions = allQuestions.concat(u3v1)

  var u3v2Src = loadJSON(path.join(OUT, 'usg-2023-v2.json'))
  var u3v2Img = loadJSON(path.join(OUT, 'cbr_usg_2023_v2_with_images.json'))
  var u3v2 = mergeQuestions(u3v2Src, u3v2Img)
  console.log('USG 2023 V2: ' + u3v2.length + ' Q (' + u3v2.filter(function(q){return q.has_image}).length + ' img)')
  allQuestions = allQuestions.concat(u3v2)

  var u19 = processSingle(path.join(OUT, 'usg-2019.json'), 'USG', 2019)
  console.log('USG 2019: ' + u19.length + ' Q')
  allQuestions = allQuestions.concat(u19)

  console.log('\nTotal: ' + allQuestions.length + ' questions')
  console.log('With images: ' + allQuestions.filter(function(q){return q.has_image}).length)

  // Step 2: Get all existing pool IDs
  console.log('\n--- Cleaning old CBR pools ---')
  
  // Get all pools with CBR in source_title
  var result = await httpGetAwait('/rest/v1/challenge_question_pool?select=id,source_title&source_title=not.is.null&limit=1000')
  var pools = []
  try { pools = JSON.parse(result.body) } catch(e) { pools = [] }
  
  var cbrPools = pools.filter(function(p) { return p.source_title && p.source_title.indexOf('CBR') !== -1 })
  console.log('Found ' + cbrPools.length + ' CBR pools to delete')
  
  // Delete by ID (more reliable than ilike for RLS)
  var deleted = 0
  for (var di = 0; di < cbrPools.length; di++) {
    var delResult = await httpDeleteAwait('/rest/v1/challenge_question_pool?id=eq.' + cbrPools[di].id)
    if (delResult.ok) deleted++
  }
  console.log('Deleted ' + deleted + '/' + cbrPools.length + ' pools')

  // Step 3: Verify clean state
  var afterResult = await httpGetAwait('/rest/v1/challenge_question_pool?select=id&source_title=not.is.null&limit=1')
  try {
    var after = JSON.parse(afterResult.body)
    console.log('Remaining non-null pools: ' + after.length)
  } catch(e) {}

  // Step 4: Insert all questions
  console.log('\n--- Inserting ' + allQuestions.length + ' questions ---')
  var inserted = 0
  for (var i = 0; i < allQuestions.length; i += 50) {
    var chunk = allQuestions.slice(i, i + 50)
    var res = await httpPostAwait(chunk)
    if (res.ok) {
      inserted += chunk.length
      process.stdout.write('  ' + inserted + '/' + allQuestions.length + '\r')
    } else {
      console.error('\nError at ' + i + ': ' + res.status + ' ' + res.body.substring(0, 200))
    }
  }
  
  console.log('\n\nDone! ' + inserted + ' questions inserted.')
  
  // Final count
  var finalResult = await httpGetAwait('/rest/v1/challenge_question_pool?select=id,source_title,has_image')
  var finalPools = []
  try { finalPools = JSON.parse(finalResult.body) } catch(e) { finalPools = [] }
  var finalCBR = finalPools.filter(function(p){return p.source_title && p.source_title.indexOf('CBR') !== -1})
  var finalImg = finalPools.filter(function(p){return p.has_image})
  console.log('Final: ' + finalPools.length + ' total pools, ' + finalCBR.length + ' CBR pools, ' + finalImg.length + ' with images')
}

main().catch(console.error)
