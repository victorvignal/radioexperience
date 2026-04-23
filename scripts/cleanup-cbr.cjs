const https = require('https')
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

function httpGet(path, cb) {
  const req = https.request('https://pcdequsipbkxcfsewiow.supabase.co' + path, {
    method: 'GET',
    headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
  }, function(res) {
    let d = ''
    res.on('data', function(c) { d += c })
    res.on('end', function() {
      try { cb(JSON.parse(d)) } catch(e) { cb([]) }
    })
  })
  req.on('error', function() { cb([]) })
  req.end()
}

function httpDeleteId(id, cb) {
  const req = https.request('https://pcdequsipbkxcfsewiow.supabase.co/rest/v1/challenge_question_pool?id=eq.' + id, {
    method: 'DELETE',
    headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
  }, function(res) {
    let d = ''
    res.on('data', function(c) { d += c })
    res.on('end', function() { cb(res.statusCode, d) })
  })
  req.on('error', function(e) { cb(0, e.message) })
  req.end()
}

async function main() {
  // Get all pools
  const pools = await new Promise(function(r) { httpGet('/rest/v1/challenge_question_pool?select=id,source_title,has_image&limit=600', r) })
  console.log('Total pools: ' + pools.length)
  
  const cbr = pools.filter(function(p) { return p.source_title && p.source_title.indexOf('CBR') !== -1 })
  console.log('CBR pools: ' + cbr.length)
  
  const img = pools.filter(function(p) { return p.has_image })
  console.log('With images: ' + img.length)
  
  const nonCBR = pools.filter(function(p) { return !p.source_title || p.source_title.indexOf('CBR') === -1 })
  console.log('Non-CBR pools: ' + nonCBR.length)
  
  // Show first few source_titles
  console.log('\nFirst 10 source_titles:')
  for (var i = 0; i < Math.min(10, pools.length); i++) {
    console.log('  ' + pools[i].source_title)
  }
  
  // Delete CBR pools by ID
  if (cbr.length > 0) {
    console.log('\nDeleting ' + cbr.length + ' CBR pools by ID...')
    var deleted = 0
    for (var di = 0; di < cbr.length; di++) {
      const status = await new Promise(function(r) { httpDeleteId(cbr[di].id, r) })
      if (status === 204 || status === 200) deleted++
    }
    console.log('Deleted ' + deleted + ' pools')
  }
  
  // Final count
  const final = await new Promise(function(r) { httpGet('/rest/v1/challenge_question_pool?select=id&limit=1', r) })
  console.log('Final total: ' + final.length + ' (if 1, means only 1 returned due to limit)')
}

main().catch(console.error)
