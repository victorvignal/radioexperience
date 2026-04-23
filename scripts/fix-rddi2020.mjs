import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'

function httpPost(body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const req = require('https').request('https://pcdequsipbkxcfsewiow.supabase.co/rest/v1/challenge_question_pool', {
      method: 'POST',
      headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4', 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: d }) }) })
    req.on('error', e => resolve({ ok: false, status: 0, body: e.message })); req.write(data); req.end()
  })
}

function formatOptions(opts) {
  if (!opts || !Array.isArray(opts)) return {}
  const out = {}
  for (const o of opts) {
    if (typeof o !== 'string') continue
    const letter = o.charAt(0).toUpperCase()
    if (letter >= 'A' && letter <= 'E') out[letter] = o.substring(3).trim()
  }
  return out
}

async function extractText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += '\n' + content.items.map(item => item.str).join('')
  }
  return text
}

// Parse gabarito: find "NUM(space)LETTER" or "NUM(space)LETTER" anywhere in text
function parseGabaritoAnywhere(text) {
  const answers = {}
  // Look for number followed by space/punct then letter A-E
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  
  // If that finds nothing (e.g. due to special spaces like \xa0), try the dense format
  if (Object.keys(answers).length === 0) {
    const reD = /(\d+)([A-E])(?=\d|$)/g
    while ((m = reD.exec(text)) !== null) {
      const n = parseInt(m[1])
      if (n >= 1 && n <= 300) answers[n] = m[2]
    }
  }
  
  return answers
}

// Parse answers from "1 B2 B3 A4 D..." format with any whitespace
function parseAllAnswers(text) {
  const answers = {}
  // Try all variations of number + separator + letter
  const patterns = [
    /(\d+)\s+([A-E])\b/g,           // number space letter (standard)
    /(\d+)\s+([A-E])(?=\d)/g,        // number space letter followed by digit
    /(\d+)\s+([A-E])(?=$|\s)/g,      // number space letter at end or before space
  ]
  
  for (const pattern of patterns) {
    let m
    while ((m = pattern.exec(text)) !== null) {
      const n = parseInt(m[1])
      if (n >= 1 && n <= 300) answers[n] = m[2]
    }
    if (Object.keys(answers).length >= 50) break
  }
  
  return answers
}

