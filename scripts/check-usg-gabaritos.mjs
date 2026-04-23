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

async function main() {
  // USG 2018 - check last page for actual gabarito
  console.log('=== USG 2018 last page ===')
  const data2018 = new Uint8Array(fs.readFileSync(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf'))
  const doc2018 = await pdfjsLib.getDocument({ data: data2018, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const last2018 = await doc2018.getPage(doc2018.numPages)
  const lc2018 = await last2018.getTextContent()
  const lastText2018 = lc2018.items.map(i => i.str).join('')
  console.log('Last page last 300:', JSON.stringify(lastText2018.slice(-300)))
  
  // Find "GABARITO" or "FOLHA DE RESPOSTAS"
  const gabIdx = lastText2018.indexOf('GABARITO')
  console.log('GABARITO at:', gabIdx)
  if (gabIdx >= 0) {
    console.log('After GABARITO:', JSON.stringify(lastText2018.slice(gabIdx, gabIdx + 100)))
  }
  
  // Check USG 2018 Full text for "GABARITO" anywhere
  const full2018 = await extractText(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
  const fullGabIdx = full2018.indexOf('GABARITO')
  console.log('\nFull text GABARITO at:', fullGabIdx)
  if (fullGabIdx >= 0) {
    console.log('Around GABARITO:', JSON.stringify(full2018.slice(fullGabIdx, fullGabIdx + 200)))
  }
  
  // Check what USG 2018 answers look like - look for pattern "57 A" or "58 A"
  // near "FOLHA DE RESPOSTAS"
  const folhaIdx = full2018.indexOf('FOLHA DE RESPOSTAS')
  console.log('\nFOLHA DE RESPOSTAS at:', folhaIdx)
  if (folhaIdx >= 0) {
    console.log('Around FOLHA:', JSON.stringify(full2018.slice(folhaIdx, folhaIdx + 200)))
  }
  
  // USG 2025 check
  console.log('\n=== USG 2025 ===')
  const usg2025Text = await extractText(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf')
  console.log('USG 2025 text length:', usg2025Text.length)
  console.log('USG 2025 last 300:', JSON.stringify(usg2025Text.slice(-300)))
  
  // USG 2025 dense parse
  const answers2025 = {}
  let i = 0
  const raw2025 = usg2025Text
  while (i < raw2025.length) {
    while (i < raw2025.length && (raw2025.charCodeAt(i) < 48 || raw2025.charCodeAt(i) > 57)) i++
    if (i >= raw2025.length) break
    let numStr = ''
    while (i < raw2025.length && raw2025.charCodeAt(i) >= 48 && raw2025.charCodeAt(i) <= 57) numStr += raw2025[i++]
    while (i < raw2025.length && raw2025.charCodeAt(i) <= 32) i++
    if (i >= raw2025.length) break
    const letter = raw2025[i++].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 100) answers2025[n] = letter
    }
  }
  console.log('USG 2025 dense:', Object.keys(answers2025).sort((a,b)=>a-b).map(n=>n+answers2025[n]).join(' '))
  console.log('Count:', Object.keys(answers2025).length)
  
  // USG 2025 last page - try character scan
  const pages2025 = usg2025Text.split('\n')
  console.log('Pages:', pages2025.length)
  const lastP2025 = pages2025[pages2025.length - 1]
  console.log('Last page:', JSON.stringify(lastP2025))
}

main().catch(console.error)