/**
 * Build RDDI 2024 questions with images from extracted JPEGs
 * JPEG indices 97-111 are the last set (largest offsets) = likely Q49-Q60 images
 */
const fs = require('fs')
const path = require('path')

const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  // Load RDDI 2024 JSON
  const data = JSON.parse(fs.readFileSync(OUT + '\\cbr_rddi_2024_with_images.json', 'utf8'))
  const questions = data.questions
  console.log('RDDI 2024 questions:', questions.length)
  
  // Parse gabarito
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
  const gabData = new Uint8Array(fs.readFileSync(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'))
  const doc = await pdfjsLib.getDocument({ data: gabData, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const page = await doc.getPage(doc.numPages)
  const text = (await page.getTextContent()).items.map(i => i.str).join('')
  
  const gab = {}
  const raw = text.slice(text.indexOf('Gabarito') + 8).replace(/\s+/g, ' ').trim()
  let i = 0
  while (i < raw.length) {
    let numStr = '', letter
    while (i < raw.length && raw[i] >= '0' && raw[i] <= '9') numStr += raw[i++]
    while (i < raw.length && raw[i] === ' ') i++
    letter = raw[i++]
    if (numStr && letter && letter >= 'A' && letter <= 'Z') {
      const n = parseInt(numStr)
      if (n >= 1 && n <= 200) gab[n] = letter
    }
    while (i < raw.length && raw[i] === ' ') i++
  }
  
  const gabValid = Object.keys(gab).filter(k => /^[A-E]$/.test(gab[k])).length
  console.log('Gabarito answers:', gabValid)
  
  // Load large JPEGs from jpeg_src (indices 97-111)
  const jpegDir = OUT + '\\jpeg_src'
  const largeJpegs = []
  
  // Get jpeg indices 97-111
  for (let idx = 97; idx <= 111; idx++) {
    const name = `rddi_2024_jpeg_${String(idx).padStart(3, '0')}.jpg`
    const filePath = jpegDir + '\\' + name
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath)
      largeJpegs.push({ idx, name, size: buf.length, data: buf.toString('base64') })
    }
  }
  
  console.log('Large JPEGs loaded:', largeJpegs.length)
  largeJpegs.sort((a, b) => b.size - a.size)
  largeJpegs.forEach(j => console.log(`  JPEG ${j.idx}: ${j.size} bytes`))
  
  // Map questions to images
  // We know pages 50-55 = Q49-Q54 have images (1-2 each per page)
  // Pages 56-61 = Q55-Q60 also have images (from 112 total JPEGs)
  // So Q49-Q60 all have images
  
  // Questions with gabarito answers
  const withAnswer = questions.filter(q => {
    const n = parseInt(q.number)
    return gab[n] && /^[A-E]$/.test(gab[n])
  })
  console.log('\nQuestions with answers:', withAnswer.length)
  
  // Last 12 questions (Q49-Q60) get the large images
  const last12 = withAnswer.filter(q => {
    const n = parseInt(q.number)
    return n >= 49 && n <= 60
  }).sort((a, b) => parseInt(a.number) - parseInt(b.number))
  
  console.log('Last 12 (Q49-Q60) with answers:', last12.length)
  
  // Assign images to Q49-Q54 (we know from operator list these are the imaged ones on pages 50-55)
  // Q55-Q60 might also have images but we don't have page-level mapping
  // Let's assign based on JPEG index ordering:
  // Q49→J97, Q50→J98, Q51→J99, Q52→J100, Q53→J101, Q54→J102, Q55→J103, Q56→J104, etc.
  
  // But we only have 15 JPEGs for 12 questions. Let's assign progressively.
  const imgJpegs = largeJpegs.slice(0, 12) // Top 12 largest
  
  // Actually better: assign in offset order (smaller offset = earlier in PDF = lower question number)
  // jpeg 97-111 are already in offset order (ascending)
  // Last 12 JPEGs (by offset) = jpegs 100-111 (offset 7MB+) 
  // Actually sorted by offset: jpegs with highest idx = last in PDF = highest question numbers
  
  // Let me re-sort by offset
  const byOffset = largeJpegs.sort((a, b) => a.idx - b.idx) // already by idx=by offset
  
  // Assign Q49-Q60 to the 12 JPEGs in offset order
  last12.forEach((q, qi) => {
    const jpeg = imgJpegs[qi % imgJpegs.length]
    if (jpeg) {
      q.image_base64 = jpeg.data
      q.has_image = true
      q.correct_answer = gab[parseInt(q.number)]
      console.log(`Q${q.number} ← JPEG ${jpeg.idx} (${jpeg.size}B)`)
    }
  })
  
  // Now build all questions with answers + images
  const allQuestions = withAnswer.map(q => {
    const n = parseInt(q.number)
    return {
      specialty: 'Geral',
      question_text: q.text,
      question_type: 'multiple_choice',
      options: q.options,
      correct_answer: gab[n],
      explanation: q.explanation || '',
      source_title: `CBR RDDI 2024 — Questão ${q.number}`,
      difficulty: 'medium',
      image_base64: q.has_image ? q.image_base64 : null,
      has_image: q.has_image || false,
      times_used: 0,
    }
  })
  
  console.log('\nTotal to ingest:', allQuestions.length)
  const withImg = allQuestions.filter(q => q.has_image && q.image_base64 && q.image_base64.length > 1000)
  console.log('With images:', withImg.length)
  
  // Save the updated JSON
  fs.writeFileSync(OUT + '\\cbr_rddi_2024_with_images_v2.json', JSON.stringify({ questions: questions }, null, 2))
  console.log('Saved updated JSON')
  
  // Return count for next step
  console.log('\n=== READY TO INGEST ===')
  console.log('Questions:', allQuestions.length, '| With images:', withImg.length)
}

main().catch(e => { console.error(e); process.exit(1) })