import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function inspectPdf(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  let hasImagePages = 0
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join('')
    // Check if page mentions image-related keywords
    if (text.includes('Imagem') || text.includes('figura') || text.includes('observe') || text.includes('Figura')) {
      hasImagePages++
      console.log(`Page ${i}: ${text.slice(0, 100).replace(/\s+/g, ' ')}`)
    }
  }
  
  console.log(`Total pages: ${doc.numPages}, Image-related pages: ${hasImagePages}`)
}

await inspectPdf(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')
