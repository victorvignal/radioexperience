/**
 * Comprehensive CBR Extractor - extracts from ALL remaining exams
 */
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
  const pagesInfo = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    pagesInfo.push({ pageNum: i, text: pageText })
    fullText += '\n' + pageText
  }
  return { doc, fullText, pagesInfo }
}

// Pattern 1: USG-style (QUESTÃO N at start, options A - text)
function parseUSGStyle(fullText) {
  const questions = []
  // Split by QUESTÃO or Questão
  const parts = fullText.split(/(?=Questão\s*\d+|QUESTÃO\s*\d+)/i)
  for (const part of parts) {
    if (!part.trim()) continue
    const numMatch = part.match(/Questão\s*(\d+)/i) || part.match(/QUESTÃO\s*(\d+)/i)
    if (!numMatch) continue
    const qNum = parseInt(numMatch[1])
    if (qNum < 1 || qNum > 200) continue
    
    let body = part.replace(/Questão\s*\d+/i, '').replace(/QUESTÃO\s*\d+/i, '')
    
    // Split options by "A - " or "A)" pattern
    const sections = body.split(/(?=[A-E]\s*[-)]\s*)/)
    const questionText = (sections[0] || body).replace(/\s+/g, ' ').trim()
    const options = []
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      const optMatch = sec.match(/^([A-E])\s*[-)]\s*(.+)/s)
      if (optMatch) {
        options.push(optMatch[0])
      }
    }
    
    if (questionText.length > 10 && options.length >= 2) {
      questions.push({ number: String(qNum), text: questionText, options, correct_answer: null, difficulty: 'medium', explanation: '' })
    }
  }
  return questions
}

// Pattern 2: RDDI-style (Questão N at start, options A) text)
function parseRDDIStyle(fullText) {
  const questions = []
  const parts = fullText.split(/(?=Questão\s*\d+)/i)
  for (const part of parts) {
    if (!part.trim()) continue
    const numMatch = part.match(/Questão\s*(\d+)/i)
    if (!numMatch) continue
    const qNum = parseInt(numMatch[1])
    if (qNum < 1 || qNum > 200) continue
    
    let body = part.replace(/Questão\s*\d+/i, '')
    
    // Try A) pattern first, then A - pattern
    let sections = body.split(/(?=[A-E]\)\s*)/)
    if (sections.length < 3) sections = body.split(/(?=[A-E]\s*-\s*)/)
    
    const questionText = (sections[0] || body).replace(/\s+/g, ' ').trim()
    const options = []
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      const optMatch = sec.match(/^([A-E])[)\-]\s*(.+)/s)
      if (optMatch) {
        options.push(optMatch[0])
      }
    }
    
    if (questionText.length > 10 && options.length >= 2) {
      questions.push({ number: String(qNum), text: questionText, options, correct_answer: null, difficulty: 'medium', explanation: '' })
    }
  }
  return questions
}

// Try to find "Questão N" with letter options nearby - more flexible
function parseFlexible(fullText) {
  const questions = []
  // Find all "Questão N" positions
  const regex = /Questão\s+(\d+)/gi
  const matches = [...fullText.matchAll(regex)]
  
  for (const match of matches) {
    const qNum = parseInt(match[1])
    if (qNum < 1 || qNum > 200) continue
    
    const start = match.index
    // Get next 800 chars after "Questão N"
    const segment = fullText.slice(start, start + 800)
    
    // Find options (A) or A-)
    const optMatches = [...segment.matchAll(/([A-E])[)\-]\s*(.{5,150}?)(?=[A-E][)\-]|$)/g)]
    
    if (optMatches.length >= 2) {
      // Extract question text (between Questão N and first option)
      const firstOptIdx = segment.search(/[A-E][)\-]/)
      const questionText = segment.slice(segment.match(/\d+\s*/)[0].length, firstOptIdx).replace(/\s+/g, ' ').trim()
      
      if (questionText.length > 5) {
        const options = optMatches.map(m => m[0].trim())
        questions.push({ number: String(qNum), text: questionText, options, correct_answer: null, difficulty: 'medium', explanation: '' })
      }
    }
  }
  
  // Deduplicate
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

