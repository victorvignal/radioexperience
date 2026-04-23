/**
 * Update USG 2019 JSON with images from extracted_usg-2019-anual.json
 * and re-ingest to DB
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

function normOpts(opts) {
  if (!opts || !Array.isArray(opts)) return []
  return opts.map(function(o) {
    if (typeof o === 'string') return o
    return (o.label || o.option_label || '') + ') ' + (o.text || o.option_text || '')
  }).filter(function(o) { return o.length > 2 })
}

function httpReq(method, pathStr, body, cb) {
  var data = body ? JSON.stringify(body) : null
  var h = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
  if (data) h['Content-Type'] = 'application/json'
  if (method === 'POST') h['Prefer'] = 'resolution=merge-duplicates'
  var req = https.request('https://pcdequsipbkxcfsewiow.supabase.co' + pathStr, { method: method, headers: h }, function(res) {
    var d = ''
    res.on('data', function(c) { d += c })
    res.on('end', function() { try { cb({ ok: res.statusCode < 300, s: res.statusCode, b: d }) } catch(e) { cb({ ok: false, s: 0, b: d }) } })
  })
  req.on('error', function(e) { cb({ ok: false, s: 0, b: e.message }) })
  if (data) req.write(data)
  req.end()
}
var httpGet = function(pathStr) { return new Promise(function(r) { httpReq('GET', pathStr, null, r) }) }
var httpPost = function(body) { return new Promise(function(r) { httpReq('POST', '/rest/v1/challenge_question_pool', body, r) }) }
var httpDel = function(id) { return new Promise(function(r) { httpReq('DELETE', '/rest/v1/challenge_question_pool?id=eq.' + id, null, r) }) }

function convertQ(q) {
  var n = q.question_number || q.number || 0
  var text = q.question_text || ''
  var opts = normOpts(q.options)
  var ans = q.correct_answer || null
  var ib = q.image_base64 || null
  var hi = !!(q.has_image && ib)
  if (!ans) return null
  // Accept question if it has image, even without text
  if (text && text.length < 5 && !hi) return null
  if (opts.length < 2) return null
  return {
    specialty: 'Geral',
    question_text: text.slice(0, 2000),
    question_type: 'multiple_choice',
    options: opts,
    correct_answer: ans.toUpperCase(),
    explanation: q.explanation || '',
    source_title: 'CBR USG 2019 — Questão ' + n,
    difficulty: 'medium',
    image_base64: hi ? ib : null,
    has_image: hi,
    times_used: 0,
  }
}

async function main() {
  // Load source JSON with images
  const d = JSON.parse(fs.readFileSync(path.join(OUT, 'extracted_usg-2019-anual.json'), 'utf8'))
  const srcQ = d.questions
  
  console.log('Source questions:', srcQ.length, 'with img:', srcQ.filter(function(q){ return q && q.image_base64 }).length)
  
  // Convert to ingest format
  var questions = []
  for (var i = 0; i < srcQ.length; i++) {
    var c = convertQ(srcQ[i])
    if (c) questions.push(c)
  }
  console.log('Converted:', questions.length, 'Q (' + questions.filter(function(q){ return q.has_image }).length + ' img)')
  
  // Get current USG 2019 pool IDs
  console.log('\nFetching current USG 2019 pools from DB...')
  var r = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title&source_title=ilike.*USG*2019*&limit=200')
  var old = []
  try { old = JSON.parse(r.b) } catch(e) { old = [] }
  console.log('Old pools:', old.length)
  
  // Delete
  var del = 0
  for (var di = 0; di < old.length; di++) {
    var res = await httpDel(old[di].id)
    if (res.ok) del++
  }
  console.log('Deleted:', del + '/' + old.length)
  
  // Insert
  console.log('Inserting', questions.length, 'questions...')
  var inserted = 0
  for (var i = 0; i < questions.length; i += 50) {
    var chunk = questions.slice(i, i + 50)
    var res = await httpPost(chunk)
    if (res.ok) {
      inserted += chunk.length
      process.stdout.write('  ' + inserted + '/' + questions.length + '\r')
    } else {
      console.error('\nError at ' + i + ': ' + res.s)
    }
  }
  console.log('\nInserted:', inserted + '/' + questions.length)
  
  // Verify
  var vr = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title,has_image&source_title=ilike.*USG*2019*&limit=200')
  var verify = []
  try { verify = JSON.parse(vr.b) } catch(e) { verify = [] }
  var withImg = verify.filter(function(p){ return p.has_image })
  console.log('DB now:', verify.length, 'pools,', withImg.length, 'with images')
}

main().catch(console.error)
