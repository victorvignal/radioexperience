const https = require('https')
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

function httpGet(pathStr) {
  return new Promise(function(r) {
    var req = https.request('https://pcdequsipbkxcfsewiow.supabase.co' + pathStr, {
      method: 'GET',
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    }, function(res) { var d = ''; res.on('data', function(c) { d += c }); res.on('end', function() { try { r(JSON.parse(d)) } catch(e) { r([]) } }) })
    req.on('error', function() { r([]) })
    req.end()
  })
}

async function main() {
  var pools = await httpGet('/rest/v1/challenge_question_pool?select=id,source_title,has_image&limit=1000')
  console.log('Total pools: ' + pools.length)
  
  var cbr = pools.filter(function(p) { return p.source_title && p.source_title.indexOf('CBR') !== -1 })
  var img = pools.filter(function(p) { return p.has_image })
  console.log('CBR pools: ' + cbr.length + ' | With images: ' + img.length)
  
  var sources = {}
  for (var i = 0; i < cbr.length; i++) {
    var src = cbr[i].source_title
    var base = src.replace(/\s*—\s*Questão\s*\d+$/, '')
    sources[base] = (sources[base] || 0) + 1
  }
  console.log('\nBy source:')
  for (var k in sources) console.log('  ' + k + ': ' + sources[k])
  
  console.log('\nImage detail:')
  for (var j = 0; j < img.length; j++) {
    console.log('  ' + img[j].source_title.replace(/\s*—\s*Questão\s*\d+$/, '') + ' — ' + img[j].source_title.match(/Questão \d+/)[0])
  }
}

main().catch(console.error)
