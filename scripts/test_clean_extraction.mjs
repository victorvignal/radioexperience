// Quick test of the extraction on RDDI 2024
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fs = require('fs')
const path = require('path')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

const pdfPath = path.join(CBR_BASE, 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')

// Use the same settings as cbr-extract-v3
async function main() {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, disableFontFace: true, useSystemFonts: true }).promise
  
  console.log('Total pages:', doc.numPages)
  
  // Test isCleanTextItem on items from page 3
  const page = await doc.getPage(3)
  const content = await page.getTextContent({ includeAnnotationContent: false })
  
  console.log('\nPage 3 items:')
  for (let j = 0; j < content.items.length; j++) {
    const item = content.items[j]
    if ('str' in item) {
      const text = item.str
      const isClean = isCleanTextItem(text)
      console.log(`[${j}] ${isClean ? 'OK  ' : 'SKIP'} "${text.substring(0, 80)}"`)
    }
  }
}

function isCleanTextItem(text) {
  if (!text || text.length === 0) return true
  let hasControlChar = false
  let suspiciousCharCount = 0
  for (const char of text) {
    const cp = char.codePointAt(0)
    if (cp < 0x0020 && cp !== 0x0009 && cp !== 0x000A && cp !== 0x000D) {
      hasControlChar = true; break
    }
    if (cp >= 0x007F && cp <= 0x009F) { hasControlChar = true; break }
    if (cp > 0x00FF && cp < 0x0100) suspiciousCharCount++
    if (cp >= 0xD800 || (cp >= 0xE000 && cp <= 0xF8FF)) { hasControlChar = true; break }
  }
  if (hasControlChar) return false
  if (text.length > 3 && suspiciousCharCount / text.length > 0.3) return false
  return true
}

main().catch(console.error)