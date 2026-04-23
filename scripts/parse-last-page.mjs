import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  // USG 2020 - last page has answers as continuous text
  const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const lastPage = await doc.getPage(doc.numPages)
  const content = await lastPage.getTextContent()
  const lastText = content.items.map(i => i.str).join('')
  console.log('USG 2020 last page text:', JSON.stringify(lastText))
  
  // The text is something like "...40 C41 D42 C43 D44 D45 A46 D47 B48 B49 E50 D"
  // We need to find Q41-50 from this format, and Q1-40 from earlier in the text
  
  // Try dense parse: read char by char
  const answers = {}
  let i = 0
  while (i < lastText.length) {
    while (i < lastText.length && (lastText.charCodeAt(i) < 48 || lastText.charCodeAt(i) > 57)) i++
    if (i >= lastText.length) break
    let numStr = ''
    while (i < lastText.length && lastText.charCodeAt(i) >= 48 && lastText.charCodeAt(i) <= 57) numStr += lastText[i++]
    // Skip any whitespace/spaces
    while (i < lastText.length && (lastText.charCodeAt(i) <= 32 || lastText.charCodeAt(i) === 160)) i++
    if (i >= lastText.length) break
    const letter = lastText[i].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      i++
      const n = parseInt(numStr)
      if (n >= 1 && n <= 100) answers[n] = letter
    }
  }
  console.log('\nUSG 2020 dense parse:', Object.keys(answers).sort((a,b)=>a-b).map(n=>n+answers[n]).join(' '))
  
  // USG 2025 last page
  console.log('\n--- USG 2025 ---')
  const data2025 = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf'))
  const doc2025 = await pdfjsLib.getDocument({ data: data2025, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const last2025 = await doc2025.getPage(doc2025.numPages)
  const content2025 = await last2025.getTextContent()
  const lastText2025 = content2025.items.map(i => i.str).join('')
  console.log('USG 2025 last page:', JSON.stringify(lastText2025))
  
  // Parse USG 2025 dense
  const answers2025 = {}
  i = 0
  while (i < lastText2025.length) {
    while (i < lastText2025.length && (lastText2025.charCodeAt(i) < 48 || lastText2025.charCodeAt(i) > 57)) i++
    if (i >= lastText2025.length) break
    let numStr = ''
    while (i < lastText2025.length && lastText2025.charCodeAt(i) >= 48 && lastText2025.charCodeAt(i) <= 57) numStr += lastText2025[i++]
    while (i < lastText2025.length && (lastText2025.charCodeAt(i) <= 32 || lastText2025.charCodeAt(i) === 160)) i++
    if (i >= lastText2025.length) break
    const letter = lastText2025[i].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      i++
      const n = parseInt(numStr)
      if (n >= 1 && n <= 100) answers2025[n] = letter
    }
  }
  console.log('USG 2025 dense:', Object.keys(answers2025).sort((a,b)=>a-b).map(n=>n+answers2025[n]).join(' '))
}

main().catch(console.error)