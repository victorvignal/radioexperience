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

function parseGabaritoAnywhere(text) {
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

// Parse USG 2020 format: last page has "28 2413 D29 2412 D30 2351 B..."
// Numbers followed by space then letter, with large gaps between them
function parseUSG2020Gabarito(text) {
  const answers = {}
  // Find all occurrences of number followed by space then letter A-E
  // The pattern is "NUMBER SPACE LETTER" where the number is 1-50
  const re = /(\d{1,2})\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 100) answers[n] = m[2]
  }
  return answers
}

// Try dense parse: "1B2A3B4B..." with no spaces (char-by-char)
function parseDenseGabarito(text) {
  const answers = {}
  let i = 0
  while (i < text.length) {
    // Skip non-digits
    while (i < text.length && (text.charCodeAt(i) < 48 || text.charCodeAt(i) > 57)) i++
    if (i >= text.length) break
    let numStr = ''
    while (i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) numStr += text[i++]
    // Skip any whitespace including special chars
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
  // USG 2020 - extract questions with different parser
  console.log('=== USG 2020 re-extraction ===')
  const usg2020Text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
  
  // USG 2020 format - questions labeled "QUESTÃO" at top, options A) B) C) D) E)
  // But the text might have "QUESTÃO 1" or similar
  // Let's look at first page
  const firstLine = usg2020Text.split('\n')[0]
  console.log('First line:', firstLine)
  
  // Try finding "QUESTÃO" (uppercase) followed by number
  const questUpper = [...usg2020Text.matchAll(/QUESTÃO\s+(\d+)/g)]
  console.log('QUESTÃO markers:', questUpper.length)
  
  // Try lowercase
  const questLower = [...usg2020Text.matchAll(/Questão\s+(\d+)/g)]
  console.log('Questão markers:', questLower.length)
  
  // Try "Q." pattern
  const qPattern = [...usg2020Text.matchAll(/Q[uúmero]*\s*\.?\s*(\d+)/gi)]
  console.log('Q patterns:', qPattern.length)
  
  // Check what characters are used
  const relevant = usg2020Text.match(/QUEST|quest|Questao|Questão/i)
  console.log('Has QUEST/quest:', !!relevant)
  
  // Check for option pattern like "A)" or "A -"
  const optA = usg2020Text.match(/A\)\s*/)
  console.log('Has "A)" pattern:', !!optA)
  
  // USG 2020 gabarito - try dense parser
  const gabUSG2020 = parseDenseGabarito(usg2020Text)
  console.log('\nUSG 2020 dense answers:', Object.keys(gabUSG2020).sort((a,b)=>a-b).map(n=>n+gabUSG2020[n]).join(' '))
  console.log('Count:', Object.keys(gabUSG2020).length)
  
  // If dense doesn't work, try USG 2020 style
  if (Object.keys(gabUSG2020).length < 30) {
    const gabUSG2020Alt = parseUSG2020Gabarito(usg2020Text)
    console.log('USG 2020 alt answers:', Object.keys(gabUSG2020Alt).sort((a,b)=>a-b).map(n=>n+gabUS2020Alt[n]).join(' '))
  }
  
  // Let's look at the last page in detail
  const pages = usg2020Text.split('\n')
  const lastPage = pages[pages.length - 1]
  console.log('\nLast page last 200:', JSON.stringify(lastPage.slice(-200)))
  
  // USG 2018 - check for gabarito PDF
  console.log('\n=== USG 2018 gabarito ===')
  const usg2018Files = fs.readdirSync(CBR_BASE + '\\USG\\2018')
  console.log('USG 2018 files:', usg2018Files.join(', '))
  
  // USG 2025 check
  console.log('\n=== USG 2025 ===')
  const usg2025Files = fs.readdirSync(CBR_BASE + '\\USG\\2025')
  console.log('USG 2025 files:', usg2025Files.join(', '))
}

main().catch(console.error)