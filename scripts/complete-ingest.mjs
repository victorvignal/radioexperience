import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'

function httpDelete(path) {
  return new Promise((resolve) => {
    const req = require('https').request('https://pcdequsipbkxcfsewiow.supabase.co' + path, {
      method: 'DELETE',
      headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4' }
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode })) })
    req.on('error', e => resolve({ status: 0 })); req.end()
  })
}

function httpGet(path) {
  return new Promise((resolve) => {
    const req = require('https').request('https://pcdequsipbkxcfsewiow.supabase.co' + path, {
      method: 'GET',
      headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4' }
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve([]) } }) })
    req.on('error', () => resolve([])); req.end()
  })
}

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

function formatOptionsFromObj(opts) {
  if (!opts || typeof opts !== 'object') return {}
  const out = {}
  for (const [letter, text] of Object.entries(opts)) {
    if (letter >= 'A' && letter <= 'E') out[letter] = String(text)
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

// Parse answers from USG 2020 format (last page "1 B2 A3 B4...")
function parseUSG2020Format(text) {
  // Last 500 chars has the pattern
  const last500 = text.slice(-500)
  const answers = {}
  let i = 0
  while (i < last500.length) {
    while (i < last500.length && (last500.charCodeAt(i) < 48 || last500.charCodeAt(i) > 57)) { i++ }
    if (i >= last500.length) break
    let numStr = ''
    while (i < last500.length && last500.charCodeAt(i) >= 48 && last500.charCodeAt(i) <= 57) { numStr += last500[i++] }
    while (i < last500.length && last500[i] === ' ') { i++ }
    if (i >= last500.length) break
    const letter = last500[i++].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 100) answers[n] = letter
    }
  }
  return answers
}

// Parse RDDI 2024 from "Questão Gabarito1 B2 C..." at end
function parseRDDI2024Gab(text) {
  // Scan all pages for this pattern
  const pages = text.split('\n')
  for (const page of pages.slice(-5)) {
    const idx = page.indexOf('Questão Gabarito')
    if (idx >= 0) {
      const raw = page.slice(idx + 'Questão Gabarito'.length).replace(/^\s+/, '')
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
          if (n >= 1 && n <= 100) answers[n] = letter
        }
      }
      if (Object.keys(answers).length >= 50) return answers
    }
  }
  return {}
}