async function main() {
  // Fix RDDI 2020 gabarito extraction
  console.log('=== RDDI 2020 Gabarito ===')
  const r2020GabText = await extractText(CBR_BASE + '\\RDDI\\2020\\Gabarito-2020-v2.pdf')
  
  // The pattern in RDDI 2020 is "QUESTÕES ALTERNATIVA1 B2 B3 A4..." at the end of page 1
  // Then continues on page 2
  // We need to concatenate all pages and parse
  
  // Let's look at what's between the last space and the next letter
  const gab2020 = parseAllAnswers(r2020GabText)
  console.log('RDDI 2020 answers:', Object.keys(gab2020).sort((a,b)=>a-b).map(n=>n+gab2020[n]).join(' '))
  console.log('Count:', Object.keys(gab2020).length)
  
  // Now ingest RDDI 2020 with correct answers
  const r2020JSON = JSON.parse(fs.readFileSync(OUT + '\\extracted_RDDI_2020.json', 'utf8'))
  const seenR2020 = new Set()
  let countR2020 = 0
  
  for (const q of r2020JSON.questions || []) {
    if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
    const opts = formatOptions(q.options)
    const source = 'CBR RDDI 2020 — Questão ' + q.number
    const question = {
      specialty: 'Geral',
      question_text: q.text || '',
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: q.correct_answer,
      explanation: '',
      source_title: source,
      difficulty: 'medium',
      image_base64: null,
      has_image: false,
      times_used: 0,
    }
    const r = await httpPost([question])
    if (r.ok) countR2020++
    else console.log('FAIL:', source, r.status)
  }
  
  console.log('\nRDDI 2020 re-ingested:', countR2020)
  
  // Also fix the USG 2020 extracted questions - the parser wasn't finding "Questão N" because
  // the text format is "QUESTÕES ALTERNATIVA" not "Questão N"
  // Let's re-extract USG 2020 properly
  console.log('\n=== Re-extracting USG 2020 questions ===')
  const usg2020Text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
  
  // USG 2020 format: "QUESTÃO 1" at start of each question, options start with "A)"
  // Split by "QUESTÃO" or look for patterns
  const usg2020Questions = []
  
  // Look for "QUESTÃO 1" through "QUESTÃO 50" pattern
  const questMatches = [...usg2020Text.matchAll(/QUESTÃO\s*(\d+)/gi)]
  console.log('Found QUESTÃO markers:', questMatches.length)
  
  for (const match of questMatches) {
    const qNum = parseInt(match[1])
    if (qNum < 1 || qNum > 100) continue
    
    const start = match.index
    const end = start + 800
    const segment = usg2020Text.slice(start, end)
    
    // Find options: A) B) C) D) E)
    const optMatches = [...segment.matchAll(/([A-E])\)\s*(.{10,150}?)(?=[A-E]\)|$)/gs)]
    
    if (optMatches.length >= 2) {
      const firstOptIdx = segment.search(/[A-E]\)/)
      const qText = segment.slice(match[0].length, firstOptIdx).replace(/\s+/g, ' ').trim()
      const options = optMatches.map(m => m[0].trim())
      
      if (qText.length > 5) {
        usg2020Questions.push({
          number: String(qNum),
          text: qText,
          options,
          correct_answer: null,
          difficulty: 'medium',
          explanation: '',
        })
      }
    }
  }
  
  // Deduplicate
  const seenUSG2020 = new Set()
  const dedupedUSG2020 = usg2020Questions.filter(q => {
    if (seenUSG2020.has(q.number)) return false
    seenUSG2020.add(q.number)
    return true
  })
  console.log('USG 2020 extracted:', dedupedUSG2020.length, 'questions')
  
  // Get USG 2020 gabarito
  const gabUSG2020 = parseAllAnswers(usg2020Text)
  console.log('USG 2020 gabarito:', Object.keys(gabUSG2020).length, 'answers')
  
  // Save extracted USG 2020 with answers
  const usg2020WithAnswers = dedupedUSG2020.map(q => {
    const answer = gabUSG2020[parseInt(q.number)]
    return { ...q, correct_answer: answer || null }
  })
  fs.writeFileSync(OUT + '\\extracted_USG_2020_with_answers.json', JSON.stringify({ questions: usg2020WithAnswers }, null, 2))
  console.log('Saved extracted_USG_2020_with_answers.json')
  
  // Ingest USG 2020
  let usg2020Count = 0
  for (const q of usg2020WithAnswers) {
    if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
    const opts = formatOptions(q.options)
    const r = await httpPost([{
      specialty: 'Geral',
      question_text: q.text || '',
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: q.correct_answer,
      explanation: '',
      source_title: 'CBR USG 2020 — Questão ' + q.number,
      difficulty: 'medium',
      image_base64: null,
      has_image: false,
      times_used: 0,
    }])
    if (r.ok) usg2020Count++
  }
  console.log('USG 2020 ingested:', usg2020Count)
  
  // Also fix USG 2018 - extract questions and try to match with gabarito
  console.log('\n=== Re-extracting USG 2018 ===')
  const usg2018Text = await extractText(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
  const gabUSG2018 = parseAllAnswers(usg2018Text)
  console.log('USG 2018 gabarito:', Object.keys(gabUSG2018).length, 'answers')
  
  // USG 2018 format: "Questão 1" at start, options with "A)"
  const usg2018Questions = []
  const usgMatch = [...usg2018Text.matchAll(/Questão\s*(\d+)/gi)]
  console.log('USG 2018 Questão markers:', usgMatch.length)
  
  for (const match of usgMatch) {
    const qNum = parseInt(match[1])
    if (qNum < 1 || qNum > 200) continue
    
    const start = match.index
    const segment = usg2018Text.slice(start, start + 800)
    
    const optMatches = [...segment.matchAll(/([A-E])\)\s*(.{10,150}?)(?=[A-E]\)|$)/gs)]
    
    if (optMatches.length >= 2) {
      const firstOptIdx = segment.search(/[A-E]\)/)
      const qText = segment.slice(match[0].length, firstOptIdx).replace(/\s+/g, ' ').trim()
      const options = optMatches.map(m => m[0].trim())
      
      if (qText.length > 5) {
        usg2018Questions.push({
          number: String(qNum),
          text: qText,
          options,
          correct_answer: gabUSG2018[qNum] || null,
          difficulty: 'medium',
          explanation: '',
        })
      }
    }
  }
  
  const seenUSG2018 = new Set()
  const dedupedUSG2018 = usg2018Questions.filter(q => {
    if (seenUSG2018.has(q.number)) return false
    seenUSG2018.add(q.number)
    return true
  })
  console.log('USG 2018 extracted:', dedupedUSG2018.length, 'questions')
  console.log('USG 2018 with answers:', dedupedUSG2018.filter(q => q.correct_answer).length)
  
  fs.writeFileSync(OUT + '\\extracted_USG_2018_with_answers.json', JSON.stringify({ questions: dedupedUSG2018 }, null, 2))
  
  // Ingest USG 2018
  let usg2018Count = 0
  for (const q of dedupedUSG2018) {
    if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
    const opts = formatOptions(q.options)
    const r = await httpPost([{
      specialty: 'Geral',
      question_text: q.text || '',
      question_type: 'multiple_choice',
      options: opts,
      correct_answer: q.correct_answer,
      explanation: '',
      source_title: 'CBR USG 2018 — Questão ' + q.number,
      difficulty: 'medium',
      image_base64: null,
      has_image: false,
      times_used: 0,
    }])
    if (r.ok) usg2018Count++
  }
  console.log('USG 2018 ingested:', usg2018Count)
  
  console.log('\n✅ Total novos ingeridos: RDDI2020:', countR2020, '+ USG2020:', usg2020Count, '+ USG2018:', usg2018Count)
}

main().catch(e => { console.error(e); process.exit(1) })