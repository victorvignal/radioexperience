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

async function main() {
  // USG 2018 - check if there's a gabarito PDF
  console.log('=== USG 2018 files ===')
  const usg2018Files = fs.readdirSync(CBR_BASE + '\\USG\\2018')
  console.log(usg2018Files.join(', '))
  
  // Check for other files that might contain answers
  // Prova-Anual-A1-A2-2018.pdf - this might have the questions
  
  // === USG 2025 gabarito - parse special format ===
  console.log('\n=== USG 2025 gabarito ===')
  // Format: "28 2413 D29 2412 D30 2351 B..." 
  // Question number, space, page number, space, answer letter
  const usg2025Raw = '28 2413 D29 2412 D30 2351 B31 2350 C32 2349 B33 2348 B34 2409 A35 2408 E36 2407 C37 2398 A38 2397 D39 2396 C40 2395 D41 2419 E42 2381 D43 2380 D44 2379 B45 2448 D46 2447 D47 2446 B48 2445 C49 2411 C50 2402 C'
  
  // Parse: find all occurrences of "NUMBER SPACE{3-4} SPACE LETTER"
  const usg2025Answers = {}
  const re2025 = /(\d+)\s+\d+\s+([A-E])/g
  let m
  while ((m = re2025.exec(usg2025Raw)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 100) usg2025Answers[n] = m[2]
  }
  console.log('USG 2025 answers:', Object.keys(usg2025Answers).sort((a,b)=>a-b).map(n=>n+usg2025Answers[n]).join(' '))
  console.log('Count:', Object.keys(usg2025Answers).length)
  
  // The USG 2025 PDF only has Q28-50, so the rest (1-27) are from the theoretical part
  // We need to check if there's a theoretical gabarito too
  // The file name says "Prova-USG" which might have all parts
  
  // === USG 2020 gabarito - parse special format ===
  console.log('\n=== USG 2020 gabarito ===')
  // "41 D42 C43 D44 D45 A46 D47 B48 B49 E50 D"
  const usg2020Raw = '41 D42 C43 D44 D45 A46 D47 B48 B49 E50 D'
  
  const usg2020Answers = {}
  const re2020 = /(\d+)\s+([A-E])\b/g
  while ((m = re2020.exec(usg2020Raw)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 100) usg2020Answers[n] = m[2]
  }
  console.log('USG 2020 answers:', Object.keys(usg2020Answers).sort((a,b)=>a-b).map(n=>n+usg2020Answers[n]).join(' '))
  console.log('Count:', Object.keys(usg2020Answers).length)
  
  // For USG 2020, Q1-40 must be in the text before "41 D42 C..."
  // Let me scan the full text for number+letter patterns
  const fullUSG2020 = (await (async () => {
    const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf'))
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += '\n' + content.items.map(item => item.str).join('')
    }
    return text
  })())
  
  // Find all "NUMB BER" patterns in the text
  const allAnswersUSG2020 = {}
  const reAll = /(\d+)\s+([A-E])\b/g
  while ((m = reAll.exec(fullUSG2020)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 100) allAnswersUSG2020[n] = m[2]
  }
  console.log('All USG 2020 answers in text:', Object.keys(allAnswersUSG2020).sort((a,b)=>a-b).map(n=>n+allAnswersUSG2020[n]).join(' '))
  
  // === USG 2018 answers ===
  console.log('\n=== USG 2018 answers in full text ===')
  const fullUSG2018 = await (async () => {
    const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf'))
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += '\n' + content.items.map(item => item.str).join('')
    }
    return text
  })()
  
  const allAnswersUSG2018 = {}
  const reAll2018 = /(\d+)\s+([A-E])\b/g
  while ((m = reAll2018.exec(fullUSG2018)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 200) allAnswersUSG2018[n] = m[2]
  }
  console.log('All USG 2018 answers:', Object.keys(allAnswersUSG2018).sort((a,b)=>a-b).map(n=>n+allAnswersUSG2018[n]).join(' '))
  console.log('Count:', Object.keys(allAnswersUSG2018).length)
  
  // Let's also look at the "Prova-Anual-A1-A2-2018.pdf" for USG 2018
  console.log('\n=== USG 2018 Prova-Anual ===')
  const usg2018anualText = await (async () => {
    const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2018\\Prova-Anual-A1-A2-2018.pdf'))
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += '\n' + content.items.map(item => item.str).join('')
    }
    return text
  })()
  
  console.log('USG 2018 Anual text length:', usg2018anualText.length)
  const allAnswersUSG2018Anual = {}
  const reAll2018A = /(\d+)\s+([A-E])\b/g
  while ((m = reAll2018A.exec(usg2018anualText)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 200) allAnswersUSG2018Anual[n] = m[2]
  }
  console.log('USG 2018 Anual answers:', Object.keys(allAnswersUSG2018Anual).sort((a,b)=>a-b).map(n=>n+allAnswersUSG2018Anual[n]).join(' '))
  console.log('Count:', Object.keys(allAnswersUSG2018Anual).length)
  
  // Look at last 500 chars of USG 2018 Anual
  console.log('Last 500:', JSON.stringify(usg2018anualText.slice(-500)))
}

main().catch(console.error)