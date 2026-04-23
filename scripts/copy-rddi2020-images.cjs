/**
 * Copy images from extracted_rddi-2020-anual.json into extracted_RDDI_2020.json
 */
const fs = require('fs')
const path = require('path')

const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

function loadQuestions(jsonPath) {
  const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object' && d.questions) return d.questions
  if (d && typeof d === 'object') return Object.values(d)
  return []
}

async function main() {
  // Load both RDDI 2020 versions
  const srcPath = path.join(OUT, 'extracted_rddi-2020-anual.json')
  const dstPath = path.join(OUT, 'extracted_RDDI_2020.json')
  
  const srcQ = loadQuestions(srcPath)
  const dstQ = loadQuestions(dstPath)
  
  console.log('Source (anual) Q:', srcQ.length, '| with img:', srcQ.filter(q => q && q.image_base64).length)
  console.log('Dest (capital) Q:', dstQ.length, '| with img:', dstQ.filter(q => q && q.image_base64).length)
  
  // Build image lookup by question_number from source
  const srcByNum = {}
  for (const q of srcQ) {
    if (q && q.image_base64) {
      const n = q.question_number || q.number
      srcByNum[n] = q.image_base64
    }
  }
  console.log('Source images by Q#:', Object.keys(srcByNum).sort().join(','))
  
  // Copy images into dest (capital version)
  let updated = 0
  for (const q of dstQ) {
    if (!q) continue
    const n = q.question_number || q.number
    if (srcByNum[n]) {
      q.image_base64 = srcByNum[n]
      q.has_image = true
      updated++
    }
  }
  console.log('Updated in dest:', updated)
  
  // Save
  fs.writeFileSync(dstPath, JSON.stringify(dstQ, null, 2))
  console.log('Saved to', dstPath)
  
  // Verify
  const verQ = loadQuestions(dstPath)
  console.log('Dest now with images:', verQ.filter(q => q && q.image_base64).length)
}

main().catch(console.error)