function parseGabaritoDense(text) {
  const answers = {}
  const re = /(\d+)([A-E])(?=\d|$)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

function parsePage62Gabarito(text) {
  const idx = text.indexOf('Questão Gabarito')
  const flexIdx = idx < 0 ? (text.match(/Questão\s+Gabarito/) || { index: -1 }).index : idx
  if (flexIdx < 0) return {}
  const raw = text.slice(flexIdx + 'Questão Gabarito'.length).replace(/^\s+/, '')
  const answers = {}
  let i = 0
  while (i < raw.length) {
    while (i < raw.length && (raw.charCodeAt(i) < 48 || raw.charCodeAt(i) > 57)) { i++ }
    if (i >= raw.length) break
    let numStr = ''
    while (i < raw.length && raw.charCodeAt(i) >= 48 && raw.charCodeAt(i) <= 57) { numStr += raw[i++] }
    while (i < raw.length && raw[i] === ' ') { i++ }
    if (i >= raw.length) break
    const letter = raw[i++].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 200) answers[n] = letter
    }
  }
  return answers
}

async function processUSGYear(year, provaFile, gabaritoFile, sourceLabel) {
  console.log(`\n--- ${sourceLabel} ---`)
  const provaPath = CBR_BASE + '\\USG\\' + year + '\\' + provaFile
  const gabPath = CBR_BASE + '\\USG\\' + year + '\\' + gabaritoFile
  
  if (!fs.existsSync(provaPath)) {
    console.log('  Prova not found:', provaFile)
    return []
  }
  
  // Extract prova text
  const { fullText: provaText } = await extractTextFromPDF(provaPath)
  
  // Extract gabarito
  let gabarito = {}
  if (fs.existsSync(gabPath)) {
    const { fullText: gabText } = await extractTextFromPDF(gabPath)
    gabarito = parseGabaritoSpaced(gabText)
    if (Object.keys(gabarito).length === 0) gabarito = parseGabaritoDense(gabText)
    console.log('  Gabarito:', Object.keys(gabarito).length, 'answers, sample:', Object.keys(gabarito).slice(0, 5).map(n => n + gabarito[n]).join(' '))
  } else {
    // Try inline gabarito at end of prova
    gabarito = parseGabaritoSpaced(provaText)
    if (Object.keys(gabarito).length < 10) gabarito = parseGabaritoDense(provaText)
    console.log('  Inline gabarito:', Object.keys(gabarito).length, 'answers')
  }
  
  // Try USG-style parse
  let questions = parseUSGStyle(provaText)
  console.log('  USG-style extracted:', questions.length, 'questions')
  
  // Try flexible parse if USG-style got few
  if (questions.length < 20) {
    const flex = parseFlexible(provaText)
    console.log('  Flexible extracted:', flex.length, 'questions')
    if (flex.length > questions.length) questions = flex
  }
  
  // Match with gabarito
  let matched = 0
  questions.forEach(q => {
    const ans = gabarito[parseInt(q.number)]
    if (ans && /^[A-E]$/.test(ans)) {
      q.correct_answer = ans
      matched++
    }
  })
  console.log('  Matched to gabarito:', matched, '/', questions.length)
  
  return questions.filter(q => q.correct_answer)
}

