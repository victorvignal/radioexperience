/**
 * CBR Full Extractor v2 — faithful extraction with images and answers
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const { PDFDocument, PDFName, PDFDict, PDFStream } = require('pdf-lib')
const { createCanvas } = require('canvas')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = path.join(__dirname, 'cbr_output')

const PROVAS = [
  { id: 'rddi-2024', specialty: 'RDDI', year: 2024,
    prova: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf',
    gabarito: null, gabaritoPage: 62 },
  { id: 'rddi-2025', specialty: 'RDDI', year: 2025,
    prova: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf',
    gabarito: null, gabaritoPage: 65 },
  { id: 'rddi-2020', specialty: 'RDDI', year: 2020,
    prova: 'RDDI/2020/Prova-Anual-2020.pdf',
    gabarito: 'RDDI/2020/Gabarito-2020-v2.pdf' },
  { id: 'rddi-2019-anual', specialty: 'RDDI', year: 2019,
    prova: 'RDDI/2019/Prova-A-Avaliacao-Anual-2019.pdf',
    gabarito: 'RDDI/2019/Gabarito-Avaliacao-Anual-2019.pdf' },
  { id: 'rddi-2019-titulo', specialty: 'RDDI', year: 2019,
    prova: 'RDDI/2019/Prova-A-Avaliacao-Anual-2019.pdf',
    gabarito: 'RDDI/2019/Gabarito-Prova-Titulo-2019.pdf' },
  { id: 'rddi-2018', specialty: 'RDDI', year: 2018,
    prova: 'RDDI/2018/Prova-Anual-2018.pdf', gabarito: null },
  { id: 'rddi-2018-tp', specialty: 'RDDI', year: 2018,
    prova: 'RDDI/2018/Prova-Teorico-Pratica-TipoA-2018.pdf', gabarito: null },
  { id: 'rddi-2021', specialty: 'RDDI', year: 2021,
    prova: 'RDDI/2021/Prova-Anual-R3-2021.pdf', gabarito: null },
  { id: 'rddi-2023', specialty: 'RDDI', year: 2023,
    prova: 'RDDI/2023/Prova-Teorico-Pratica-v3-2023.pdf',
    gabarito: 'RDDI/2023/Gabarito-Teorico-Pratica-2023.pdf' },
  { id: 'usg-2023-v1', specialty: 'USG', year: 2023,
    prova: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf',
    gabarito: 'USG/2023/Gabarito-USG-Geral-maio-2023.pdf' },
  { id: 'usg-2023-v2', specialty: 'USG', year: 2023,
    prova: 'USG/2023/Prova-Teorica-TP-v2-2023.pdf',
    gabarito: 'USG/2023/Gabarito-USG-Geral-junho-2023.pdf' },
  { id: 'usg-2019', specialty: 'USG', year: 2019,
    prova: 'USG/2019/Prova-Anual-2019.pdf',
    gabarito: 'USG/2019/Gabarito-Teorico-Pratica-2019.pdf' },
  { id: 'usg-2018', specialty: 'USG', year: 2018,
    prova: 'USG/2018/Prova-Teorico-Pratica-Maio-2018.pdf', gabarito: null },
  { id: 'usg-2020', specialty: 'USG', year: 2020,
    prova: 'USG/2020/Prova-Teorica-Teorico-Pratica-2020.pdf', gabarito: null },
  { id: 'usg-2025', specialty: 'USG', year: 2025,
    prova: 'USG/2025/Gabarito-Prova-USG-2025.pdf', gabarito: null, isGabOnly: true },
]

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }

async function extractPages(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push({ pageNum: i, text: content.items.map(item => item.str).join('') })
  }
  return { numPages: doc.numPages, pages }
}

function parseDenseAnswers(text) {
  const answers = {}
  let i = 0
  while (i < text.length) {
    while (i < text.length && (text.charCodeAt(i) < 48 || text.charCodeAt(i) > 57)) i++
    if (i >= text.length) break
    let numStr = ''
    while (i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) numStr += text[i++]
    while (i < text.length && (text.charCodeAt(i) <= 32 || text.charCodeAt(i) === 160)) i++
    if (i >= text.length) break
    const letter = text[i].toUpperCase()
    if (letter >= 'A' && letter <= 'E' && numStr.length > 0 && numStr.length <= 3) {
      i++
      const n = parseInt(numStr)
      if (n >= 1 && n <= 300) answers[n] = letter
    }
  }
  return answers
}

async function extractPageImages(pageDict, pageNum) {
  const images = []
  try {
    const resources = pageDict.lookup(PDFName.of('Resources'))
    if (!resources || !(resources instanceof PDFDict)) return images
    const xObject = resources.lookup(PDFName.of('XObject'))
    if (!xObject || !(xObject instanceof PDFDict)) return images
    for (const [, ref] of xObject.entries()) {
      const stream = xObject.context.lookup(ref)
      if (!(stream instanceof PDFStream)) continue
      const subtype = stream.dict.lookup(PDFName.of('Subtype'))
      if (!subtype || subtype.asString()?.toString() !== 'Image') continue
      const width = stream.dict.lookup(PDFName.of('Width'))?.asNumber()
      const height = stream.dict.lookup(PDFName.of('Height'))?.asNumber()
      const filter = stream.dict.lookup(PDFName.of('Filter'))?.asString()?.toString()
      let imageData = stream.readBytes()
      if (filter === 'DCTDecode') {
        // JPEG — use directly
      } else {
        try {
          const w = width || 800, h = height || 600
          const c = createCanvas(w, h)
          const ctx = c.getContext('2d')
          const imgData = ctx.createImageData(w, h)
          imgData.data.set(imageData)
          ctx.putImageData(imgData, 0, 0)
          imageData = Buffer.from(c.toDataURL('image/png').split(',')[1], 'base64')
        } catch { continue }
      }
      const base64 = imageData.toString('base64')
      if (base64.length > 5000) images.push({ page: pageNum, base64 })
    }
  } catch (e) {}
  return images
}

function isLikelyGarbled(text) {
  if (!text) return false
  const garbled = ['$QD', '$TX', '¿D', '¿A', '$3', '$1', '¿']
  const found = garbled.filter(p => text.includes(p))
  if (found.length >= 2) return true
  const upperSpecial = (text.match(/[¿$]/g) || []).length
  return upperSpecial > text.length * 0.02
}

function parseQuestions(fullText, pageTexts, pageImages, docId) {
  const questions = []
  // Split on Questão marker — join pages with \n so markers are preserved
  const parts = fullText.split(/(?=Questão\s*\d+)/i)

  for (const part of parts) {
    if (!part.trim()) continue
    const numMatch = part.match(/Questão\s*(\d+)/i)
    if (!numMatch) continue
    const qNum = parseInt(numMatch[1])
    if (!qNum || qNum > 300) continue

    let body = part.replace(/Questão\s*\d+/i, '').trim()

    // Section
    const sectionMatch = body.match(/\b(R[123])\b/i)
    const section = sectionMatch ? sectionMatch[1].toUpperCase() : ''

    // Page tracking
    let pageStart = 1, pageEnd = 1
    for (let p = 1; p <= pageTexts.length; p++) {
      if (pageTexts[p - 1].includes('Questão ' + qNum) || pageTexts[p - 1].includes('Questão ' + qNum)) {
        if (pageStart === 1) pageStart = p
        pageEnd = p
      }
    }

    // FIXED: no ^ anchor — options appear mid-line after periods
    const optMatches = [...body.matchAll(/([A-E])\s*[)-]\s*/gm)]
    const optLabels = optMatches.map(m => m[1])

    const optTexts = []
    for (let i = 0; i < optLabels.length; i++) {
      const start = optMatches[i].index
      const end = i + 1 < optMatches.length ? optMatches[i + 1].index : body.length
      let optText = body.substring(start, end).replace(/^[A-E]\s*[)-]\s*/, '').replace(/\s+/g, ' ').trim()
      optTexts.push(optText)
    }

    let questionText = ''
    if (optMatches.length > 0) {
      const firstOptStart = optMatches[0].index
      questionText = body.substring(0, firstOptStart).replace(/\s+/g, ' ').trim()
    } else {
      questionText = body.substring(0, 1500).replace(/\s+/g, ' ').trim()
    }
    questionText = questionText.replace(/^\d+\s*/, '').trim()

    const options = []
    for (const label of ['A', 'B', 'C', 'D', 'E']) {
      const idx = optLabels.indexOf(label)
      options.push({ label, text: idx >= 0 ? optTexts[idx] : '' })
    }

    const garbled = isLikelyGarbled(questionText) || options.some(o => isLikelyGarbled(o.text))
    const hasImage = pageImages.length > 0
    const reviewRequired = garbled || options.some(o => !o.text) || optLabels.length < 5

    const images = hasImage ? pageImages.map((img, i) => ({
      file_name: `${docId}_q${String(qNum).padStart(3, '0')}_img${String(i + 1).padStart(2, '0')}.jpg`,
      page: img.page,
      position_note: 'extracted_from_pdf_xobject',
      caption_or_legend: '',
    })) : []

    questions.push({
      question_number: qNum,
      section,
      page_start: pageStart,
      page_end: pageEnd,
      question_text: questionText.slice(0, 3000),
      options,
      has_image: hasImage,
      images,
      correct_answer: null,
      review_required: reviewRequired,
      boundary_uncertain: false,
      image_assignment_uncertain: false,
      ocr_confidence_note: garbled ? 'Likely garbled text — secondary font encoding, needs OCR review' : '',
    })
  }

  return questions
}

