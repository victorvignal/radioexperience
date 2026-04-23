const https = require('https')
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

function get(path) {
  return new Promise((resolve) => {
    const req = https.request('https://pcdequsipbkxcfsewiow.supabase.co' + path, {
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    }, function(res) { let d = ''; res.on('data', function(c){d+=c}); res.on('end', function(){try{resolve(JSON.parse(d))}catch{e resolve([])}}) })
    req.on('error', function() { resolve([]) })
    req.end()
  })
}

async function main() {
  const pools = await get('/rest/v1/challenge_question_pool?select=source_title,has_image,image_base64&source_title=ilike.*CBR*&limit=500')
  const cbr = Array.isArray(pools) ? pools : []
  console.log('CBR pools: ' + cbr.length)
  const withImg = cbr.filter(function(p){return p.has_image})
  console.log('With images: ' + withImg.length)
  const sources = {}
  for (const p of cbr) {
    const m = p.source_title.match(/CBR\s+(RDDI|USG)\s+\S+/)
    const src = m ? m[0] : p.source_title
    sources[src] = (sources[src] || 0) + 1
  }
  console.log('\nBy source:')
  for (const [src, cnt] of Object.entries(sources)) console.log('  ' + src + ': ' + cnt)
  console.log('\nWith images detail:')
  for (const p of withImg) console.log('  ' + p.source_title + ' (' + (p.image_base64 ? p.image_base64.length + 'b' : 'no img data') + ')')
}

main().catch(console.error)