async function processRDDIYear(year, provaFiles, gabaritoFiles, sourceLabel) {
  console.log(`\n--- ${sourceLabel} ---`)
  
  let allQuestions = []
  let allGabarito = {}
  
  // Extract all prova texts
  for (const pf of provaFiles) {
    const provaPath = CBR_BASE + '\\RDDI\\' + year + '\\' + pf
    if (!fs.existsSync(provaPath)) {
      console.log('  Missing:', pf)
      continue
    }
    const { fullText } = await extractTextFromPDF(provaPath)
    const qs = parseRDDIStyle(fullText)
    console.log('  ', pf, ':', qs.length, 'questions extracted')
    allQuestions.push(...qs)
  }
  
  // Extract gabarito
  for (const gf of gabaritoFiles) {
    const gabPath = CBR_BASE + '\\RDDI\\' + year + '\\' + gf
    if (!fs.existsSync(gabPath)) continue
    const { fullText } = await extractTextFromPDF(gabPath)
    let g = parseGabaritoSpaced(fullText)
    if (Object.keys(g).length === 0) g = parsePage62Gabarito(fullText)
    if (Object.keys(g).length === 0) g = parseGabaritoDense(fullText)
    console.log('  Gabarito', gf, ':', Object.keys(g).length, 'answers')
    // Merge
    for (const [n, a] of Object.entries(g)) allGabarito[parseInt(n)] = a
  }
  
  // Deduplicate
  const seen = new Set()
  const deduped = []
  for (const q of allQuestions) {
    if (seen.has(q.number)) continue
    seen.add(q.number)
    const ans = allGabarito[parseInt(q.number)]
    if (ans && /^[A-E]$/.test(ans)) q.correct_answer = ans
    if (q.correct_answer) deduped.push(q)
  }
  
  console.log('  Total matched:', deduped.length, 'with answers')
  return deduped
}

async function main() {
  console.log('=== Extracting from all CBR exams ===\n')
  
  const allResults = {}
  
  // USG 2018 (prova has inline gabarito at end)
  allResults['USG 2018'] = await processUSGYear(2018, 'Prova-Teorico-Pratica-Maio-2018.pdf', null, 'CBR USG 2018')
  
  // USG 2019 - two separate exams
  allResults['USG 2019 TP'] = await processUSGYear(2019, 'Prova-Anual-2019.pdf', 'Gabarito-Teorico-Pratica-2019.pdf', 'CBR USG 2019 TP')
  
  // USG 2020
  allResults['USG 2020'] = await processUSGYear(2020, 'Prova-Teorica-Teorico-Pratica-2020.pdf', null, 'CBR USG 2020')
  
  // USG 2022 (only Gin-Obs gabarito available)
  allResults['USG 2022'] = await processUSGYear(2022, null, 'Gabarito-Ginecologia-Obstetricia-2022.pdf', 'CBR USG 2022')
  
  // RDDI 2018
  allResults['RDDI 2018'] = await processRDDIYear(2018, 
    ['Prova-Anual-2018.pdf', 'Prova-Teorico-Pratica-TipoA-2018.pdf'],
    [],
    'CBR RDDI 2018'
  )
  
  // RDDI 2019
  allResults['RDDI 2019'] = await processRDDIYear(2019,
    ['Prova-A-Avaliacao-Anual-2019.pdf'],
    ['Gabarito-Avaliacao-Anual-2019.pdf', 'Gabarito-Prova-Titulo-2019.pdf'],
    'CBR RDDI 2019'
  )
  
  // RDDI 2020
  allResults['RDDI 2020'] = await processRDDIYear(2020,
    ['Prova-Anual-2020.pdf'],
    ['Gabarito-2020-v2.pdf'],
    'CBR RDDI 2020'
  )
  
  // RDDI 2021
  allResults['RDDI 2021'] = await processRDDIYear(2021,
    ['Prova-Anual-R3-2021.pdf'],
    [],
    'CBR RDDI 2021'
  )
  
  console.log('\n=== Summary ===')
  let totalExtracted = 0
  for (const [name, qs] of Object.entries(allResults)) {
    console.log(name + ':', qs.length, 'questions with answers')
    totalExtracted += qs.length
  }
  console.log('Total:', totalExtracted)
  
  // Save each as JSON
  for (const [name, qs] of Object.entries(allResults)) {
    if (qs.length > 0) {
      const safeName = name.replace(/\s+/g, '_')
      fs.writeFileSync(OUT + '\\extracted_' + safeName + '.json', JSON.stringify({ questions: qs }, null, 2))
      console.log('Saved: extracted_' + safeName + '.json')
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })