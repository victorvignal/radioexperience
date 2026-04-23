/**
 * Debug PDF structure - investigate text encoding and image formats
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

const TEST_FILES = [
  { specialty: 'RDDI', year: 2024, file: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf' },
  { specialty: 'RDDI', year: 2025, file: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf' },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf' },
]

async function main() {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
  const { PDFDocument, PDFName, PDFDict, PDFStream } = await import('pdf-lib')

  for (const prova of TEST_FILES) {
    const pdfPath = path.join(CBR_BASE, prova.file)
    if (!fs.existsSync(pdfPath)) { console.log(`⚠️  Missing: ${prova.file}`); continue }
    
    console.log(`\n=== ${prova.specialty} ${prova.year} ===`)
    const buffer = fs.readFileSync(pdfPath)
    
    // 1. Try pdfjs text extraction and show raw items
    console.log('\n--- pdfjs text items (first 3 pages, first 5 items each) ---')
    try {
      const data = new Uint8Array(buffer)
      const doc = await pdfjsLib.getDocument({
        data,
        useWorkerFetch: false,
        isEvalEnabled: false,
        disableFontFace: true,
        useSystemFonts: true,
      }).promise
      
      console.log(`Pages: ${doc.numPages}`)
      
      for (let i = 1; i <= Math.min(3, doc.numPages); i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent({ includeAnnotationContent: false })
        console.log(`\nPage ${i} (${content.items.length} items):`)
        for (let j = 0; j < Math.min(5, content.items.length); j++) {
          const item = content.items[j]
          if ('str' in item) {
            console.log(`  [${j}] str="${item.str}", encoder="${item.encoded}", hasText="${item.hasText}", width=${item.width?.toFixed(1)}, transform=[${item.transform?.map(x=>x.toFixed(1)).join(',')}]`)
          } else {
            console.log(`  [${j}] (no str property)`, JSON.stringify(item).slice(0, 200))
          }
        }
      }
    } catch (e) {
      console.log(`pdfjs error: ${e.message}`)
    }

    // 2. Check PDF fonts via pdf-lib
    console.log('\n--- PDF fonts (page 1) ---')
    try {
      const pdfDoc = await PDFDocument.load(buffer)
      const pages = pdfDoc.getPages()
      if (pages.length > 0) {
        const page = pages[0]
        const resources = page.node.get(PDFName.of('Resources'))
        if (resources instanceof PDFDict) {
          const fonts = resources.get(PDFName.of('Font'))
          if (fonts) {
            if (fonts instanceof PDFDict) {
              for (const [name, ref] of fonts.entries()) {
                const font = fonts.context.lookup(ref)
                if (font instanceof PDFDict) {
                  const subtype = font.get(PDFName.of('Subtype'))?.toString()
                  const baseFont = font.get(PDFName.of('BaseFont'))?.toString()
                  const encoding = font.get(PDFName.of('Encoding'))?.toString()
                  const toUnicode = font.get(PDFName.of('ToUnicode'))
                  console.log(`  Font: name=${name.toString()}, subtype=${subtype}, baseFont=${baseFont}, encoding=${encoding}, hasToUnicode=${!!toUnicode}`)
                }
              }
            }
          } else {
            console.log('  No fonts found on page 1')
          }
        }
      }
    } catch (e) {
      console.log(`pdf-lib font error: ${e.message}`)
    }

    // 3. Check images via pdf-lib
    console.log('\n--- PDF images (all pages) ---')
    try {
      const pdfDoc = await PDFDocument.load(buffer)
      let totalImages = 0
      const imageTypes = new Set()
      
      for (let i = 0; i < pdfDoc.getPages().length; i++) {
        const page = pdfDoc.getPages()[i]
        const resources = page.node.get(PDFName.of('Resources'))
        if (!resources || !(resources instanceof PDFDict)) continue
        
        const xObject = resources.get(PDFName.of('XObject'))
        if (!xObject || !(xObject instanceof PDFDict)) continue
        
        for (const [name, ref] of xObject.entries()) {
          try {
            const stream = xObject.context.lookup(ref)
            if (!(stream instanceof PDFStream)) continue
            const dict = stream.dict
            const subtype = dict.lookup(PDFName.of('Subtype'))?.toString()
            if (!subtype || subtype !== '/Image') continue
            
            const filter = dict.lookup(PDFName.of('Filter'))?.toString()
            const width = dict.lookup(PDFName.of('Width'))?.asNumber()
            const height = dict.lookup(PDFName.of('Height'))?.asNumber()
            const length = dict.lookup(PDFName.of('Length'))?.asNumber()
            const bitsPerComponent = dict.lookup(PDFName.of('BitsPerComponent'))?.asNumber()
            const colorSpace = dict.lookup(PDFName.of('ColorSpace'))?.toString()
            
            totalImages++
            imageTypes.add(filter || 'raw')
            
            if (totalImages <= 5) {
              console.log(`  Page ${i+1}, img: filter=${filter}, size=${width}x${height}, bpp=${bitsPerComponent}, colorspace=${colorSpace}, bytes=${length}`)
            }
          } catch {}
        }
      }
      console.log(`  Total images: ${totalImages}, types: ${[...imageTypes].join(', ')}`)
    } catch (e) {
      console.log(`pdf-lib image error: ${e.message}`)
    }
  }
}

main().catch(console.error)