import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function test() {
  const pdfPath = CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const page = await doc.getPage(doc.numPages)
  const content = await page.getTextContent()
  const text = content.items.map(i => i.str).join('')
  const gabIdx = text.indexOf('GABARITO')
  
  // Raw after GABARITO
  const raw = text.slice(gabIdx)
  console.log('Raw text (repr):', JSON.stringify(raw))
  console.log('Raw length:', raw.length)
  
  // Now test the parser
  const answers = {}
  const normalized = raw.replace(/\s+/g, ' ').trim()
  console.log('\nNormalized:', JSON.stringify(normalized))
  console.log('Normalized length:', normalized.length)
  
  let i = 0
  let count = 0
  while (i < normalized.length && count < 65) {
    count++
    let numStr = '', letter
    while (i < normalized.length && normalized[i] >= '0' && normalized[i] <= '9') {
      numStr += normalized[i++]
    }
    while (i < normalized.length && normalized[i] === ' ') i++
    letter = normalized[i++]
    if (numStr && letter && letter >= 'A' && letter <= 'Z') {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 200) answers[n] = letter
    }
    while (i < normalized.length && normalized[i] === ' ') i++
  }
  
  console.log('\nAnswers found:', Object.keys(answers).length)
  const nums = Object.keys(answers).map(Number).sort((a,b)=>a-b)
  console.log('Sample:', nums.slice(0,15).map(n=>n+answers[n]).join(' '))
  console.log('Last 5:', nums.slice(-5).map(n=>n+answers[n]).join(' '))
}

test().catch(console.error)