async function main() {
  ensureDir(OUT)
  const results = []

  for (const prova of PROVAS) {
    const provaPath = path.join(CBR_BASE, prova.prova)
    if (!fs.existsSync(provaPath)) {
      console.log(`⚠️  Missing: ${prova.prova}`)
      continue
    }

    console.log(`\n📄 ${prova.id}...`)
    try {
      const { numPages, pages } = await extractPages(provaPath)
      const pageTexts = pages.map(p => p.text)
      const fullText = pages.map(p => p.text).join('\n')

      // Images
      let pageImages = []
      if (!prova.isGabOnly) {
        const pdfDoc = await PDFDocument.load(fs.readFileSync(provaPath))
        for (let i = 0; i < pdfDoc.getPages().length; i++) {
          const imgs = await extractPageImages(pdfDoc.getPages()[i].node, i + 1)
          pageImages.push(...imgs)
        }
      }

      // Answers
      let answers = {}
      if (prova.isGabOnly) {
        answers = parseDenseAnswers(fullText)
      } else if (prova.gabaritoPage) {
        const gabPage = pages.find(p => p.pageNum === prova.gabaritoPage)
        if (gabPage) {
          const marker = gabPage.text.match(/Questão\s+Gabarito/i)
          if (marker) {
            answers = parseDenseAnswers(gabPage.text.substring(marker.index))
          }
        }
      } else if (prova.gabarito) {
        const gabPath = path.join(CBR_BASE, prova.gabarito)
        if (fs.existsSync(gabPath)) {
          const { pages: gabPages } = await extractPages(gabPath)
          const gabText = gabPages.map(p => p.text).join('\n')
          answers = parseDenseAnswers(gabText)
        }
      }

      // Parse
      const questions = parseQuestions(fullText, pageTexts, pageImages, prova.id)

      // Link answers
      let withAnswers = 0
      for (const q of questions) {
        if (answers[q.question_number]) {
          q.correct_answer = answers[q.question_number]
          withAnswers++
        }
      }

      const withImg = questions.filter(q => q.has_image).length
      const flagged = questions.filter(q => q.review_required).length

      console.log(`   ${questions.length} Q | ${withAnswers} c/resposta | ${withImg} c/imagem | ${flagged} p/revisão`)

      const validQs = questions.filter(q => q.question_text.length > 20)
      if (validQs.length > 0) {
        const sq = validQs[0]
        console.log(`   Sample: Q${sq.question_number} | txt.len=${sq.question_text.length} | opts=${sq.options.length} | ans=${sq.correct_answer || '-'}`)
      }

      const output = {
        document_id: prova.id,
        source_file: prova.prova,
        total_pages: numPages,
        specialty: prova.specialty,
        year: prova.year,
        questions,
      }

      fs.writeFileSync(path.join(OUT, `${prova.id}.json`), JSON.stringify(output, null, 2), 'utf8')
      results.push({ id: prova.id, questions: questions.length, withAnswers, withImg, flagged })
    } catch (e) {
      console.log(`   ❌ ${e.message}`)
    }
  }

  console.log('\n========== SUMMARY ==========')
  let total = 0
  results.forEach(r => {
    console.log(`${r.id}: ${r.questions}Q ${r.withAnswers}ans ${r.withImg}imgs ${r.flagged}flag`)
    total += r.questions
  })
  console.log(`TOTAL: ${total} questões`)
}

main().catch(console.error)
