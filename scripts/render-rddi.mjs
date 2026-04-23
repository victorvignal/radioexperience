/**
 * Render RDDI 2024 pages 50-55 as JPEG images using pdf-lib
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pml = require('pdf-lib')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT_DIR = __dirname + '\\cbr_output'

async function main() {
  const pdfPath = CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  const data = fs.readFileSync(pdfPath)
  const doc = await pml.PDFDocument.load(data)
  
  console.log('Total pages:', doc.getPageCount())
  
  // Pages 50-55 → Q49-Q54 (1-indexed pages)
  // pdf-lib pages are 0-indexed
  const pageToQ = { 49: 49, 50: 50, 51: 51, 52: 52, 53: 53, 54: 54 }
  
  for (const [pageIdx, qNum] of Object.entries(pageToQ)) {
    const page = doc.getPage(parseInt(pageIdx))
    const { width, height } = page.getSize()
    
    // Render page to PNG using pdf-lib's embedded image
    // We can convert each page to an image by drawing it on a canvas context
    // pdf-lib doesn't have native canvas, but we can use the Node.js canvas package
    try {
      const { createCanvas } = require('canvas')
      const canvas = createCanvas(Math.floor(width * 1.5), Math.floor(height * 1.5))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Use pdf-lib to get page content as image
      // We can use the page as an image source for pdf-lib
      const jpegBytes = await page.render().canvas(canvas, { scale: 1.5 }).jpeg({ quality: 90 })
      
      // Actually pdf-lib's render API might be different
      // Let me use a simpler approach with Node canvas + pdf-lib
      const imgData = await page.render().canvas({
        canvas: createCanvas(Math.floor(width * 1.5), Math.floor(height * 1.5)),
        scale: 1.5
      })
      
      const buf = imgData.asJPEG()
      const outPath = OUT_DIR + `\\rddi_2024_q${qNum}.jpg`
      fs.writeFileSync(outPath, buf)
      console.log(`Q${qNum} (page ${parseInt(pageIdx)+1}): ${buf.length} bytes`)
    } catch(e) {
      console.log(`Q${qNum} render error:`, e.message)
    }
  }
}

main().catch(console.error)