async function main() {
  console.log('=== LIMPEZA ===')
  for (const p of ['RDDI', 'USG']) {
    const r = await httpDelete('/rest/v1/challenge_question_pool?source_title=ilike.*CBR*' + p + '*')
    console.log('Delete CBR ' + p + ':', r.status)
  }
  
  console.log('\n=== CARREGANDO GABARITOS ===')
  
  // RDDI 2024 gabarito (known correct)
  const gab2024 = {}
  '1B 2C 3A 4A 5E 6B 7A 8B 9C 10E 11D 12B 13C 14D 15A 16C 17A 18D 19E 20D 21D 22C 23A 24E 25D 26A 27A 28B 29A 30D 31C 32E 33D 34E 35A 36A 37B 38E 39C 40E 41B 42A 43D 44A 45E 46C 47B 48D 49A 50C 51B 52B 53E 54D 55E 56D 57B 58E 59D 60A'.split(' ')
    .forEach(s => { const n = parseInt(s); const l = s[s.length-1]; gab2024[n] = l })
  
  // RDDI 2025 gabarito
  const gab2025Text = await extractText(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')
  const idx2025 = gab2025Text.indexOf('Questão Gabarito')
  const raw2025 = gab2025Text.slice(idx2025 + 'Questão Gabarito'.length).replace(/^\s+/, '')
  const gab2025 = {}
  let i = 0
  while (i < raw2025.length) {
    while (i < raw2025.length && (raw2025.charCodeAt(i) < 48 || raw2025.charCodeAt(i) > 57)) { i++ }
    if (i >= raw2025.length) break
    let numStr = ''
    while (i < raw2025.length && raw2025.charCodeAt(i) >= 48 && raw2025.charCodeAt(i) <= 57) { numStr += raw2025[i++] }
    while (i < raw2025.length && raw2025[i] === ' ') { i++ }
    if (i >= raw2025.length) break
    const letter = raw2025[i++].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0) {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 100) gab2025[n] = letter
    }
  }
  console.log('RDDI 2025 gabarito:', Object.keys(gab2025).length, 'answers')
  
  // USG 2023 gabaritos
  const gabMay = {10:'C', 30:'A'}
  const gabJune = {10:'B', 30:'E'}
  
  // USG 2019 gabaritos
  const gabUSG2019TPText = await extractText(CBR_BASE + '\\USG\\2019\\Gabarito-Teorico-Pratica-2019.pdf')
  const gabUSG2019TP = {}
  let m
  const reUSG2019 = /(\d+)\s+([A-E])\b/g
  while ((m = reUSG2019.exec(gabUSG2019TPText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 200) gabUSG2019TP[n] = m[2] }
  console.log('USG 2019 TP gabarito:', Object.keys(gabUSG2019TP).length, 'answers')
  
  // USG 2020 gabarito
  const gabUSG2020Text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
  const gabUSG2020 = parseUSG2020Format(gabUSG2020Text)
  console.log('USG 2020 gabarito:', Object.keys(gabUSG2020).length, 'answers:', Object.keys(gabUSG2020).sort((a,b)=>a-b).map(n=>n+gabUSG2020[n]).join(' '))
  
  // RDDI 2020 gabarito
  const gabRDDI2020Text = await extractText(CBR_BASE + '\\RDDI\\2020\\Gabarito-2020-v2.pdf')
  const gabRDDI2020 = {}
  const reRDDI2020 = /(\d+)\s+([A-E])\b/g
  while ((m = reRDDI2020.exec(gabRDDI2020Text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 200) gabRDDI2020[n] = m[2] }
  console.log('RDDI 2020 gabarito:', Object.keys(gabRDDI2020).length, 'answers')
  
  console.log('\n=== MONTANDO PERGUNTAS ===')
  
  const allQuestions = []
  
  // 1. RDDI 2024 from v2 JSON
  const r2024v2 = JSON.parse(fs.readFileSync(OUT + '\\cbr_rddi_2024_with_images_v2.json', 'utf8'))
  const seen2024 = new Set()
  for (const q of r2024v2.questions || []) {
    const num = parseInt(q.number)
    if (isNaN(num) || seen2024.has(num)) continue
    seen2024.add(num)
    const answer = gab2024[num]
    if (!answer || !/^[A-E]$/.test(answer)) continue
    const hasImage = !!(q.image_base64 && q.image_base64.length > 5000)
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral', question_text: q.text || '', question_type: 'multiple_choice',
      options: opts, correct_answer: answer, explanation: '',
      source_title: 'CBR RDDI 2024 — Questão ' + num,
      difficulty: 'medium', image_base64: hasImage ? q.image_base64 : null,
      has_image: hasImage, times_used: 0,
    })
  }
  console.log('RDDI 2024:', allQuestions.filter(q => q.source_title.includes('RDDI 2024')).length, 'Q,', allQuestions.filter(q => q.source_title.includes('RDDI 2024') && q.has_image).length, 'imgs')
  
  // 2. RDDI 2025 from corrected JSON
  const r2025 = JSON.parse(fs.readFileSync(OUT + '\\cbr_rddi_2025_with_images.json', 'utf8'))
  const seen2025 = new Set()
  for (const q of r2025.questions || []) {
    const num = parseInt(q.number)
    if (isNaN(num) || seen2025.has(num)) continue
    seen2025.add(num)
    const answer = gab2025[num]
    if (!answer || !/^[A-E]$/.test(answer)) continue
    const hasImage = !!(q.image_base64 && q.image_base64.length > 5000)
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral', question_text: q.text || '', question_type: 'multiple_choice',
      options: opts, correct_answer: answer, explanation: '',
      source_title: 'CBR RDDI 2025 — Questão ' + num,
      difficulty: 'medium', image_base64: hasImage ? q.image_base64 : null,
      has_image: hasImage, times_used: 0,
    })
  }
  console.log('RDDI 2025:', allQuestions.filter(q => q.source_title.includes('RDDI 2025')).length, 'Q,', allQuestions.filter(q => q.source_title.includes('RDDI 2025') && q.has_image).length, 'imgs')
  
  // 3. USG 2023 V1
  const usgV1 = JSON.parse(fs.readFileSync(OUT + '\\cbr_usg_2023_v1_with_images.json', 'utf8'))
  const seenV1 = new Set()
  for (const q of usgV1.questions || []) {
    const num = parseInt(q.number)
    if (isNaN(num) || seenV1.has(num)) continue
    seenV1.add(num)
    const answer = gabMay[num]
    if (!answer || !/^[A-E]$/.test(answer)) continue
    const hasImage = !!(q.image_base64 && q.image_base64.length > 5000)
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral', question_text: q.text || '', question_type: 'multiple_choice',
      options: opts, correct_answer: answer, explanation: '',
      source_title: 'CBR USG 2023 V1 — Questão ' + num,
      difficulty: 'medium', image_base64: hasImage ? q.image_base64 : null,
      has_image: hasImage, times_used: 0,
    })
  }
  console.log('USG 2023 V1:', allQuestions.filter(q => q.source_title.includes('USG 2023 V1')).length, 'Q')
  
  // 4. USG 2023 V2
  const usgV2 = JSON.parse(fs.readFileSync(OUT + '\\cbr_usg_2023_v2_with_images.json', 'utf8'))
  const seenV2 = new Set()
  for (const q of usgV2.questions || []) {
    const num = parseInt(q.number)
    if (isNaN(num) || seenV2.has(num)) continue
    seenV2.add(num)
    const answer = gabJune[num]
    if (!answer || !/^[A-E]$/.test(answer)) continue
    const hasImage = !!(q.image_base64 && q.image_base64.length > 5000)
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral', question_text: q.text || '', question_type: 'multiple_choice',
      options: opts, correct_answer: answer, explanation: '',
      source_title: 'CBR USG 2023 V2 — Questão ' + num,
      difficulty: 'medium', image_base64: hasImage ? q.image_base64 : null,
      has_image: hasImage, times_used: 0,
    })
  }
  console.log('USG 2023 V2:', allQuestions.filter(q => q.source_title.includes('USG 2023 V2')).length, 'Q')
  
  // 5. RDDI 2020 from extracted JSON
  const r2020 = JSON.parse(fs.readFileSync(OUT + '\\extracted_RDDI_2020.json', 'utf8'))
  for (const q of r2020.questions || []) {
    if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral', question_text: q.text || '', question_type: 'multiple_choice',
      options: opts, correct_answer: q.correct_answer, explanation: '',
      source_title: 'CBR RDDI 2020 — Questão ' + q.number,
      difficulty: 'medium', image_base64: null, has_image: false, times_used: 0,
    })
  }
  console.log('RDDI 2020:', allQuestions.filter(q => q.source_title.includes('RDDI 2020')).length, 'Q')
  
  // 6. USG 2019 from extracted
  const usg2019tp = JSON.parse(fs.readFileSync(OUT + '\\extracted_USG_2019_TP.json', 'utf8'))
  for (const q of usg2019tp.questions || []) {
    if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral', question_text: q.text || '', question_type: 'multiple_choice',
      options: opts, correct_answer: q.correct_answer, explanation: '',
      source_title: 'CBR USG 2019 — Questão ' + q.number,
      difficulty: 'medium', image_base64: null, has_image: false, times_used: 0,
    })
  }
  console.log('USG 2019:', allQuestions.filter(q => q.source_title.includes('USG 2019')).length, 'Q')
  
  // 7. RDDI 2019 from extracted
  const r2019 = JSON.parse(fs.readFileSync(OUT + '\\extracted_RDDI_2019.json', 'utf8'))
  for (const q of r2019.questions || []) {
    if (!q.correct_answer || !/^[A-E]$/.test(q.correct_answer)) continue
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral', question_text: q.text || '', question_type: 'multiple_choice',
      options: opts, correct_answer: q.correct_answer, explanation: '',
      source_title: 'CBR RDDI 2019 — Questão ' + q.number,
      difficulty: 'medium', image_base64: null, has_image: false, times_used: 0,
    })
  }
  console.log('RDDI 2019:', allQuestions.filter(q => q.source_title.includes('RDDI 2019')).length, 'Q')
  
  // 8. USG 2020 - extract questions with answers
  const usg2020JSON = JSON.parse(fs.readFileSync(OUT + '\\extracted_USG_2020_questions.json', 'utf8'))
  // Match with gabUSG2020 answers
  let usg2020Count = 0
  for (const q of usg2020JSON.questions || []) {
    const num = parseInt(q.number)
    const answer = gabUSG2020[num]
    if (!answer || !/^[A-E]$/.test(answer)) continue
    const opts = formatOptions(q.options)
    allQuestions.push({
      specialty: 'Geral', question_text: q.text || '', question_type: 'multiple_choice',
      options: opts, correct_answer: answer, explanation: '',
      source_title: 'CBR USG 2020 — Questão ' + q.number,
      difficulty: 'medium', image_base64: null, has_image: false, times_used: 0,
    })
    usg2020Count++
  }
  console.log('USG 2020:', usg2020Count, 'Q')
  
  console.log('\n=== TOTAL ===')
  const byE = {}
  allQuestions.forEach(q => {
    const m = q.source_title.match(/CBR\s+(RDDI|USG).*?(\d{4})/)
    const k = m ? m[1] + ' ' + m[2] : 'Other'
    if (!byE[k]) byE[k] = { total: 0, imgs: 0 }
    byE[k].total++
    if (q.has_image) byE[k].imgs++
  })
  Object.entries(byE).sort().forEach(([k, v]) => console.log(k + ': ' + v.total + 'Q (' + v.imgs + ' imgs)'))
  console.log('TOTAL:', allQuestions.length)
  
  console.log('\n=== INGESTÃO ===')
  let total = 0
  for (let i = 0; i < allQuestions.length; i += 50) {
    const batch = allQuestions.slice(i, i + 50)
    const r = await httpPost(batch)
    if (r.ok) {
      total += batch.length
      console.log(`Lote ${Math.floor(i/50)+1}: ${batch.length} ✓ (${total}/${allQuestions.length})`)
    } else {
      console.log(`Lote ${Math.floor(i/50)+1}: ERRO ${r.status}`)
      for (const q of batch) {
        const r2 = await httpPost([q])
        if (r2.ok) total++
      }
    }
  }
  console.log('\n✅ Ingerido:', total)
  
  // Verify
  const final = await httpGet('/rest/v1/challenge_question_pool?select=source_title,has_image&limit=400')
  console.log('\n=== ESTADO FINAL ===')
  console.log('Total pools:', final.length)
  const byF = {}
  final.forEach(q => {
    const m = q.source_title.match(/CBR\s+(RDDI|USG).*?(\d{4})/)
    const k = m ? m[1] + ' ' + m[2] : 'Other'
    if (!byF[k]) byF[k] = { total: 0, imgs: 0 }
    byF[k].total++
    if (q.has_image) byF[k].imgs++
  })
  Object.entries(byF).sort().forEach(([k, v]) => console.log(k + ': ' + v.total + 'Q (' + v.imgs + ' imgs)'))
}

main().catch(e => { console.error(e); process.exit(1) })