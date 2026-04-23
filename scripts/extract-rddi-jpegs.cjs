/**
 * Extract all JPEGs from RDDI 2024 PDF via raw binary scan
 * Then map each JPEG to a page/question number
 */
const fs = require('fs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

function extractJPEGs(buffer) {
  const jpegs = []
  let i = 0
  while (i < buffer.length - 1) {
    if (buffer[i] === 0xFF && buffer[i+1] === 0xD8) {
      // JPEG start found
      let end = i + 2
      while (end < buffer.length - 1) {
        if (buffer[end] === 0xFF && buffer[end+1] === 0xD9) {
          end += 2
          break
        }
        end++
      }
      if (end - i > 1000) { // Only save JPEGs > 1KB
        jpegs.push({ offset: i, length: end - i, data: buffer.slice(i, end) })
      }
      i = end
    } else {
      i++
    }
  }
  return jpegs
}

function main() {
  const buf = fs.readFileSync(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')
  console.log('PDF size:', buf.length, 'bytes')
  
  const jpegs = extractJPEGs(buf)
  console.log('Extracted JPEGs:', jpegs.length)
  
  // Save all JPEGs
  jpegs.forEach((j, idx) => {
    const name = `rddi_2024_jpeg_${String(idx).padStart(3, '0')}_off${j.offset}.jpg`
    fs.writeFileSync(OUT + '\\jpeg_src\\' + name, j.data)
  })
  console.log('Saved to', OUT + '\\jpeg_src\\')
  
  // Now map JPEG offsets to PDF pages
  // We can analyze: how many JPEGs per page range?
  // RDDI 2024 has 62 pages, 60 questions
  // Pages 1-49: mostly text-only
  // Pages 50-62: last 12 questions (Q49-Q60) with images
  
  // Save the last 12 pages' JPEGs separately (the ones most likely to be Q49-Q60)
  // We know pages 50-55 had 1-2 images each from pdf.js operator list check
  // So likely 10-12 JPEGs in pages 50-61 (Q49-Q60)
  
  // Save each JPEG and track its offset
  const stats = jpegs.map((j, i) => ({ idx: i, offset: j.offset, size: j.length }))
  stats.sort((a, b) => a.offset - b.offset)
  
  console.log('\nJPEG offsets:')
  stats.slice(-15).forEach(s => console.log(`  JPEG ${s.idx}: offset=${s.offset}, size=${s.size}`))
  
  // The JPEGs appear in the latter half of the PDF
  // Total PDF = 8.4MB, JPEGs start appearing after offset 1MB or so
  const firstHalf = jpegs.filter(j => j.offset > buf.length / 2)
  console.log('\nJPEGs in second half of file:', firstHalf.length)
  
  // Save each JPEG to a numbered file
  for (let i = 0; i < jpegs.length; i++) {
    const n = String(i).padStart(3, '0')
    fs.writeFileSync(OUT + '\\jpeg_src\\rddi_2024_jpeg_' + n + '.jpg', jpegs[i].data)
  }
  console.log('\nSaved', jpegs.length, 'JPEGs to', OUT + '\\jpeg_src')
}

main()