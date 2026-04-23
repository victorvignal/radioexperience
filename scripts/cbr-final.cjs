/**
 * Final CBR ingest — clean slate, insert all questions
 * Then verify counts
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

function mergeQS(tSrc, iSrc) {
  var tQs = toArray(tSrc), iQs = toArray(iSrc)
  var iByNum = {}
  for (var qi = 0; qi < iQs.length; qi++) {
    var q = iQs[qi], n = q.number || q.question_number
    if (q.has_image && q.image_base64) iByNum[n] = { ib: q.image_base64, hi: true }
  }
  var tByNum = {}
  for (var ti = 0; ti < tQs.length; ti++) { tByNum[tQs[ti].question_number || tQs[ti].number] = tQs[ti] }
  var allNums = new Set(Object.keys(tByNum).concat(Object.keys(iByNum)))
  var merged = []
  allNums.forEach(function(num) {
    var tq = tByNum[num], iq = iByNum[num]
    var text = (tq && tq.question_text) || (tq && tq.text) || (iq && iq.text) || ''
    var opts = normOpts((tq && tq.options) || (iq && iq.options))
    var ans = (tq && tq.correct_answer) || (iq && iq.correct_answer) || null
    var ib = (iq && iq.ib) || null
    var hi = !!(iq && iq.hi && ib)
    if (!ans || !text || text.length < 5) return
    if (opts.length < 2) return
    merged.push({
      specialty: 'Geral',
      question_text: text.slice(0, 2000),
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: ans.toUpperCase(),
      explanation: (tq && tq.explanation) || (iq && iq.explanation) || '',
      source_title: 'CBR ' + ((tq && tq.source) || (iq && iq.source) || 'RDDI') + ' — Questão ' + num,
      difficulty: 'medium',
      image_base64: hi ? ib : null,
      has_image: hi,
      times_used: 0,
    })
  })
  return merged.sort(function(a, b) {
    return parseInt((a.source_title.match(/Questão (\d+)/) || [0,0])[1]) - parseInt((b.source_title.match(/Questão (\d+)/) || [0,0])[1])
  })
}

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

function httpReq(method, pathStr, body, cb) {
  var data = body ? JSON.stringify(body) : null
  var h = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
  if (data) h['Content-Type'] = 'application/json'
  if (method === 'POST') h['Prefer'] = 'resolution=merge-duplicates'
  var req = https.request('https://pcdequsipbkxcfsewiow.supabase.co' + pathStr, { method: method, headers: h }, function(res) {
    var d = ''
    res.on('data', function(c) { d += c })
    res.on('end', function() { try { cb({ ok: res.statusCode < 300, s: res.statusCode, b: d }) } catch(e) { cb({ ok: false, s: res.statusCode, b: d }) } })
  })
  req.on('error', function(e) { cb({ ok: false, s: 0, b: e.message }) })
  if (data) req.write(data)
  req.end()
}
function httpDel(pathStr) { return new Promise(function(r) { httpReq('DELETE', pathStr, null, r) }) }
function httpGet(pathStr) { return new Promise(function(r) { httpReq('GET', pathStr, null, r) }) }
function httpPost(body) { return new Promise(function(r) { httpReq('POST', '/rest/v1/challenge_question_pool', body, r) }) }

async function main() {
  var allQ = []
  
  var r24 = procSingle(path.join(OUT, 'cbr_rddi_2024_with_images_v2.json'), 'Geral', 2024)
  console.log('RDDI 2024: ' + r24.length + ' Q (' + r24.filter(function(q){return q.has_image}).length + ' img)')
  allQ = allQ.concat(r24)

  var r25 = procSingle(path.join(OUT, 'cbr_rddi_2025_with_images.json'), 'Geral', 2025)
  console.log('RDDI 2025: ' + r25.length + ' Q (' + r25.filter(function(q){return q.has_image}).length + ' img)')
  allQ = allQ.concat(r25)

  var r20 = procSingle(path.join(OUT, 'extracted_RDDI_2020.json'), 'Geral', 2020)
  console.log('RDDI 2020: ' + r20.length + ' Q')
  allQ = allQ.concat(r20)

  var u3v1 = mergeQS(loadJSON(path.join(OUT, 'usg-2023-v1.json')), loadJSON(path.join(OUT, 'cbr_usg_2023_v1_with_images.json')))
  console.log('USG 2023 V1: ' + u3v1.length + ' Q (' + u3v1.filter(function(q){return q.has_image}).length + ' img)')
  allQ = allQ.concat(u3v1)

  var u3v2 = mergeQS(loadJSON(path.join(OUT, 'usg-2023-v2.json')), loadJSON(path.join(OUT, 'cbr_usg_2023_v2_with_images.json')))
  console.log('USG 2023 V2: ' + u3v2.length + ' Q (' + u3v2.filter(function(q){return q.has_image}).length + ' img)')
  allQ = allQ.concat(u3v2)

  var u19 = procSingle(path.join(OUT, 'usg-2019.json'), 'USG', 2019)
  console.log('USG 2019: ' + u19.length + ' Q')
  allQ = allQ.concat(u19)

  console.log('\nTotal: ' + allQ.length + ' questions | ' + allQ.filter(function(q){return q.has_image}).length + ' with images')

  // Save combined JSON
  var outFile = path.join(OUT, 'cbr_final_combined.json')
  fs.writeFileSync(outFile, JSON.stringify(allQ, null, 2))
  console.log('Saved: ' + Math.round(fs.statSync(outFile).size / 1024) + 'KB')

  // Insert
  console.log('\nInserting ' + allQ.length + ' questions...')
  var inserted = 0
  for (var i = 0; i < allQ.length; i += 50) {
    var chunk = allQ.slice(i, i + 50)
    var res = await httpPost(chunk)
    if (res.ok) {
      inserted += chunk.length
      process.stdout.write('  ' + inserted + '/' + allQ.length + '\r')
    } else {
      console.error('\nError at ' + i + ': ' + res.s + ' ' + res.b.substring(0, 200))
    }
  }

  console.log('\n\nInserted: ' + inserted + '/' + allQ.length)

  // Verify
  var pools = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title,has_image,image_base64&limit=1000')
  var data = []
  try { data = JSON.parse(pools.b) } catch(e) {}
  console.log('Total pools in DB: ' + data.length)
  var cbr = data.filter(function(p) { return p.source_title && p.source_title.indexOf('CBR') !== -1 })
  var img = data.filter(function(p) { return p.has_image })
  console.log('CBR pools: ' + cbr.length + ' | With images: ' + img.length)
  if (img.length > 0) {
    console.log('Image pools:')
    img.forEach(function(p) {
      console.log('  ' + p.source_title + ' (' + (p.image_base64 ? p.image_base64.length + 'b' : 'null') + ')')
    })
  }
}

main().catch(console.error)
