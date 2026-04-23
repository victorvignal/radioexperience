import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const https = require('https')
const fs = require('fs')

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'
const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

function httpPost(body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const req = https.request('https://pcdequsipbkxcfsewiow.supabase.co/rest/v1/challenge_question_pool', {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
    }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: d }) })
    })
    req.on('error', e => resolve({ ok: false, status: 0, body: e.message }))
    req.write(data)
    req.end()
  })
}

async function main() {
  console.log('=== Parsing all gabaritos ===')
  
  // USG 2018
  const { createRequire } = await import('module')
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
  
  async function extractText(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath))
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      text += '\n' + (await page.getTextContent()).items.map(item => item.str).join(' ')
    }
    return text
  }
  
  // Parse gabaritos
  const gabaritos = {}
  
  // USG 2018
  try {
    const text = await extractText(CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf')
    const re = /(\d+)\s+([A-E])\b/g
    const a = {}
    let m
    while ((m = re.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) a[n] = m[2] }
    gabaritos.usg_2018 = a
    console.log('USG 2018:', Object.keys(a).length, 'answers')
  } catch(e) { console.log('USG 2018 FAILED:', e.message) }
  
  // USG 2019 TP + USGO
  try {
    const tpText = await extractText(CBR_BASE + '\\USG\\2019\\Gabarito-Teorico-Pratica-2019.pdf')
    const tp = {}
    let m
    const re1 = /(\d+)\s+([A-E])\b/g
    while ((m = re1.exec(tpText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) tp[n] = m[2] }
    gabaritos.usg_2019_tp = tp
    console.log('USG 2019 TP:', Object.keys(tp).length, 'answers')
    
    const usgoText = await extractText(CBR_BASE + '\\USG\\2019\\Gabarito-USGO-2019.pdf')
    const usgo = {}
    const re2 = /(\d+)\s+([A-E])\b/g
    while ((m = re2.exec(usgoText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) usgo[n] = m[2] }
    gabaritos.usg_2019_usgo = usgo
    console.log('USG 2019 USGO:', Object.keys(usgo).length, 'answers')
  } catch(e) { console.log('USG 2019 FAILED:', e.message) }
  
  // USG 2020
  try {
    const text = await extractText(CBR_BASE + '\\USG\\2020\\Prova-Teorica-Teorico-Pratica-2020.pdf')
    const a = {}
    const re = /(\d+)\s+([A-E])\b/g
    let m
    while ((m = re.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) a[n] = m[2] }
    gabaritos.usg_2020 = a
    console.log('USG 2020:', Object.keys(a).length, 'answers')
  } catch(e) { console.log('USG 2020 FAILED:', e.message) }
  
  // USG 2022
  try {
    const text = await extractText(CBR_BASE + '\\USG\\2022\\Gabarito-Ginecologia-Obstetricia-2022.pdf')
    const a = {}
    const re = /(\d+)\s+([A-E])\b/g
    let m
    while ((m = re.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) a[n] = m[2] }
    gabaritos.usg_2022 = a
    console.log('USG 2022:', Object.keys(a).length, 'answers')
  } catch(e) { console.log('USG 2022 FAILED:', e.message) }
  
  // USG 2023
  try {
    const may = await extractText(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf')
    const mayA = {}
    let m
    const re = /(\d+)\s+([A-E])\b/g
    while ((m = re.exec(may)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) mayA[n] = m[2] }
    gabaritos.usg_2023_may = mayA
    console.log('USG 2023 May:', Object.keys(mayA).length, 'answers')
    
    const june = await extractText(CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-junho-2023.pdf')
    const juneA = {}
    const re2 = /(\d+)\s+([A-E])\b/g
    while ((m = re2.exec(june)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) juneA[n] = m[2] }
    gabaritos.usg_2023_june = juneA
    console.log('USG 2023 June:', Object.keys(juneA).length, 'answers')
  } catch(e) { console.log('USG 2023 FAILED:', e.message) }
  
  // USG 2025
  try {
    const text = await extractText(CBR_BASE + '\\USG\\2025\\Gabarito-Prova-USG-2025.pdf')
    const a = {}
    const re = /(\d+)\s+([A-E])\b/g
    let m
    while ((m = re.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) a[n] = m[2] }
    if (Object.keys(a).length > 0) gabaritos.usg_2025 = a
    else {
      // Try dense
      const reD = /(\d+)([A-E])(?=\d|$)/g
      while ((m = reD.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) a[n] = m[2] }
    }
    console.log('USG 2025:', Object.keys(a).length, 'answers')
  } catch(e) { console.log('USG 2025 FAILED:', e.message) }
  
  // RDDI 2019
  try {
    const anText = await extractText(CBR_BASE + '\\RDDI\\2019\\Gabarito-Avaliacao-Anual-2019.pdf')
    const an = {}
    let m
    const re = /(\d+)\s+([A-E])\b/g
    while ((m = re.exec(anText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) an[n] = m[2] }
    gabaritos.rddi_2019_anual = an
    console.log('RDDI 2019 Anual:', Object.keys(an).length, 'answers')
    
    const tpText = await extractText(CBR_BASE + '\\RDDI\\2019\\Gabarito-Prova-Titulo-2019.pdf')
    const tp = {}
    const re2 = /(\d+)\s+([A-E])\b/g
    while ((m = re2.exec(tpText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) tp[n] = m[2] }
    gabaritos.rddi_2019_tp = tp
    console.log('RDDI 2019 TP:', Object.keys(tp).length, 'answers')
  } catch(e) { console.log('RDDI 2019 FAILED:', e.message) }
  
  // RDDI 2020
  try {
    const text = await extractText(CBR_BASE + '\\RDDI\\2020\\Gabarito-2020-v2.pdf')
    const a = {}
    const re = /(\d+)\s+([A-E])\b/g
    let m
    while ((m = re.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) a[n] = m[2] }
    gabaritos.rddi_2020 = a
    console.log('RDDI 2020:', Object.keys(a).length, 'answers')
  } catch(e) { console.log('RDDI 2020 FAILED:', e.message) }
  
  // RDDI 2023
  try {
    const tpText = await extractText(CBR_BASE + '\\RDDI\\2023\\Gabarito-Teorico-Pratica-2023.pdf')
    const tp = {}
    let m
    const re = /(\d+)\s+([A-E])\b/g
    while ((m = re.exec(tpText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) tp[n] = m[2] }
    gabaritos.rddi_2023_tp = tp
    console.log('RDDI 2023 TP:', Object.keys(tp).length, 'answers')
    
    const geralText = await extractText(CBR_BASE + '\\RDDI\\2023\\Gabarito-Geral-2023.pdf')
    const geral = {}
    const re2 = /(\d+)\s+([A-E])\b/g
    while ((m = re2.exec(geralText)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) geral[n] = m[2] }
    gabaritos.rddi_2023_geral = geral
    console.log('RDDI 2023 Geral:', Object.keys(geral).length, 'answers')
  } catch(e) { console.log('RDDI 2023 FAILED:', e.message) }
  
  // RDDI 2024 (page 62 only)
  try {
    const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'))
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
    const page = await doc.getPage(62)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join('')
    
    const idx = pageText.indexOf('Questão Gabarito')
    const flexIdx = idx < 0 ? (pageText.match(/Questão\s+Gabarito/) || []).index : idx
    if (flexIdx >= 0) {
      const raw = pageText.slice(flexIdx + 'Questão Gabarito'.length).replace(/^\s+/, '')
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
      gabaritos.rddi_2024 = answers
      console.log('RDDI 2024:', Object.keys(answers).length, 'answers')
    }
  } catch(e) { console.log('RDDI 2024 FAILED:', e.message) }
  
  // RDDI 2025
  try {
    const text = await extractText(CBR_BASE + '\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf')
    const a = {}
    const re = /(\d+)\s+([A-E])\b/g
    let m
    while ((m = re.exec(text)) !== null) { const n = parseInt(m[1]); if (n >= 1 && n <= 300) a[n] = m[2] }
    gabaritos.rddi_2025 = a
    console.log('RDDI 2025:', Object.keys(a).length, 'answers')
  } catch(e) { console.log('RDDI 2025 FAILED:', e.message) }
  
  console.log('\n=== Loading JSONs and building questions ===')
  
  function loadJson(jsonPath, gabarito, label) {
    if (!fs.existsSync(jsonPath)) { console.log('  ' + label + ': JSON NOT FOUND'); return [] }
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    const questions = []
    const seen = new Set()
    for (const q of data.questions || []) {
      const num = parseInt(q.number)
      if (isNaN(num) || seen.has(num)) continue
      seen.add(num)
      const answer = gabarito[num]
      if (!answer || !/^[A-E]$/.test(answer)) continue
      const hasImage = !!(q.image_base64 && q.image_base64.length > 5000)
      const opts = {}
      for (const o of q.options || []) {
        if (typeof o === 'string') {
          const l = o.charAt(0).toUpperCase()
          if (l >= 'A' && l <= 'E') opts[l] = o.substring(3).trim()
        }
      }
      questions.push({
        specialty: 'Geral',
        question_text: q.text || q.question_text || '',
        question_type: 'multiple_choice',
        options: opts,
        correct_answer: answer,
        explanation: q.explanation || '',
        source_title: `${label} — Questão ${num}`,
        difficulty: q.difficulty || 'medium',
        image_base64: hasImage ? q.image_base64 : null,
        has_image: hasImage,
        times_used: 0,
      })
    }
    console.log('  ' + label + ':', questions.length, 'Qs,', questions.filter(q => q.has_image).length, 'images')
    return questions
  }
  
  const allQuestions = []
  
  // RDDI 2024
  allQuestions.push(...loadJson(OUT + '\\cbr_rddi_2024_with_images_v2.json', gabaritos.rddi_2024, 'CBR RDDI 2024'))
  
  // RDDI 2025
  allQuestions.push(...loadJson(OUT + '\\cbr_rddi_2025_with_images.json', gabaritos.rddi_2025, 'CBR RDDI 2025'))
  
  // USG 2023 V1
  allQuestions.push(...loadJson(OUT + '\\cbr_usg_2023_v1_with_images.json', gabaritos.usg_2023_may, 'CBR USG 2023 V1'))
  
  // USG 2023 V2
  allQuestions.push(...loadJson(OUT + '\\cbr_usg_2023_v2_with_images.json', gabaritos.usg_2023_june, 'CBR USG 2023 V2'))
  
  console.log(`\nTotal: ${allQuestions.length} (${allQuestions.filter(q => q.has_image).length} with images)`)
  
  console.log('\n=== Ingesting in batches of 50 ===')
  
  const BATCH = 50
  let total = 0
  for (let i = 0; i < allQuestions.length; i += BATCH) {
    const batch = allQuestions.slice(i, i + BATCH)
    const { ok, status: s, body } = await httpPost(batch)
    if (ok) {
      total += batch.length
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ${batch.length} ✓ (${total}/${allQuestions.length})`)
    } else {
      console.log(`Batch ${Math.floor(i/BATCH)+1}: ERROR ${s} — falling back to individual`)
      // One-by-one fallback
      for (const q of batch) {
        const r = await httpPost([q])
        if (r.ok) total++
        else console.log(`  FAIL: ${q.source_title}`)
      }
    }
  }
  
  console.log(`\n✅ Done: ${total}/${allQuestions.length} ingested`)
}

main().catch(e => { console.error(e); process.exit(1) })