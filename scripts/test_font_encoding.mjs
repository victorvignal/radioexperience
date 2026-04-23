// Deep inspect page 3 of RDDI 2024
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fs = require('fs')
const { PDFDocument, PDFName, PDFDict, PDFStream } = require('pdf-lib')

async function main() {
  const pdfPath = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  const buffer = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(buffer)
  
  const pages = pdfDoc.getPages()
  
  // Page 3 (index 2)
  const page = pages[2]
  console.log('Page 3 dict keys:', page.node.keys ? [...page.node.keys()].map(k => k.toString()) : Object.keys(page.node))
  
  // Get resources via lookup
  let resources
  try { resources = page.node.lookup(PDFName.of('Resources')) } catch {}
  console.log('Resources type:', resources?.constructor?.name)
  if (resources instanceof PDFDict) {
    console.log('Resources keys:', [...resources.keys()].map(k => k.toString()))
    
    const fonts = resources.lookup(PDFName.of('Font'))
    console.log('Fonts type:', fonts?.constructor?.name)
    if (fonts instanceof PDFDict) {
      console.log('Font keys:', [...fonts.keys()].map(k => k.toString()))
      for (const [name, ref] of fonts.entries()) {
        const font = pdfDoc.context.lookup(ref)
        console.log(`  ${name}: type=${font?.constructor?.name}`)
        if (font instanceof PDFDict) {
          const subtype = font.get(PDFName.of('Subtype'))?.toString()
          const baseFont = font.get(PDFName.of('BaseFont'))?.toString()
          console.log(`    subtype=${subtype}, baseFont=${baseFont}`)
        }
      }
    }
  }
  
  // Also check ContentStreams
  const contents = page.node.get(PDFName.of('Contents'))
  console.log('Contents:', contents?.constructor?.name, contents ? (contents instanceof PDFStream ? 'is stream' : 'not stream') : 'none')
  
  // Check if MediaBox is present
  const mediaBox = page.node.get(PDFName.of('MediaBox'))
  console.log('MediaBox:', mediaBox)
}

main().catch(console.error)