/**
 * RDDI 2025 image update — re-ingest only RDDI 2025 with images
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch(e) { return null } }
function toArray(d) {
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object' && d.questions) return Array.isArray(d.questions) ? d.questions : Object.values(d.questions)
  if (d && typeof d === 'object') return Object.values(d)
  return []
}
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

function procSingle(fp, spec, year) {
  var d = loadJSON(fp)
  if (!d) return []
  var qs = toArray(d), out = []
  for (var qi = 0; qi < qs.length; qi++) {
    var q = qs[qi]
    var n = q.question_number || q.number || 0
    var text = q.question_text || q.text || ''
    var opts = normOpts(q.options)
    var ans = q.correct_answer || null
    var ib = q.image_base64 || null
    var hi = !!(q.has_image && ib)
    if (!ans || !text || text.length < 5) continue
    if (opts.length < 2) continue
    out.push({
      specialty: spec || 'Geral',
      question_text: text.slice(0, 2000),
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: ans.toUpperCase(),
      explanation: q.explanation || '',
      source_title: 'CBR ' + spec + ' ' + year + ' — Questão ' + n,
      difficulty: 'medium',
      image_base64: hi ? ib : null,
      has_image: hi,
      times_used: 0,
    })
  }
  return out
}

async function main() {
  var r25 = procSingle(path.join(OUT, 'cbr_rddi_2025_with_images.json'), 'Geral', 2025)
  console.log('RDDI 2025 from JSON: ' + r25.length + ' Q (' + r25.filter(function(q){return q.has_image}).length + ' img)')

  console.log('Fetching current RDDI 2025 pools from DB...')
  var result = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title,has_image&source_title=ilike.*2025*&limit=200')
  var currentDB = []
  try { currentDB = JSON.parse(result.b) } catch(e) { currentDB = [] }
  console.log('Current DB pools: ' + currentDB.length)

  console.log('Deleting ' + currentDB.length + ' old RDDI 2025 pools...')
  var del = 0
  for (var di = 0; di < currentDB.length; di++) {
    var res = await httpDel(currentDB[di].id)
    if (res.ok) del++
  }
  console.log('Deleted: ' + del + '/' + currentDB.length)

  console.log('Inserting ' + r25.length + ' new RDDI 2025 questions...')
  var inserted = 0
  for (var i = 0; i < r25.length; i += 50) {
    var chunk = r25.slice(i, i + 50)
    var res = await httpPost(chunk)
    if (res.ok) {
      inserted += chunk.length
      process.stdout.write('  ' + inserted + '/' + r25.length + '\r')
    } else {
      console.error('\nError at ' + i + ': ' + res.s)
    }
  }
  console.log('\nInserted: ' + inserted + '/' + r25.length)

  var finalResult = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title,has_image&source_title=ilike.*2025*&limit=200')
  var finalDB = []
  try { finalDB = JSON.parse(finalResult.b) } catch(e) { finalDB = [] }
  var withImg = finalDB.filter(function(p){ return p.has_image })
  console.log('Final DB: ' + finalDB.length + ' pools, ' + withImg.length + ' with images')
  if (withImg.length > 0 && withImg.length < 10) {
    withImg.forEach(function(p) { console.log('  -', p.source_title) })
  }
}

main().catch(console.error)
