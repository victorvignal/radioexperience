/**
 * Final ingest: merge new text with v2 images for RDDI 2024
 * + ingest all other exams
 */
const fs = require('fs')
const path = require('path')
const { createRequire } from 'module'

const __dirname = process.cwd()
const require = createRequire(import.meta.url)

const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'
const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

// ============================================================
// Step 1: Load all JSON files
// ============================================================
function loadJSON(filename) {
  const p = path.join(OUT, filename)
  if (!fs.existsSync(p)) { console.log('NOT FOUND:', filename); return null }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

// Load all exams
const rddi2024_v2 = loadJSON('cbr_rddi_2024_with_images_v2.json')
const rddi2025 = loadJSON('cbr_rddi_2025_with_images.json') || loadJSON('extracted_rddi-2025.json')
const rddi2020 = loadJSON('extracted_rddi-2020.json')
const usg2023_v1 = loadJSON('extracted_usg-2023-v1.json')
const usg2023_v2 = loadJSON('extracted_usg-2023-v2.json')
const usg2019 = loadJSON('extracted_usg-2019.json')

// ============================================================
// Step 2: Merge RDDI 2024 text with v2 images
// ============================================================
function mergeRDDI2024(v2, newText) {
  // Use v2 questions as base (has correct images), replace text with newText
  if (!newText || !newText.questions) return v2
  
  const newByNum = {}
  for (const q of newText.questions) {
    newByNum[q.question_number] = q
  }
  
  const merged = v2.questions.map(q => {
    const newQ = newByNum[q.number] || newByNum[q.question_number]
    if (newQ) {
      return {
        ...q,
        question_text: newQ.question_text || newQ.text || q.question_text || q.text,
        options: newQ.options || q.options,
        section: newQ.section || q.section,
        topic: newQ.topic || q.topic,
      }
    }
    return q
  })
  
  return { ...v2, questions: merged }
}

// ============================================================
// Step 3: Build questions array for Supabase
// ============================================================
function buildQuestions(json, specialty, year, sourceTitle) {
  if (!json || !json.questions) return []
  return json.questions.map(q => {
    // Handle different JSON formats
    const num = q.number ?? q.question_number ?? 0
    const text = q.question_text ?? q.text ?? ''
    const opts = q.options ?? []
    const answer = q.correct_answer ?? q.answer ?? null
    const imgBase64 = q.image_base64 ?? (q.images && q.images[0] ? q.images[0].data : null)
    const hasImg = q.has_image ?? (!!imgBase64)
    
    // Format options
    const formattedOptions = Array.isArray(opts) ? opts.map(o => {
      if (typeof o === 'string') return o
      return `${o.label || o.option_label}) ${o.text || o.option_text || ''}`
    }) : []
    
    return {
      specialty: specialty || 'Geral',
      question_text: text,
      question_type: 'multiple_choice',
      options: formattedOptions,
      correct_answer: answer,
      explanation: q.explanation || q.explicacao || '',
      source_title: sourceTitle || `${specialty} ${year} — Questão ${num}`,
      difficulty: q.difficulty || 'medium',
      image_base64: hasImg ? (imgBase64 || null) : null,
      has_image: hasImg,
      times_used: 0,
    }
  }).filter(q => q.correct_answer && q.question_text.length > 10)
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('=== CBR Final Ingest ===\n')
  
  const allQuestions = []
  
  // 1. RDDI 2024: v2 images + new text
  const rddi2024_newText = loadJSON('extracted_rddi-2024-completo.json') || loadJSON('rddi-2024.json')
  if (rddi2024_v2) {
    const merged = mergeRDDI2024(rddi2024_v2, rddi2024_newText)
    const qs = buildQuestions(merged, 'RDDI', 2024, 'CBR RDDI 2024')
    console.log('RDDI 2024:', qs.length, 'questions (with', qs.filter(q=>q.has_image).length, 'images)')
    allQuestions.push(...qs)
  }
  
  // 2. RDDI 2025
  if (rddi2025) {
    const qs = buildQuestions(rddi2025, 'RDDI', 2025, 'CBR RDDI 2025')
    console.log('RDDI 2025:', qs.length, 'questions (with', qs.filter(q=>q.has_image).length, 'images)')
    allQuestions.push(...qs)
  }
  
  // 3. RDDI 2020
  if (rddi2020) {
    const qs = buildQuestions(rddi2020, 'RDDI', 2020, 'CBR RDDI 2020')
    console.log('RDDI 2020:', qs.length, 'questions')
    allQuestions.push(...qs)
  }
  
  // 4. USG 2023 V1
  if (usg2023_v1) {
    const qs = buildQuestions(usg2023_v1, 'USG', 2023, 'CBR USG 2023 V1')
    console.log('USG 2023 V1:', qs.length, 'questions')
    allQuestions.push(...qs)
  }
  
  // 5. USG 2023 V2
  if (usg2023_v2) {
    const qs = buildQuestions(usg2023_v2, 'USG', 2023, 'CBR USG 2023 V2')
    console.log('USG 2023 V2:', qs.length, 'questions')
    allQuestions.push(...qs)
  }
  
  // 6. USG 2019
  if (usg2019) {
    const qs = buildQuestions(usg2019, 'USG', 2019, 'CBR USG 2019')
    console.log('USG 2019:', qs.length, 'questions')
    allQuestions.push(...qs)
  }
  
  console.log('\n=== TOTAL: ' + allQuestions.length + ' questions ===')
  console.log('With images:', allQuestions.filter(q => q.has_image).length)
  
  // Save combined JSON for ingest
  fs.writeFileSync(path.join(OUT, 'cbr_combined_for_ingest.json'), JSON.stringify(allQuestions, null, 2))
  console.log('\nSaved to cbr_combined_for_ingest.json')
}

main().catch(console.error)
