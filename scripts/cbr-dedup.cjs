/**
 * Deduplicate CBR pools — fix duplicate Q43 and merged USG 2023 V1/V2
 */
const https = require('https')

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
var httpDelById = function(id) { return new Promise(function(r) { httpReq('DELETE', '/rest/v1/challenge_question_pool?id=eq.' + id, null, r) }) }
var httpPost = function(body) { return new Promise(function(r) { httpReq('POST', '/rest/v1/challenge_question_pool', body, r) }) }

async function getAllPools() {
  var all = []
  for (var offset = 0; offset < 10000; offset += 1000) {
    var res = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title,question_text,correct_answer,has_image,image_base64,options&limit=1000&offset=' + offset)
    var data = []
    try { data = JSON.parse(res.b) } catch(e) { data = [] }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < 1000) break
  }
  return all
}

async function main() {
  var pools = await getAllPools()
  console.log('Total pools: ' + pools.length)

  var cbrPools = pools.filter(function(p) { return p.source_title && p.source_title.indexOf('CBR') !== -1 })
  console.log('CBR pools: ' + cbrPools.length)

  // --- Fix 1: USG 2023 V1/V2 merge — find duplicates by question number ---
  // V1 and V2 questions with same number got merged into "CBR USG 2023" 
  // We need to split them. Both V1 and V2 have Q1-Q40.
  // Strategy: keep V2 data, re-create V1 with correct label.
  
  var usg2023Pools = cbrPools.filter(function(p) { return p.source_title === 'CBR USG 2023' })
  console.log('USG 2023 merged pools: ' + usg2023Pools.length)
  
  // We have 80 pools with same source_title. Need to split into V1 and V2.
  // Since they merged, we have duplicates per question number. One is V1, one is V2.
  // But we can't tell them apart. Best approach: delete all and re-insert from JSON.
  
  if (usg2023Pools.length > 0) {
    console.log('Deleting merged USG 2023 pools...')
    var delCount = 0
    for (var di = 0; di < usg2023Pools.length; di++) {
      var res = await httpDelById(usg2023Pools[di].id)
      if (res.ok) delCount++
    }
    console.log('Deleted: ' + delCount + '/' + usg2023Pools.length)
    
    // Re-insert from JSON with correct labels
    var fs = require('fs')
    var path = require('path')
    var OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
    
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
    
    function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch(e) { return null } }
    
    var u3v1Src = loadJSON(path.join(OUT, 'usg-2023-v1.json'))
    var u3v1Img = loadJSON(path.join(OUT, 'cbr_usg_2023_v1_with_images.json'))
    var u3v2Src = loadJSON(path.join(OUT, 'usg-2023-v2.json'))
    var u3v2Img = loadJSON(path.join(OUT, 'cbr_usg_2023_v2_with_images.json'))
    
    var iByNumV1 = {}, iByNumV2 = {}
    var iQsV1 = toArray(u3v1Img), iQsV2 = toArray(u3v2Img)
    for (var qi = 0; qi < iQsV1.length; qi++) {
      var q = iQsV1[qi], n = q.number || q.question_number
      if (q.has_image && q.image_base64) iByNumV1[n] = { ib: q.image_base64, hi: true }
    }
    for (var qi2 = 0; qi2 < iQsV2.length; qi2++) {
      var q2 = iQsV2[qi2], n2 = q2.number || q2.question_number
      if (q2.has_image && q2.image_base64) iByNumV2[n2] = { ib: q2.image_base64, hi: true }
    }
    
    var tByNumV1 = {}, tByNumV2 = {}
    var tQsV1 = toArray(u3v1Src), tQsV2 = toArray(u3v2Src)
    for (var ti = 0; ti < tQsV1.length; ti++) tByNumV1[tQsV1[ti].question_number || tQsV1[ti].number] = tQsV1[ti]
    for (var ti2 = 0; ti2 < tQsV2.length; ti2++) tByNumV2[tQsV2[ti2].question_number || tQsV2[ti2].number] = tQsV2[ti2]
    
    var allNumsV1 = new Set(Object.keys(tByNumV1))
    var allNumsV2 = new Set(Object.keys(tByNumV2))
    
    var v1Questions = [], v2Questions = []
    
    allNumsV1.forEach(function(num) {
      var tq = tByNumV1[num], iq = iByNumV1[num]
      var text = (tq && tq.question_text) || (tq && tq.text) || ''
      var opts = normOpts((tq && tq.options) || [])
      var ans = (tq && tq.correct_answer) || null
      var ib = (iq && iq.ib) || null
      var hi = !!(iq && iq.hi && ib)
      if (!ans || !text || text.length < 5 || opts.length < 2) return
      v1Questions.push({
        specialty: 'Geral', question_text: text.slice(0, 2000), question_type: 'multiple_choice',
        options: opts, correct_answer: ans.toUpperCase(), explanation: (tq && tq.explanation) || '',
        source_title: 'CBR USG 2023 V1 — Questão ' + num, difficulty: 'medium',
        image_base64: hi ? ib : null, has_image: hi, times_used: 0,
      })
    })
    
    allNumsV2.forEach(function(num) {
      var tq2 = tByNumV2[num], iq2 = iByNumV2[num]
      var text2 = (tq2 && tq2.question_text) || (tq2 && tq2.text) || ''
      var opts2 = normOpts((tq2 && tq2.options) || [])
      var ans2 = (tq2 && tq2.correct_answer) || null
      var ib2 = (iq2 && iq2.ib) || null
      var hi2 = !!(iq2 && iq2.hi && ib2)
      if (!ans2 || !text2 || text2.length < 5 || opts2.length < 2) return
      v2Questions.push({
        specialty: 'Geral', question_text: text2.slice(0, 2000), question_type: 'multiple_choice',
        options: opts2, correct_answer: ans2.toUpperCase(), explanation: (tq2 && tq2.explanation) || '',
        source_title: 'CBR USG 2023 V2 — Questão ' + num, difficulty: 'medium',
        image_base64: hi2 ? ib2 : null, has_image: hi2, times_used: 0,
      })
    })
    
    console.log('Re-inserting USG 2023 V1: ' + v1Questions.length + ' Q')
    console.log('Re-inserting USG 2023 V2: ' + v2Questions.length + ' Q')
    
    for (var i = 0; i < v1Questions.length; i += 50) {
      var chunk = v1Questions.slice(i, i + 50)
      await httpPost(chunk)
    }
    for (var j = 0; j < v2Questions.length; j += 50) {
      var chunk2 = v2Questions.slice(j, j + 50)
      await httpPost(chunk2)
    }
    console.log('USG 2023 V1/V2 re-inserted')
  }

  // --- Fix 2: Q43 duplicate in RDDI 2024 ---
  var r2024Pools = cbrPools.filter(function(p) { return p.source_title === 'CBR Geral 2024 — Questão 43' })
  console.log('\nRDDI 2024 Q43 duplicates: ' + r2024Pools.length)
  
  if (r2024Pools.length > 1) {
    // Keep the first one, delete the rest
    console.log('Deleting ' + (r2024Pools.length - 1) + ' duplicate Q43...')
    var delCount = 0
    for (var di = 1; di < r2024Pools.length; di++) {
      var res = await httpDelById(r2024Pools[di].id)
      if (res.ok) delCount++
    }
    console.log('Deleted duplicate Q43: ' + delCount)
  }

  // Final state
  console.log('\n=== Final State ===')
  var finalPools = await getAllPools()
  console.log('Total: ' + finalPools.length)
  var cbrFinal = finalPools.filter(function(p){ return p.source_title && p.source_title.indexOf('CBR') !== -1 })
  var imgFinal = finalPools.filter(function(p){ return p.has_image })
  console.log('CBR: ' + cbrFinal.length + ' | With images: ' + imgFinal.length)
  
  var sources = {}
  for (var si = 0; si < cbrFinal.length; si++) {
    var src = cbrFinal[si].source_title
    // Normalize: remove " — Questão N" suffix for grouping
    var base = src.replace(/\s*—\s*Questão\s*\d+$/, '')
    sources[base] = (sources[base] || 0) + 1
  }
  console.log('\nBy source:')
  for (var k in sources) console.log('  ' + k + ': ' + sources[k])
}

main().catch(console.error)
