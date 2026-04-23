import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }
ensureDir(OUT)

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let fullText = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    fullText += '\n' + content.items.map(item => item.str).join(' ')
  }
  return fullText
}

// Parse "QUESTÃO N" format (RDDI-style with spaced letters)
function parseRDDIFormat(fullText) {
  const questions = []
  const parts = fullText.split(/(?=QUESTÃO\s*\d+)/i)
  
  for (const part of parts) {
    if (!part.trim()) continue
    const numMatch = part.match(/QUESTÃO\s*(\d+)/i)
    if (!numMatch) continue
    const qNum = parseInt(numMatch[1])
    if (qNum < 1 || qNum > 300) continue
    
    let body = part.replace(/QUESTÃO\s*\d+/i, '')
    
    // Split by "A)" pattern (A U E I O at start of word, followed by ) or .)
    const sections = body.split(/(?=[A-EU]\)\s*)/)
    
    const questionText = (sections[0] || body).replace(/\s+/g, ' ').trim()
    const options = []
    
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      // Match "A)" or "E)" etc at start
      const optMatch = sec.match(/^([A-EU])\)\s*(.+)/s)
      if (optMatch && optMatch[1] !== 'U') { // U is not a valid option letter
        options.push(optMatch[0].trim())
      }
    }
    
    if (questionText.length > 5 && options.length >= 2) {
      questions.push({ number: String(qNum), text: questionText, options, correct_answer: null, difficulty: 'medium', explanation: '' })
    }
  }
  
  // Deduplicate by number
  const seen = new Set()
  return questions.filter(q => {
    if (seen.has(q.number)) return false
    seen.add(q.number)
    return true
  })
}

function parseGabaritoSpaced(text) {
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

async function processExam(label, provaPath, gabaritoPaths) {
  console.log(`\n=== ${label} ===`)
  
  if (!fs.existsSync(provaPath)) {
    console.log('  Prova not found:', provaPath)
    return []
  }
  
  const provaText = await extractTextFromPDF(provaPath)
  console.log('  Prova text length:', provaText.length)
  
  // Extract questions
  let questions = parseRDDIFormat(provaText)
  console.log('  Extracted:', questions.length, 'questions')
  
  if (questions.length === 0) return []
  
  // Try gabaritos
  let gabarito = {}
  for (const gp of gabaritoPaths) {
    if (!fs.existsSync(gp)) continue
    const gabText = await extractTextFromPDF(gp)
    const g = parseGabaritoSpaced(gabText)
    console.log('  Gabarito', path.basename(gp), ':', Object.keys(g).length, 'answers')
    // Merge
    for (const [n, a] of Object.entries(g)) gabarito[parseInt(n)] = a
  }
  
  // Match
  let matched = 0
  questions.forEach(q => {
    const ans = gabarito[parseInt(q.number)]
    if (ans && /^[A-E]$/.test(ans)) {
      q.correct_answer = ans
      matched++
    }
  })
  console.log('  Matched:', matched, '/', questions.length)
  
  return questions.filter(q => q.correct_answer)
}

async function main() {
  const results = {}
  
  // RDDI 2018 - Annual (100 Qs, no gabarito)
  results['RDDI 2018 Anual'] = await processExam(
    'CBR RDDI 2018 Anual',
    CBR_BASE + '\\RDDI\\2018\\Prova-Anual-2018.pdf',
    []
  )
  
  // RDDI 2018 - TP (60 Qs, no gabarito)
  results['RDDI 2018 TP'] = await processExam(
    'CBR RDDI 2018 TP',
    CBR_BASE + '\\RDDI\\2018\\Prova-Teorico-Pratica-TipoA-2018.pdf',
    []
  )
  
  // RDDI 2019 - Annual (no gabarito file)
  results['RDDI 2019 Anual'] = await processExam(
    'CBR RDDI 2019 Anual',
    CBR_BASE + '\\RDDI\\2019\\Prova-A-Avaliacao-Anual-2019.pdf',
    []
  )
  
  // RDDI 2020 - Annual
  results['RDDI 2020 Anual'] = await processExam(
    'CBR RDDI 2020 Anual',
    CBR_BASE + '\\RDDI\\2020\\Prova-Anual-2020.pdf',
    [CBR_BASE + '\\RDDI\\2020\\Gabarito-2020-v2.pdf']
  )
  
  // USG 2018 - prova with embedded gabarito at end
  results['USG 2018'] = await processExam(
    'CBR USG 2018',
    CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf',
    []
  )
  
  // USG 2019 - Annual
  results['USG 2019 Anual'] = await processExam(
    'CBR USG 2019 Anual',
    CBR_BASE + '\\USG\\2019\\Prova-Anual-2019.pdf',
    [CBR_BASE + '\\USG\\2019\\Gabarito-Teorico-Pratica-2019.pdf']
  )
  
  // RDDI 2021
  results['RDDI 2021'] = await processExam(
    'CBR RDDI 2021',
    CBR_BASE + '\\RDDI\\2021\\Prova-Anual-R3-2021.pdf',
    []
  )
  
  // USG 2020
  results['USG 2020'] = await processExam(
    'CBR USG 2020',
    CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf',
    []
  )
  
  console.log('\n=== Summary ===')
  let total = 0
  for (const [name, qs] of Object.entries(results)) {
    console.log(name + ':', qs.length, 'with answers')
    if (qs.length > 0) {
      fs.writeFileSync(OUT + '\\extracted_' + name.replace(/\s+/g, '_') + '.json', JSON.stringify({ questions: qs }, null, 2))
      total += qs.length
    }
  }
  console.log('\nTotal new:', total)
}

main().catch(e => { console.error(e); process.exit(1) })