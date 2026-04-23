import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    text += '\n' + (await page.getTextContent()).items.map(i => i.str).join(' ')
  }
  return text
}

function parseSpacedGabarito(text) {
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

async function main() {
  // Check what the JSON questions look like
  const v2Path = OUT + '\\cbr_rddi_2024_with_images_v2.json'
  const v2 = JSON.parse(fs.readFileSync(v2Path, 'utf8'))
  console.log('v2 JSON has', v2.questions.length, 'questions')
  console.log('First 5 question numbers and first 50 chars of text:')
  v2.questions.slice(0, 5).forEach(q => {
    console.log(`  Q${q.number}: ${q.text.slice(0, 60).replace(/\n/g, '↵')}`)
  })
  console.log('\nLast 5 question numbers:')
  v2.questions.slice(-5).forEach(q => {
    console.log(`  Q${q.number}: ${q.text.slice(0, 60).replace(/\n/g, '↵')}`)
  })
  
  // Now check if these match the gabarito
  const text = await extractTextFromPDF(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf')
  const gabIdx = text.indexOf('GABARITO')
  const snippet = text.slice(gabIdx, gabIdx + 300).replace(/\s+/g, ' ')
  console.log('\nRDDI 2024 gabarito snippet:', snippet.slice(0, 150))
  
  const gab = parseSpacedGabarito(text)
  console.log('\nGabarito keys (first 20):', Object.keys(gab).slice(0, 20).join(', '))
  
  // Try to match JSON Q numbers to gabarito
  const v2nums = v2.questions.map(q => parseInt(q.number)).filter(n => !isNaN(n))
  const matched = v2nums.filter(n => gab[n]).length
  console.log('\nv2 JSON numbers matched to gabarito:', matched, '/', v2nums.length)
  console.log('v2 JSON number range:', Math.min(...v2nums), '-', Math.max(...v2nums))
  
  // Maybe the numbers in v2 JSON are NOT the question numbers?
  // Check: are there duplicate numbers in v2?
  const numCount = {}
  v2nums.forEach(n => { numCount[n] = (numCount[n]||0) + 1 })
  const duplicates = Object.entries(numCount).filter(([n,c]) => c > 1)
  console.log('\nDuplicate numbers in v2:', duplicates.slice(0, 10).map(([n,c])=>n+'x'+c).join(', '))
  
  // Check USG 2023 JSON
  const usgv1Path = OUT + '\\cbr_usg_2023_v1_with_images.json'
  const usgv1 = JSON.parse(fs.readFileSync(usgv1Path, 'utf8'))
  console.log('\nUSG V1 JSON:', usgv1.questions.length, 'questions')
  const usgv1nums = usgv1.questions.map(q => parseInt(q.number)).filter(n => !isNaN(n))
  console.log('USG V1 number range:', Math.min(...usgv1nums), '-', Math.max(...usgv1nums), '| unique:', [...new Set(usgv1nums)].length)
  
  // Check the USG 2023 May gabarito
  const mayText = await extractTextFromPDF(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf')
  const mayGabIdx = mayText.indexOf('GABARITO')
  const maySnippet = mayText.slice(mayGabIdx, mayGabIdx + 200).replace(/\s+/g, ' ')
  console.log('\nUSG May gabarito snippet:', maySnippet.slice(0, 120))
  
  const mayGab = parseSpacedGabarito(mayText)
  console.log('May gab keys:', Object.keys(mayGab).slice(0, 20).join(', '))
  
  const usgv1matched = usgv1nums.filter(n => mayGab[n]).length
  console.log('\nUSG V1 nums matched to May gab:', usgv1matched, '/', usgv1nums.length)
}

main().catch(console.error)