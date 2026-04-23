const https = require('https')
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

const req = https.request('https://pcdequsipbkxcfsewiow.supabase.co/rest/v1/challenge_question_pool?select=source_title,has_image,image_base64&limit=400', {
  headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
}, function(res) {
  let d = ''
  res.on('data', function(c) { d += c })
  res.on('end', function() {
    const pools = JSON.parse(d)
    console.log('Total pools: ' + pools.length)
    const withImg = pools.filter(function(p) { return p.has_image })
    console.log('With images: ' + withImg.length)
    const sources = {}
    for (var i = 0; i < pools.length; i++) {
      var src = pools[i].source_title.substring(0, 60)
      sources[src] = (sources[src] || 0) + 1
    }
    console.log('\nSources:')
    for (var k in sources) console.log('  ' + k + ': ' + sources[k])
    console.log('\nImage pools:')
    for (var j = 0; j < withImg.length; j++) {
      var p = withImg[j]
      var imgLen = p.image_base64 ? p.image_base64.length : 0
      console.log('  ' + p.source_title + ' (' + imgLen + 'b)')
    }
  })
})
req.on('error', function(e) { console.error(e) })
req.end()
