/**
 * RDDI 2024 Image Extractor — Walk ALL PDF objects directly
 * Bypasses page Resources/XObject lookup - walks the ENTIRE PDF object tree
 */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const PDF_PATH = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

async function walkAllObjects(pdfBytes) {
  // Parse PDF objects from the byte stream
  // Look for patterns like "NNN 0 obj<</.../Subtype /Image...>>stream" or "NNN 0 obj<</Subtype/Image...>>"
  const objects = []
  
  // Use pdf-lib to get all objects
  const { PDFDocument, PDFName, PDFDict, PDFRawStream } = require('pdf-lib')
  const pdfDoc = await PDFDocument.load(pdfBytes)
  
  console.log('PDF loaded, catalog:', pdfDoc.catalog.toString().substring(0, 100))
  
  // Walk all objects via the context
  const context = pdfDoc.context
  
  // Try to get the trailer
  const trailer = context.trailer
  console.log('Trailer keys:', trailer ? Object.keys(trailer.dict || trailer) : 'none')
  
  // Get the Pages tree root
  let root = null
  try { root = trailer.get(PDFName.of('Root')) } catch {}
  if (!root) { console.log('No Root'); return }
  
  // Navigate to Pages
  let pages = null
  try {
    const rootObj = context.lookup(root)
    console.log('Root type:', rootObj?.constructor?.name)
    pages = rootObj?.get(PDFName.of('Pages'))
    if (pages) {
      const pagesObj = context.lookup(pages)
      console.log('Pages type:', pagesObj?.constructor?.name)
      console.log('Pages count:', pagesObj?.get(PDFName.of('Count'))?.toString())
    }
  } catch (e) { console.log('Pages nav error:', e.message) }
  
  // Collect ALL Image XObjects by walking the entire object hierarchy
  const allImages = []
  const visited = new Set()
  
  function walkObject(obj, depth = 0) {
    if (depth > 10 || !obj || visited.has(obj)) return
    try {
      visited.add(obj)
      
      if (obj instanceof PDFDict || obj?.dict) {
        // Check if this is an Image
        const dict = obj instanceof PDFDict ? obj : obj.dict
        try {
          const subtype = dict.lookup(PDFName.of('Subtype'))
          if (subtype?.toString() === '/Image') {
            // Found an image! Get details
            const width = dict.lookup(PDFName.of('Width'))?.toString()
            const height = dict.lookup(PDFName.of('Height'))?.toString()
            const filter = dict.lookup(PDFName.of('Filter'))?.toString()
            console.log(`  Found Image XObject: ${width}x${height} filter=${filter}`)
            allImages.push({ width, height, filter, dict: obj })
          }
        } catch {}
        
        // Recurse into dict values
        try {
          for (const key of dict.keys()) {
            const val = dict.get(key)
            if (val) walkObject(val, depth + 1)
          }
        } catch {}
      }
      
      // Handle PDFArray
      if (obj && obj.constructor?.name === 'PDFArray') {
        try {
          for (let i = 0; i < obj.size(); i++) {
            const item = obj.lookup(i)
            if (item) walkObject(item, depth + 1)
          }
        } catch {}
      }
    } catch {}
  }
  
  // Start from catalog
  try {
    const rootObj = context.lookup(root)
    if (rootObj) walkObject(rootObj)
  } catch (e) { console.log('Walk error:', e.message) }
  
  console.log(`\nTotal Image XObjects found by tree walk: ${allImages.length}`)
  return allImages
}

// Also try: direct object number iteration
async function findAllImageStreams(pdfBytes) {
  const { PDFDocument, PDFName } = require('pdf-lib')
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const context = pdfDoc.context
  
  // Look for all N 0 obj with /Subtype /Image
  // PDF object number pattern: digit+ 0 obj
  const str = pdfBytes.toString('binary')
  const results = []
  
  // Search for "/Subtype /Image" pattern
  const pattern = '/Subtype /Image'
  let pos = 0
  while ((pos = str.indexOf(pattern, pos)) !== -1) {
    // Find the object number before this
    const before = str.slice(Math.max(0, pos - 200), pos)
    const objMatch = before.match(/(\d+)\s+0\s+obj/)
    if (objMatch) {
      const objNum = parseInt(objMatch[1])
      console.log(`Found /Subtype /Image at offset ${pos}, object ${objNum}`)
      results.push({ offset: pos, objNum })
    }
    pos += pattern.length
  }
  
  return results
}

// Try extracting JPEG from an object number
async function extractJpegFromObject(pdfDoc, objNum) {
  const context = pdfDoc.context
  try {
    const ref = context.lookup(require('pdf-lib').PDFRef.of(objNum, 0))
    console.log(`Object ${objNum}: type=${ref?.constructor?.name}`)
    if (ref?.dict) {
      const dict = ref.dict
      console.log('  Keys:', [...dict.keys()].map(k => k.toString()).join(', '))
    }
  } catch (e) {
    console.log(`Object ${objNum} error: ${e.message}`)
  }
}

async function main() {
  const buf = fs.readFileSync(PDF_PATH)
  console.log(`PDF size: ${buf.length} bytes\n`)
  
  console.log('=== Method 1: Walk all objects ===')
  await walkAllObjects(buf)
  
  console.log('\n=== Method 2: Find /Subtype /Image in raw bytes ===')
  const imageStreams = await findAllImageStreams(buf)
  console.log(`Found ${imageStreams.length} image streams`)
  
  // Try to extract actual JPEG data from first few image streams
  if (imageStreams.length > 0) {
    console.log('\n=== Method 3: Extract JPEG from found streams ===')
    const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')
    const pdfDoc = await PDFDocument.load(buf)
    
    for (const { objNum } of imageStreams.slice(0, 3)) {
      await extractJpegFromObject(pdfDoc, objNum)
    }
  }
}

main().catch(console.error)
