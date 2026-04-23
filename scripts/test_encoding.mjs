// Investigate why some text is clean and some is corrupted
// The key question: why does "Paciente do sexo..." decode correctly but "SDWROyJLFD" doesn't?
// Both should use the same font (ArialMT) but with different glyph mappings
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fs = require('fs')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const data = new Uint8Array(fs.readFileSync('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, disableFontFace: true, useSystemFonts: true }).promise
  const page = await doc.getPage(3)
  const content = await page.getTextContent()
  
  console.log('All items:')
  for (let j = 0; j < content.items.length; j++) {
    const item = content.items[j]
    if ('str' in item) {
      const hasControlChars = [...item.str].some(c => c.codePointAt(0) < 0x0020 || c.codePointAt(0) > 0x007E)
      const isCorrupted = /[©§¨ª²³¹µ¿]/.test(item.str) || /[SDWROyJLFD]/.test(item.str.substring(0, 10))
      console.log(`[${j}] ${isCorrupted ? 'CORRUPT' : hasControlChars ? 'CTRL' : 'CLEAN '} "${item.str.substring(0, 60)}"`)
    }
  }
}

main().catch(console.error)