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

// Parse "N SPACE LETTER" or "N SPACE{3,} SPACE LETTER" (with page numbers in between)
function parseAnswersFlexible(text) {
  const answers = {}
  
  // Pattern: NUMBER followed by 1+ whitespace then LETTER
  // But the whitespace might contain digits (page numbers in USG 2025)
  // Strategy: for each digit sequence, check if followed by A-E with possible long gap
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  
  return answers
}

async function main() {
  console.log('=== Parsing all USG gabaritos ===\n')
  
  // USG 2020: Q41-50 from last page, Q1-40 from "QUESTÕES ALTERNATIVA" pattern earlier
  const usg2020Text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
  
  // USG 2020 full text scan for all answers
  const usg2020All = parseAnswersFlexible(usg2020Text)
  console.log('USG 2020 all answers:', Object.keys(usg2020All).sort((a,b)=>a-b).map(n=>n+usg2020All[n]).join(' '))
  console.log('Count:', Object.keys(usg2020All).length)
  
  // The issue: Q1-40 are in the format like "1 B2 A3 B4 B5 D..." in the "QUESTÕES ALTERNATIVA" page
  // But dense parser finds 0 for this format
  // Let me check the raw text of page 1 (should contain "1 B2 A3 B...")
  const usg2020Page1 = await (async () => {
    const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf'))
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
    const page = await doc.getPage(1)
    const content = await page.getTextContent()
    return content.items.map(item => item.str).join('')
  })()
  console.log('\nUSG 2020 page 1 last 200:', JSON.stringify(usg2020Page1.slice(-200)))
  
  // Now for USG 2018 - try dense parsing with char scan
  console.log('\n=== USG 2018 dense char scan ===')
  const usg2018Text = await extractText(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
  
  const usg2018Ans = {}
  let i = 0
  const raw = usg2018Text
  while (i < raw.length) {
    while (i < raw.length && (raw.charCodeAt(i) < 48 || raw.charCodeAt(i) > 57)) i++
    if (i >= raw.length) break
    let numStr = ''
    while (i < raw.length && raw.charCodeAt(i) >= 48 && raw.charCodeAt(i) <= 57) numStr += raw[i++]
    // Skip any whitespace
    while (i < raw.length && (raw.charCodeAt(i) <= 32 || raw.charCodeAt(i) === 160)) i++
    if (i >= raw.length) break
    const letter = raw[i].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      i++
      const n = parseInt(numStr)
      if (n >= 1 && n <= 200) usg2018Ans[n] = letter
    }
  }
  console.log('USG 2018 dense:', Object.keys(usg2018Ans).sort((a,b)=>a-b).filter(n=>n<=60).map(n=>n+usg2018Ans[n]).join(' '))
  console.log('Count:', Object.keys(usg2018Ans).length)
  
  // USG 2025 
  console.log('\n=== USG 2025 ===')
  const usg2025Text = await extractText(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf')
  const usg2025Ans = {}
  // USG 2025 has format: "28 2413 D29 2412 D30 2351 B..."
  // Number, space, 4-digit page, space, letter
  // Let's use the same char scan approach
  i = 0
  const raw2025 = usg2025Text
  while (i < raw2025.length) {
    while (i < raw2025.length && (raw2025.charCodeAt(i) < 48 || raw2025.charCodeAt(i) > 57)) i++
    if (i >= raw2025.length) break
    let numStr = ''
    while (i < raw2025.length && raw2025.charCodeAt(i) >= 48 && raw2025.charCodeAt(i) <= 57) numStr += raw2025[i++]
    // Skip whitespace (including the 4-digit page number which is between num and letter)
    while (i < raw2025.length && raw2025.charCodeAt(i) <= 32) i++
    if (i >= raw2025.length) break
    // If there's a 4-digit number next, skip it (it's the page number)
    let pageCheck = ''
    while (i < raw2025.length && raw2025.charCodeAt(i) >= 48 && raw2025.charCodeAt(i) <= 57) {
      pageCheck += raw2025[i++]
    }
    // Skip spaces again
    while (i < raw2025.length && raw2025.charCodeAt(i) <= 32) i++
    if (i >= raw2025.length) break
    const letter = raw2025[i].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0 && numStr.length <= 2) {
      i++
      const n = parseInt(numStr)
      if (n >= 1 && n <= 100) usg2025Ans[n] = letter
    }
  }
  console.log('USG 2025 parsed:', Object.keys(usg2025Ans).sort((a,b)=>a-b).map(n=>n+usg2025Ans[n]).join(' '))
  console.log('Count:', Object.keys(usg2025Ans).length)
}

main().catch(console.error)