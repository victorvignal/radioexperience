/**
 * Test various PDF image extraction methods for CBR PDFs
 * Goal: find why pdf-lib XObject fails for some PDFs
 */
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import zlib from 'zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')
const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function testPdf(pdfFile, label) {
  const pdfPath = path.join(CBR_BASE, pdfFile)
  const buffer = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(buffer)
  
  console.log(`\n=== ${label} ===`)
  console.log(`Pages: ${pdfDoc.getPages().length}`)
  
  let totalImages = 0
  let pageWithImages = 0
  
  for (let i = 0; i < pdfDoc.getPages().length; i++) {
    const page = pdfDoc.getPages()[i]
    const pageNum = i + 1
    
    // Try both access methods
    let xObject = null
    let resources = null
    
    // Method 1: direct get()
    try {
      resources = page.node.get(PDFName.of('Resources'))
    } catch {}
    
    // Method 2: lookup()
    if (!resources) {
      try {
        resources = page.node.lookup(PDFName.of('Resources'))
      } catch {}
    }
    
    if (!resources) continue
    
    // Try get XObject
    try {
      xObject = resources.get(PDFName.of('XObject'))
    } catch {}
    
    // Try lookup
    if (!xObject) {
      try {
        xObject = resources.lookup(PDFName.of('XObject'))
      } catch {}
    }
    
    if (!xObject || !(xObject instanceof PDFDict)) continue
    
    // Iterate entries
    let pageImages = 0
    for (const [name, ref] of xObject.entries()) {
      try {
        // Use pdfDoc.context.lookup (critical fix!)
        const stream = pdfDoc.context.lookup(ref)
        if (!stream) continue
        
        const dict = stream.dict || stream
        
        // Get subtype
        let subtype = null
        try { subtype = dict.get(PDFName.of('Subtype')) } catch {}
        if (!subtype) try { subtype = dict.lookup(PDFName.of('Subtype')) } catch {}
        
        if (!subtype) continue
        const subtypeStr = subtype.toString()
        
        if (subtypeStr !== '/Image') {
          // Check if it's a form (inline image)
          if (subtypeStr === '/Form') {
            // Try to get the contents
            let contents = null
            try { contents = stream.getContents() } catch {}
            if (contents) {
              const rawBytes = Buffer.from(contents)
              if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
                console.log(`  Page ${pageNum} [Form+JPEG] ${name} ${rawBytes.length}b`)
                pageImages++
              }
            }
          }
          continue
        }
        
        // Get filter
        let filter = null
        try { filter = dict.get(PDFName.of('Filter')) } catch {}
        if (!filter) try { filter = dict.lookup(PDFName.of('Filter')) } catch {}
        
        // Get raw bytes
        let rawBytes = null
        try {
          if (typeof stream.getContents === 'function') {
            const c = stream.getContents()
            rawBytes = Buffer.isBuffer(c) || c instanceof Uint8Array ? c : Buffer.from(c)
          } else if (stream.asUint8Array) {
            rawBytes = stream.asUint8Array()
          }
        } catch {}
        
        if (!rawBytes || rawBytes.length < 100) continue
        
        // Check JPEG
        if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
          console.log(`  Page ${pageNum} [JPEG] ${name} ${rawBytes.length}b filter=${filter?.toString()}`)
          pageImages++
          continue
        }
        
        // Check Deflate
        if (rawBytes[0] === 0x78) {
          try {
            const dec = zlib.inflateSync(rawBytes)
            if (dec[0] === 0xFF && dec[1] === 0xD8) {
              console.log(`  Page ${pageNum} [Deflate->JPEG] ${name} ${dec.length}b`)
              pageImages++
              continue
            }
          } catch {}
          // Try raw deflate
          try {
            const dec = zlib.inflateRawSync(rawBytes)
            if (dec[0] === 0xFF && dec[1] === 0xD8) {
              console.log(`  Page ${pageNum} [RawDeflate->JPEG] ${name} ${dec.length}b`)
              pageImages++
              continue
            }
          } catch {}
        }
        
        // Try FlateDecode with soft transform
        if (filter && filter.toString().includes('Flate')) {
          try {
            const dec = zlib.inflateSync(rawBytes)
            if (dec.length > 1000) {
              console.log(`  Page ${pageNum} [Flate] ${name} ${rawBytes.length}b -> ${dec.length}b firstbytes=${dec[0].toString(16)},${dec[1].toString(16)}`)
            }
          } catch {
            console.log(`  Page ${pageNum} [Unknown] ${name} ${rawBytes.length}b filter=${filter?.toString()} firstbytes=${rawBytes[0].toString(16)},${rawBytes[1].toString(16)}`)
          }
        }
        
      } catch (e) {
        console.log(`  Page ${pageNum} Error on entry ${name}: ${e.message}`)
      }
    }
    
    if (pageImages > 0) {
      totalImages += pageImages
      pageWithImages++
    }
  }
  
  console.log(`  Total: ${totalImages} images on ${pageWithImages} pages`)
  return { totalImages, pageWithImages }
}

async function main() {
  const tests = [
    ['RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf', 'RDDI 2024'],
    ['RDDI/2025/Prova-TP-com-Gabarito-2025.pdf', 'RDDI 2025'],
    ['USG/2023/Prova-Teorica-TP-v1-2023.pdf', 'USG 2023 V1'],
  ]
  
  for (const [file, label] of tests) {
    await testPdf(file, label)
  }
}

main().catch(console.error)
