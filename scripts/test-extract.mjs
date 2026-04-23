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

async function parseSpacedGabarito(text) {
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

async function parseDenseGabarito(text) {
  const answers = {}
  const re = /(\d{1,3})([A-E])(?=\d|$)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

// Try to extract questions from a prova PDF by finding numbered patterns
async function extractQuestionsFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  const questions = []
  
  // Scan all pages for question numbers
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join(' ')
    
    // Find all "Questão N" or "QUESTÃO N" patterns
    const questMatches = [...text.matchAll(/(?:Questão|QUESTÃO|Q\.?)\s*(\d+)/gi)]
    
    for (const match of questMatches) {
      const qNum = parseInt(match[1])
      if (qNum >= 1 && qNum <= 300) {
        // Find the text after the question marker
        const startIdx = match.index + match[0].length
        const remaining = text.slice(startIdx, startIdx + 500)
        
        // Try to extract options (A), (B), etc.
        const options = []
        const optRe = /([A-E])\s*[\.\)]\s*(.{10,100}?)(?=[A-E]\s*[\.\)]|$)/gi
        for (const opt of remaining.matchAll(optRe)) {
          options.push(opt[0].trim())
        }
        
        if (options.length >= 2) {
          questions.push({
            number: String(qNum),
            text: remaining.replace(/\s+/g, ' ').slice(0, 400),
            options: options.slice(0, 5),
            page: pageNum,
          })
        }
      }
    }
  }
  
  // Deduplicate by number
  const seen = new Set()
  const deduped = []
  for (const q of questions) {
    if (!seen.has(q.number)) {
      seen.add(q.number)
      deduped.push(q)
    } else {
      // Update if this one has options but the stored one doesn't
      const existing = deduped.find(d => d.number === q.number)
      if (existing && existing.options.length < 2 && q.options.length >= 2) {
        Object.assign(existing, q)
      }
    }
  }
  
  return deduped.sort((a, b) => parseInt(a.number) - parseInt(b.number))
}

async function main() {
  // Test extraction on USG 2018
  console.log('=== Extracting USG 2018 questions ===')
  const usg2018Path = CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf'
  const questions = await extractQuestionsFromPDF(usg2018Path)
  console.log('Extracted:', questions.length, 'questions')
  console.log('Range:', questions[0]?.number, '-', questions[questions.length-1]?.number)
  if (questions.length > 0) {
    console.log('Sample Q1:', questions[0].text.slice(0, 80))
    console.log('Options:', questions[0].options.join(' | '))
  }
  
  // Parse gabarito from USG 2018
  console.log('\n=== USG 2018 gabarito ===')
  const text = await extractTextFromPDF(usg2018Path)
  const answers = parseDenseGabarito(text)
  console.log('Dense answers:', Object.keys(answers).length)
  const denseSample = Object.keys(answers).map(Number).sort((a,b)=>a-b).slice(0,10).map(n=>n+answers[n]).join(' ')
  console.log('Sample:', denseSample)
  
  // Try spaced parser
  const spaced = parseSpacedGabarito(text)
  console.log('Spaced answers:', Object.keys(spaced).length)
  if (Object.keys(spaced).length > Object.keys(answers).length) {
    const spacedSample = Object.keys(spaced).map(Number).sort((a,b)=>a-b).slice(0,10).map(n=>n+spaced[n]).join(' ')
    console.log('Spaced sample:', spacedSample)
  }
  
  // Check how many extracted questions match answers
  const matched = questions.filter(q => answers[parseInt(q.number)] || spaced[parseInt(q.number)]).length
  console.log('\nMatched to dense:', matched, '/', questions.length)
}

main().catch(console.error)