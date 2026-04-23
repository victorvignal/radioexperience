// Detailed page analysis - v2
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const fs = require('fs')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const data = new Uint8Array(fs.readFileSync('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, disableFontFace: true, useSystemFonts: true }).promise
  
  for (const pageNum of [1, 2, 3]) {
    console.log(`\n=== Page ${pageNum} ===`)
    const page = await doc.getPage(pageNum)
    
    // Get operator list
    const opList = await page.getOperatorList()
    console.log('Operator count:', opList.fnArray.length)
    
    // Count operators
    const ops = {}
    for (const fn of opList.fnArray) {
      const name = pdfjsLib.OPS[fn] || `op${fn}`
      ops[name] = (ops[name] || 0) + 1
    }
    // Show only non-zero
    const interesting = Object.entries(ops).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1])
    console.log('Top operators:', interesting.slice(0, 20))
    
    // Check for paintInlineImageXObject
    const paintInline = ops['paintInlineImageXObject'] || 0
    const paintImageXObject = ops['paintImageXObject'] || 0
    const paintImageMaskXObject = ops['paintImageMaskXObject'] || 0
    console.log('paintInlineImageXObject:', paintInline, 'paintImageXObject:', paintImageXObject, 'paintImageMaskXObject:', paintImageMaskXObject)
  }
}

main().catch(console.error)