/**
 * Extract JPEGs from USG PDFs and map to questions
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT_DIR = path.join(__dirname, 'cbr_output')

function extractJpegsFromPdf(pdfPath) {
  const buffer = fs.readFileSync(pdfPath)
  const jpegs = []
  let searchFrom = 0
  while (true) {
    const start = buffer.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), searchFrom)
    if (start < 0) break
    const end = buffer.indexOf(Buffer.from([0xFF, 0xD9]), start + 3)
    if (end < 0) break
    const jpegData = buffer.slice(start, end + 2)
    if (jpegData.length > 5000) {
      jpegs.push({ index: jpegs.length + 1, data: jpegData, size: jpegData.length, offset: start })
    }
    searchFrom = end + 2
  }
  return jpegs
}

async function main() {
  const pdfs = [
    { name: 'USG_2023_V1', path: CBR_BASE + '\\USG\\2023\\Prova-Teorica-TP-v1-2023.pdf', jsonFile: 'cbr_usg_2023_v1_with_images.json', 
      mapping: [{ q: 7, page: 25 }, { q: 8, page: 26 }, { q: 9, page: 27 }, { q: 10, page: 28 }] },
    { name: 'USG_2023_V2', path: CBR_BASE + '\\USG\\2023\\Prova-Teorica-TP-v2-2023.pdf', jsonFile: 'cbr_usg_2023_v2_with_images.json', 
      mapping: [{ q: 7, page: 25 }, { q: 8, page: 26 }, { q: 9, page: 27 }, { q: 10, page: 28 }] },
  ]
  
  for (const pdf of pdfs) {
    console.log('\n--- ' + pdf.name + ' ---')
    
    const jpegs = extractJpegsFromPdf(pdf.path)
    console.log('Total JPEGs: ' + jpegs.length)
    
    // Load JSON
    const jsonPath = path.join(OUT_DIR, pdf.jsonFile)
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    
    // Assign: JPEG indices 7,8,9,10 (1-indexed) -> pages 25,26,27,28
    // From raw binary: JPEG 7 is at offset ~1.8MB (page 25 area)
    // JPEG 10 is at offset ~2.16MB (page 28 area)
    const jpegIndices = [7, 8, 9, 10]
    
    for (let i = 0; i < jpegIndices.length; i++) {
      const jpegIdx = jpegIndices[i] - 1 // 0-indexed
      const qNum = pdf.mapping[i].q
      const pageNum = pdf.mapping[i].page
      
      if (jpegs[jpegIdx]) {
        const jpeg = jpegs[jpegIdx]
        const base64 = jpeg.data.toString('base64')
        
        // Save JPEG
        const outPath = path.join(OUT_DIR, `${pdf.name}_Q${qNum}_page${pageNum}.jpg`)
        fs.writeFileSync(outPath, jpeg.data)
        console.log(`Q${qNum} (page ${pageNum}): JPEG ${jpegIdx+1} size=${jpeg.size} -> ${path.basename(outPath)}`)
        
        // Update JSON
        const q = jsonData.questions.find(q => q.number === qNum)
        if (q) {
          q.has_image = true
          q.image_base64 = base64
          console.log(`  -> Updated Q${qNum} (${base64.length} chars base64)`)
        }
      } else {
        console.log(`Q${qNum}: JPEG index ${jpegIdx} not found`)
      }
    }
    
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2))
    console.log('Saved: ' + pdf.jsonFile)
  }
  
  console.log('\nDone!')
}

main().catch(e => { console.error(e); process.exit(1) })
