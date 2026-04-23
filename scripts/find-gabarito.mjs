import { createRequire } from 'module'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts'
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  // Check RDDI 2023 Gabarito-Geral
  const files = [
    ['RDDI\\2023', 'Gabarito-Geral-2023.pdf'],
    ['RDDI\\2023', 'Gabarito-Teorico-Pratica-2023.pdf'],
    ['RDDI\\2025', 'Prova-TP-com-Gabarito-2025.pdf'],
    ['USG\\2023', 'Gabarito-USG-Geral-maio-2023.pdf'],
    ['USG\\2023', 'Gabarito-USG-Geral-junho-2023.pdf'],
  ]
  
  for (const [subdir, fname] of files) {
    const pdfPath = `${CBR_BASE}\\${subdir}\\${fname}`
    const data = new Uint8Array(fs.readFileSync(pdfPath))
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
    
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += '\n' + content.items.map(item => item.str).join('')
    }
    
    const hasGabarito = text.includes('GABARITO') || text.includes('Gabarito')
    const hasPattern = /\d{2}\s+[A-E]/.test(text) || /\d[A-E]\d[A-E]/.test(text)
    
    console.log(`\n${fname} (${doc.numPages} pages): GABARITO=${hasGabarito}, answer_pattern=${hasPattern}`)
    // Show last 200 chars
    console.log('  Last text:', text.trim().slice(-200).replace(/\s+/g, ' '))
  }
}

main().catch(console.error)