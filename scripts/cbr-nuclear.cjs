/**
 * Nuclear clean + re-ingest for CBR pools
 * Gets ALL pool IDs first, then deletes everything that isn't in the "keep" list
 */
const https = require('https')
const fs = require('fs')
const path = require('path')

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

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
var httpDelById = function(id) { return new Promise(function(r) { httpReq('DELETE', '/rest/v1/challenge_question_pool?id=eq.' + id, null, r) }) }

async function getAllPools() {
  var all = []
  var offset = 0
  while (true) {
    var res = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title,has_image,image_base64&limit=1000&offset=' + offset)
    var data = []
    try { data = JSON.parse(res.b) } catch(e) { data = [] }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < 1000) break
    offset += 1000
    if (offset > 10000) break  // safety
  }
  return all
}

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
  console.log('=== Nuclear CBR Clean + Re-Ingest ===\n')

  // Step 1: Get all existing pools
  console.log('Fetching all pools...')
  var allPools = await getAllPools()
  console.log('Total pools in DB: ' + allPools.length)

  // Step 2: Identify CBR pools (anything with "Geral 2024", "Geral 2025", "Geral 2020", "USG 2019", "CBR", "RDDI", or USG question pattern)
  var toDelete = []
  for (var pi = 0; pi < allPools.length; pi++) {
    var p = allPools[pi]
    var src = p.source_title || ''
    // Keep only non-CBR pools (Neurorradiologia, Mama, T1/T2, etc.)
    var isNonCBR = src.indexOf('Neurorradiologia') !== -1 || src.indexOf('Mama_') !== -1 || 
                   src.indexOf('Obstetricia_') !== -1 || src.indexOf('T1:') !== -1 || src.indexOf('T2:') !== -1 ||
                   src.indexOf('Ressonância magnética') !== -1 || src.indexOf('Manual do') !== -1 ||
                   src.indexOf('Avaliação mamográfica') !== -1 || src.indexOf('Metástases') !== -1 ||
                   src.indexOf('Geral_Livro') !== -1
    if (!isNonCBR) toDelete.push(p.id)
  }
  
  console.log('Pools to delete: ' + toDelete.length)
  console.log('Pools to keep: ' + (allPools.length - toDelete.length))

  // Step 3: Delete CBR pools
  console.log('\nDeleting ' + toDelete.length + ' CBR pools...')
  var deleted = 0
  for (var di = 0; di < toDelete.length; di++) {
    var res = await httpDelById(toDelete[di])
    if (res.ok) deleted++
  }
  console.log('Deleted: ' + deleted + '/' + toDelete.length)

  // Step 4: Build new questions
  var OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
  var newQ = []
  
  var r24 = procSingle(path.join(OUT, 'cbr_rddi_2024_with_images_v2.json'), 'Geral', 2024)
  newQ = newQ.concat(r24)
  
  var r25 = procSingle(path.join(OUT, 'cbr_rddi_2025_with_images.json'), 'Geral', 2025)
  newQ = newQ.concat(r25)
  
  var r20 = procSingle(path.join(OUT, 'extracted_RDDI_2020.json'), 'Geral', 2020)
  newQ = newQ.concat(r20)
  
  // USG 2023 needs merge
  var u3v1Src = loadJSON(path.join(OUT, 'usg-2023-v1.json'))
  var u3v1Img = loadJSON(path.join(OUT, 'cbr_usg_2023_v1_with_images.json'))
  if (u3v1Src || u3v1Img) {
    var tQs = toArray(u3v1Src), iQs = toArray(u3v1Img)
    var iByNum = {}
    for (var qi = 0; qi < iQs.length; qi++) {
      var q = iQs[qi], n = q.number || q.question_number
      if (q.has_image && q.image_base64) iByNum[n] = { ib: q.image_base64, hi: true }
    }
    var tByNum = {}
    for (var ti = 0; ti < tQs.length; ti++) tByNum[tQs[ti].question_number || tQs[ti].number] = tQs[ti]
    var allNums = new Set(Object.keys(tByNum).concat(Object.keys(iByNum)))
    allNums.forEach(function(num) {
      var tq = tByNum[num], iq = iByNum[num]
      var text = (tq && tq.question_text) || (tq && tq.text) || (iq && iq.text) || ''
      var opts = normOpts((tq && tq.options) || (iq && iq.options))
      var ans = (tq && tq.correct_answer) || (iq && iq.correct_answer) || null
      var ib = (iq && iq.ib) || null
      var hi = !!(iq && iq.hi && ib)
      if (!ans || !text || text.length < 5) return
      if (opts.length < 2) return
      newQ.push({
        specialty: 'Geral', question_text: text.slice(0, 2000), question_type: 'multiple_choice',
        options: opts, correct_answer: ans.toUpperCase(), explanation: (tq && tq.explanation) || '',
        source_title: 'CBR USG 2023 V1 — Questão ' + num, difficulty: 'medium',
        image_base64: hi ? ib : null, has_image: hi, times_used: 0,
      })
    })
  }
  
  var u3v2Src = loadJSON(path.join(OUT, 'usg-2023-v2.json'))
  var u3v2Img = loadJSON(path.join(OUT, 'cbr_usg_2023_v2_with_images.json'))
  if (u3v2Src || u3v2Img) {
    var tQs2 = toArray(u3v2Src), iQs2 = toArray(u3v2Img)
    var iByNum2 = {}
    for (var qi2 = 0; qi2 < iQs2.length; qi2++) {
      var q2 = iQs2[qi2], n2 = q2.number || q2.question_number
      if (q2.has_image && q2.image_base64) iByNum2[n2] = { ib: q2.image_base64, hi: true }
    }
    var tByNum2 = {}
    for (var ti2 = 0; ti2 < tQs2.length; ti2++) tByNum2[tQs2[ti2].question_number || tQs2[ti2].number] = tQs2[ti2]
    var allNums2 = new Set(Object.keys(tByNum2).concat(Object.keys(iByNum2)))
    allNums2.forEach(function(num) {
      var tq2 = tByNum2[num], iq2 = iByNum2[num]
      var text2 = (tq2 && tq2.question_text) || (tq2 && tq2.text) || (iq2 && iq2.text) || ''
      var opts2 = normOpts((tq2 && tq2.options) || (iq2 && iq2.options))
      var ans2 = (tq2 && tq2.correct_answer) || (iq2 && iq2.correct_answer) || null
      var ib2 = (iq2 && iq2.ib) || null
      var hi2 = !!(iq2 && iq2.hi && ib2)
      if (!ans2 || !text2 || text2.length < 5) return
      if (opts2.length < 2) return
      newQ.push({
        specialty: 'Geral', question_text: text2.slice(0, 2000), question_type: 'multiple_choice',
        options: opts2, correct_answer: ans2.toUpperCase(), explanation: (tq2 && tq2.explanation) || '',
        source_title: 'CBR USG 2023 V2 — Questão ' + num, difficulty: 'medium',
        image_base64: hi2 ? ib2 : null, has_image: hi2, times_used: 0,
      })
    })
  }
  
  var u19 = procSingle(path.join(OUT, 'usg-2019.json'), 'USG', 2019)
  newQ = newQ.concat(u19)

  console.log('\nNew questions to insert: ' + newQ.length)
  console.log('With images: ' + newQ.filter(function(q){return q.has_image}).length)

  // Step 5: Insert new questions
  console.log('\nInserting...')
  var inserted = 0
  for (var ii = 0; ii < newQ.length; ii += 50) {
    var chunk = newQ.slice(ii, ii + 50)
    var res = await httpPost(chunk)
    if (res.ok) {
      inserted += chunk.length
      process.stdout.write('  ' + inserted + '/' + newQ.length + '\r')
    } else {
      console.error('\nError at ' + ii + ': ' + res.s + ' ' + res.b.substring(0, 200))
    }
  }

  // Step 6: Final verification
  console.log('\n\nFinal state:')
  var finalPools = await getAllPools()
  console.log('Total pools: ' + finalPools.length)
  var cbrFinal = finalPools.filter(function(p){ return p.source_title && p.source_title.indexOf('CBR') !== -1 })
  var imgFinal = finalPools.filter(function(p){ return p.has_image })
  console.log('CBR pools: ' + cbrFinal.length + ' | With images: ' + imgFinal.length)
  
  // Group by source
  var sources = {}
  for (var si = 0; si < cbrFinal.length; si++) {
    var src = cbrFinal[si].source_title
    var match = src.match(/CBR\s+(RDDI|USG)\s+(\d+)/)
    if (match) src = 'CBR ' + match[1] + ' ' + match[2]
    sources[src] = (sources[src] || 0) + 1
  }
  console.log('\nBy source:')
  for (var k in sources) console.log('  ' + k + ': ' + sources[k])
}

main().catch(console.error)
