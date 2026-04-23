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

function parseDenseGabarito(text) {
  const answers = {}
  let i = 0
  while (i < text.length) {
    while (i < text.length && (text.charCodeAt(i) < 48 || text.charCodeAt(i) > 57)) i++
    if (i >= text.length) break
    let numStr = ''
    while (i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) numStr += text[i++]
    while (i < text.length && text.charCodeAt(i) <= 32) i++
    if (i >= text.length) break
    const letter = text[i++].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 300) answers[n] = letter
    }
  }
  return answers
}

async function main() {
  // === USG 2020 ===
  console.log('=== USG 2020 ===')
  const usg2020Text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
  
  // Dense parser found 50 answers
  const gabUSG2020 = parseDenseGabarito(usg2020Text)
  console.log('USG 2020 gabarito:', Object.keys(gabUSG2020).sort((a,b)=>a-b).map(n=>n+gabUSG2020[n]).join(' '))
  
  // The answers ARE there! But the questions need to be extracted
  // Let's look at where the question text is
  // The text is one big block - find "EXAME DE SUFICIÊNCIA" and split before it
  const exameIdx = usg2020Text.indexOf('EXAME DE SUFICIÊNCIA')
  console.log('EXAME DE SUFICIÊNCIA at:', exameIdx)
  
  // The exam section - look at the structure before the gabarito
  // Find page 1 content
  const pages = usg2020Text.split('\n')
  console.log('Pages:', pages.length)
  console.log('Page 1 preview:', pages[0] ? pages[0].substring(0, 200) : 'empty')
  
  // USG 2020 has questions as images or has a different text encoding
  // The text is in the format "QUESTÃO" with letter options below
  // Let me look at the full raw text from page 1
  const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const p1 = await doc.getPage(1)
  const c1 = await p1.getTextContent()
  const p1Items = c1.items.map(item => item.str)
  console.log('Page 1 items count:', p1Items.length)
  console.log('Page 1 items sample:', p1Items.slice(0, 10))
  
  // === USG 2018 ===
  console.log('\n=== USG 2018 ===')
  const usg2018Text = await extractText(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
  const gabUSG2018 = parseDenseGabarito(usg2018Text)
  console.log('USG 2018 gabarito (dense):', Object.keys(gabUSG2018).length)
  
  // Check all 60 answers
  console.log('USG 2018 Q1-20:', Object.keys(gabUSG2018).sort((a,b)=>a-b).filter(n=>n<=20).map(n=>n+gabUSG2018[n]).join(' '))
  
  // === USG 2025 ===
  console.log('\n=== USG 2025 ===')
  const usg2025Text = await extractText(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf')
  const gabUSG2025 = parseDenseGabarito(usg2025Text)
  console.log('USG 2025 gabarito (dense):', Object.keys(gabUSG2025).sort((a,b)=>a-b).map(n=>n+gabUSG2025[n]).join(' '))
  console.log('Count:', Object.keys(gabUSG2025).length)
  
  // Last page of USG 2025
  const lastPage = await doc.getPage(doc.numPages)
  
  // === Now ingest USG 2020 with dense answers ===
  console.log('\n=== Ingesting USG 2020 (50 Qs with answers) ===')
  
  // We need to extract the questions from the prova PDF text
  // Let me look for question text patterns in USG 2020
  // The format might be "A) text" with line breaks between questions
  
  // Look at page content for option patterns
  const usg2020HasOptionsA = usg2020Text.includes('A)')
  const usg2020HasOptionsAEspaco = usg2020Text.includes('A)')
  console.log('USG 2020 has "A)" options:', usg2020HasOptionsA)
  
  // Try splitting by "A)" or similar
  const partsA = usg2020Text.split('A)\n')
  console.log('Split by "A)\\n":', partsA.length)
  
  // Let's check what option patterns exist
  const optMatches = [...usg2020Text.matchAll(/(A|B|C|D|E)\)\s*\w/g)].slice(0, 5)
  console.log('Option matches (first 5):', optMatches.map(m => m[0]))
  
  // USG 2020 might have the questions as images or scanned PDF
  // Let me check if the "QUESTÕES ALTERNATIVA" page has any text
  const questAltIdx = usg2020Text.indexOf('QUESTÕES ALTERNATIVA')
  if (questAltIdx >= 0) {
    console.log('QUESTÕES ALTERNATIVA text:', usg2020Text.slice(questAltIdx, questAltIdx + 100))
  }
  
  // Instead of re-extracting questions (which requires OCR for scanned PDFs),
  // let's see if we have question text already in the extracted JSON
  const usg2020JSON = JSON.parse(fs.readFileSync(OUT + '\\extracted_USG_2020_questions.json', 'utf8'))
  console.log('\nUSG 2020 extracted JSON questions:', usg2020JSON.questions.length)
  if (usg2020JSON.questions.length > 0) {
    console.log('Sample Q1:', usg2020JSON.questions[0].text.substring(0, 80))
  }
  
  // The issue is the questions were extracted but the text is empty/malformed
  // because the PDF has questions as images or scanned
  
  console.log('\n=== USG 2018 attempt ===')
  // USG 2018 has 60 questions with answers from dense parser
  // We need to extract them
  // Check if extracted_USG_2018_questions.json has content
  const usg2018JSON = JSON.parse(fs.readFileSync(OUT + '\\extracted_USG_2018_questions.json', 'utf8'))
  console.log('USG 2018 extracted JSON:', usg2018JSON.questions.length, 'questions')
  
  if (usg2018JSON.questions.length > 0) {
    const q1 = usg2018JSON.questions.find(q => q.number === '1')
    if (q1) console.log('Q1 text:', q1.text.substring(0, 100))
  }
  
  // USG 2018 has real text - let's extract with correct parser
  // Use "Questão" marker
  const usg2018Parts = usg2018Text.split(/Questão\s+(\d+)/i)
  console.log('USG 2018 split by Questão:', usg2018Parts.length, 'parts')
}

main().catch(console.error)