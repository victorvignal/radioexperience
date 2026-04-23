import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    text += '\n' + (await page.getTextContent()).items.map(item => item.str).join(' ')
  }
  return text
}

async function main() {
  const pdfPath = CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf'
  const text = await extractTextFromPDF(pdfPath)
  
  // Search for "57" near end
  const idx57 = text.indexOf('57')
  const idx58 = text.indexOf('58')
  console.log('Index of "57":', idx57, '| "58":', idx58, '| text length:', text.length)
  
  // Look at last 500 chars
  const last500 = text.slice(-500).replace(/\s+/g, ' ')
  console.log('\nLast 500 chars:\n', last500)
  
  // Try to find answer patterns at the end
  const lastPage = text.split('\n').slice(-20).join(' ')
  console.log('\nLast 20 lines joined:\n', lastPage.replace(/\s+/g, ' ').slice(-300))
  
  // Try dense pattern
  const reDense = /(\d+)([A-E])(?=\d)/g
  const matches = []
  let m
  while ((m = reDense.exec(text)) !== null) {
    matches.push(m[1] + m[2])
  }
  console.log('\nDense matches (last 20):', matches.slice(-20).join(' '))
  
  // Try spaced pattern
  const reSpaced = /(\d+)\s+([A-E])\b/g
  const spacedMatches = []
  while ((m = reSpaced.exec(text)) !== null) {
    spacedMatches.push(m[1] + m[2])
  }
  console.log('Spaced matches (last 20):', spacedMatches.slice(-20).join(' '))
}

main().catch(console.error)