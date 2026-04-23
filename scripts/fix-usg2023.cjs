/**
 * Final fix for USG 2023 V1/V2 — proper dedup: keep only first occurrence
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch(e) { return null } }
function normOpts(opts) {
  if (!opts || !Array.isArray(opts)) return []
  return opts.map(function(o) {
    if (typeof o === 'string') return o
    return (o.label || o.option_label || '') + ') ' + (o.text || o.option_text || '')
  }).filter(function(o) { return o.length > 2 })
}

function merge(textSrc, imgSrc, label) {
  var tQs = textSrc.questions || []
  var iQs = imgSrc.questions || []
  
  // Index images by number (field is 'number' in img JSON)
  var iByNum = {}
  for (var qi = 0; qi < iQs.length; qi++) {
    var q = iQs[qi]
    var n = q.number || q.question_number
    if (q.has_image && q.image_base64) iByNum[n] = q
  }
  
  // Index text by number. Deduplicate: keep first occurrence only.
  var tByNum = {}
  for (var ti = 0; ti < tQs.length; ti++) {
    var q2 = tQs[ti]
    var n = q2.question_number
    if (!tByNum[n]) {
      tByNum[n] = q2
    }
    // Skip subsequent duplicates
  }
  
  var allNums = new Set([].concat(Object.keys(tByNum), Object.keys(iByNum)))
  var merged = []
  
  allNums.forEach(function(num) {
    var tq = tByNum[num], iq = iByNum[num]
    if (!tq) return  // need text source
    var text = tq.question_text || ''
    var opts = normOpts(tq.options || [])
    var ans = tq.correct_answer || null
    var ib = (iq && iq.image_base64) || null
    var hi = !!(iq && iq.has_image && ib)
    
    if (!ans) return
    if (opts.length < 2) return
    
    merged.push({
      specialty: 'Geral',
      question_text: text.slice(0, 2000),
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: ans.toUpperCase(),
      explanation: tq.explanation || '',
      source_title: 'CBR USG 2023 ' + label + ' — Questão ' + num,
      difficulty: 'medium',
      image_base64: hi ? ib : null,
      has_image: hi,
      times_used: 0,
    })
  })
  
  return merged.sort(function(a, b) {
    var na = parseInt((a.source_title.match(/Questão (\d+)/) || [0,0])[1])
    var nb = parseInt((b.source_title.match(/Questão (\d+)/) || [0,0])[1])
    return na - nb
  })
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

async function main() {
  var v1Txt = loadJSON(path.join(OUT, 'usg-2023-v1.json'))
  var v1Img = loadJSON(path.join(OUT, 'cbr_usg_2023_v1_with_images.json'))
  var v2Txt = loadJSON(path.join(OUT, 'usg-2023-v2.json'))
  var v2Img = loadJSON(path.join(OUT, 'cbr_usg_2023_v2_with_images.json'))
  
  console.log('V1 text Q:', (v1Txt.questions || []).length)
  console.log('V2 text Q:', (v2Txt.questions || []).length)
  
  var v1 = merge(v1Txt, v1Img, 'V1')
  var v2 = merge(v2Txt, v2Img, 'V2')
  
  console.log('Merged V1:', v1.length, 'Q (' + v1.filter(function(q){return q.has_image}).length + ' img)')
  console.log('Merged V2:', v2.length, 'Q (' + v2.filter(function(q){return q.has_image}).length + ' img)')
  
  // Delete old USG 2023 pools
  console.log('\nFetching USG 2023 pools...')
  var r1 = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title&source_title=ilike.*USG*2023*&limit=200')
  var old = []
  try { old = JSON.parse(r1.b) } catch(e) { old = [] }
  console.log('Old pools:', old.length)
  
  var del = 0
  for (var di = 0; di < old.length; di++) {
    var res = await httpDel(old[di].id)
    if (res.ok) del++
  }
  console.log('Deleted:', del + '/' + old.length)
  
  // Insert merged
  var all = v1.concat(v2)
  console.log('\nInserting', all.length, 'questions...')
  var inserted = 0
  for (var i = 0; i < all.length; i += 50) {
    var chunk = all.slice(i, i + 50)
    var res = await httpPost(chunk)
    if (res.ok) {
      inserted += chunk.length
      process.stdout.write('  ' + inserted + '/' + all.length + '\r')
    } else {
      console.error('\nError at ' + i + ': ' + res.s)
    }
  }
  console.log('\nInserted:', inserted + '/' + all.length)
  
  // Verify
  var vr = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title,has_image&source_title=ilike.*USG*2023*&limit=200')
  var verify = []
  try { verify = JSON.parse(vr.b) } catch(e) { verify = [] }
  var imgVerify = verify.filter(function(p){ return p.has_image })
  var sources = {}
  for (var si = 0; si < verify.length; si++) {
    var src = verify[si].source_title.replace(/\s*—\s*Questão\s*\d+$/, '')
    sources[src] = (sources[src] || 0) + 1
  }
  console.log('DB now:', verify.length, 'pools,', imgVerify.length, 'with images')
  console.log('By source:')
  for (var k in sources) console.log('  ' + k + ': ' + sources[k])
}

main().catch(console.error)
