/**
 * CBR Questions + Images Extractor — MERGED v3 text + render images
 * - Text: pdfjs-dist with isCleanTextItem filter (no corrupted glyph IDs)
 * - Images: pdf-lib XObject extraction (works for RDDI 2025/2024 with embedded JPEGs)
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'
import { PDFDocument, PDFName } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

const PROVAS = [
  { specialty: 'RDDI', year: 2025, file: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf', has_gabarito_pages: true, gabarito_pages: [65, 66], pattern: 'ID', suffix: '' },
  { specialty: 'RDDI', year: 2024, file: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf', has_gabarito_pages: true, gabarito_pages: [62], pattern: 'SIMPLE', suffix: '' },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf', has_gabarito_pages: false, pattern: 'USG', suffix: '_v1' },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v2-2023.pdf', has_gabarito_pages: false, pattern: 'USG', suffix: '_v2' },
]

// ============================================================
// isCleanTextItem — filter out raw glyph IDs from fonts w/o Unicode
// ============================================================
function isCleanTextItem(text) {
  if (!text || text.length === 0) return false
  let suspiciousCharCount = 0
  let hasControlChar = false
  for (const char of text) {
    const cp = char.codePointAt(0)
    if (cp <= 0x001F || (cp >= 0x007F && cp <= 0x009F)) { hasControlChar = true; break }
    if (cp >= 0xD800 || (cp >= 0xE000 && cp <= 0xF8FF)) { hasControlChar = true; break }
    if (cp > 0x00FF && cp < 0x0100) suspiciousCharCount++
  }
  if (hasControlChar) return false
  if (text.length > 3 && suspiciousCharCount / text.length > 0.3) return false
  return true
}

// ============================================================
// extractAllText — pdfjs with clean text filtering
// ============================================================
async function extractAllText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({
    data, useWorkerFetch: false, isEvalEnabled: false,
    disableFontFace: true, useSystemFonts: true,
  }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent({ includeAnnotationContent: false, disableCombineTextItems: false })
    let pageText = ''
    let lastY = null, lastX = null
    for (const item of content.items) {
      if ('str' in item) {
        const text = item.str
        if (!isCleanTextItem(text)) {
          console.log(`  [WARN] Skipping corrupted text item on page ${i}: "${text.substring(0, 40)}"`)
          continue
        }
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n'; lastX = null
        } else if (lastX !== null && item.transform[4] - lastX > 20) {
          pageText += ' '
        }
        pageText += text
        lastY = item.transform[5]
        lastX = item.transform[4] + (item.width || 0)
      }
    }
    pages.push({ pageNum: i, text: pageText })
  }
  return { doc, pages }
}

// ============================================================
// extractPdfImages — pdf-lib XObject extraction
// ============================================================
async function extractPdfImages(pdfDoc) {
  const imagesByPage = new Map()
  for (let i = 0; i < pdfDoc.getPages().length; i++) {
    const page = pdfDoc.getPages()[i]
    let resources, xObject
    try {
      resources = page.node.get(PDFName.of('Resources'))
      if (resources) xObject = resources.get(PDFName.of('XObject'))
    } catch {}
    if (!xObject) {
      try {
        resources = page.node.lookup(PDFName.of('Resources'))
        if (resources) xObject = resources.lookup(PDFName.of('XObject'))
      } catch {}
    }
    if (!xObject) continue
    const pageImgs = []
    for (const [, ref] of xObject.entries()) {
      try {
        const stream = pdfDoc.context.lookup(ref)
        if (!stream) continue
        const dict = stream.dict || stream
        const subtype = dict.lookup ? dict.lookup(PDFName.of('Subtype')) : dict.get(PDFName.of('Subtype'))
        if (!subtype || subtype.toString() !== '/Image') continue
        let rawBytes = null
        try {
          if (typeof stream.getContents === 'function') {
            const c = stream.getContents()
            rawBytes = (c instanceof Uint8Array || c instanceof Buffer) ? c : Buffer.from(c)
          } else if (typeof stream.asUint8Array === 'function') {
            rawBytes = stream.asUint8Array()
          }
        } catch {}
        if (!rawBytes || rawBytes.length === 0) continue
        if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
          pageImgs.push(Buffer.from(rawBytes).toString('base64')); continue
        }
        if (rawBytes[0] === 0x78) {
          try {
            const decompressed = zlib.inflateSync(Buffer.from(rawBytes))
            if (decompressed[0] === 0xFF && decompressed[1] === 0xD8) {
              pageImgs.push(Buffer.from(decompressed).toString('base64'))
            }
          } catch {}
        }
      } catch {}
    }
    if (pageImgs.length) imagesByPage.set(i + 1, pageImgs)
  }
  return imagesByPage
}

// ============================================================
// extractGabarito
// ============================================================
function extractGabarito(pages, gabaritoPages) {
  const text = gabaritoPages.map(p => pages[p - 1]?.text || '').join('\n')
    .replace(/GABARITO\s*PRELI[GМ]?AR/gi, '').replace(/GABARITO/gi, '').replace(/Questão\s*/gi, '')
    .replace(/2ª\s*ETAPA.*$/gs, '').replace(/RADIOLOGIA.*$/gs, '').replace(/nulada/gi, '').trim()
  const answers = {}
  for (const m of text.matchAll(/(\d+)\s+([A-E])(?=\d|$)/g)) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 100) answers[n] = m[2]
  }
  return answers
}

// ============================================================
// parseAll
// ============================================================
function identifyTopics(text) {
  const t = text.toLowerCase()
  const topics = []
  const kw = {
    mama: ['mama', 'mamografia', 'birads', 'bi-rads', 'nódulo mamário', 'carcinoma mamário', 'axila', 'rebanho mamário', 'ca mama'],
    neurorradiologia: ['cérebro', 'encefálic', 'rnmu', 'lc', 'hipófise', 'hipofis', 'hipocamp', 'temporal', 'nuclear', 'parkinson', 'alzheimer', 'esclerose', 'avc', 'acidente vascular', 'hemorragia intracraniana', 'isquemia', 'tumor cerebral', 'meningioma', 'glioma', 'neurocisticercose', 'malformação arteriovenosa', 'aneurisma intracraniano', 'esclerose múltipla'],
    torax: ['pulmão', 'pulmonar', 'tórax', 'torácic', 'pleural', 'consolidação', 'nódulo pulmonar', 'massa mediastinal', 'cardiomegalia', 'edi', 'tuberculose', 'pneumotórax', 'asma', 'dpoc', 'enfisema', 'bronquiectasia', 'pneumonia', 'bronquite', 'fibrose pulmonar'],
    abdome: ['fígado', 'hepático', 'vesícula', 'biliar', 'colelitíase', 'pancreat', 'rins', 'renal', 'adrenal', 'baço', 'esplenic', 'intestinal', 'colite', 'apendicite', 'obstrutiva', 'diverticul', 'hepatoesplenomegalia', 'ascite', 'hepatomegalia', 'esteatose', 'cirrose'],
    msk: ['óssea', 'osseo', 'fratura', 'articul', 'quadril', 'joelho', 'coluna', 'vertebral', 'lombalgia', 'tornozelo', 'ombro', 'cotovelo', 'femur', 'femoral', 'tíbia', 'perônio', 'úmero', 'artrose', 'artrit', 'osteomielite', 'necrose avascular', 'perthes', 'les', 'osso'],
    vascular: ['aorta', 'aneurisma', 'vascular', 'arterial', 'venoso', 'tvp', 'trombose venosa', 'embolia pulmonar', 'isquemia arterial', 'dao', 'stent', 'angioplastia', 'endarterectomia', 'insuficiência venosa', 'varizes'],
    pediatria: ['pediátric', 'neonatal', 'recém-nascido', 'lactente', 'criança', 'infantil', 'malformação congênita', 'atresia', 'estenose', 'onfalocele', 'gastrosquise', 'hidronefrose'],
    medicina_nuclear: ['cintilografia', 'pet-ct', 'spect', 'tc99m', 'mibi', 'dmtp', 'gammagrafia', 'hipertireoidismo', 'tireoide', 'paratireoide'],
  }
  for (const [topic, keywords] of Object.entries(kw)) {
    if (keywords.some(k => t.includes(k))) topics.push(topic)
  }
  return topics.length ? [...new Set(topics)] : ['geral']
}

function parseAll(fullText, year, specialty, pattern) {
  const questions = []
  let parts, numRe, bodyRe, optRe
  if (pattern === 'ID') {
    parts = fullText.split(/(?=Questão\s+\d+\s+(?:-)?\s*ID:)/)
    numRe = /^Questão\s+(\d+)\s+(?:-)?\s*ID:/i
    bodyRe = /^Questão\s+\d+\s+(?:-)?\s*ID:\s*\d+/i
    optRe = /^([A-E])\)\s*/
  } else if (pattern === 'USG') {
    parts = fullText.split(/(?=QUESTÃO\s*\d+)/i)
    numRe = /^QUESTÃO\s*(\d+)/i
    bodyRe = /^QUESTÃO\s*\d+/i
    optRe = /^([A-E])\s*-\s*/
  } else {
    parts = fullText.split(/(?=Questão\s*\d+)/i)
    numRe = /^Questão\s*(\d+)/i
    bodyRe = /^Questão\s*\d+/i
    optRe = /^([A-E])\)\s*/
  }
  for (const part of parts) {
    if (!part.trim()) continue
    const numMatch = part.match(numRe)
    if (!numMatch) continue
    const qNum = parseInt(numMatch[1])
    let body = part.replace(bodyRe, '')
    const sections = body.split(pattern === 'USG' ? /(?=[A-E]\s*-\s*)/ : /(?=[A-E]\)\s*)/)
    let questionText = (sections[0] || body).replace(/\s+/g, ' ').trim()
    // Remove residual control chars and trailing page numbers
    questionText = questionText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').replace(/\s*\.\d+$/, '').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim()
    questionText = questionText.replace(/^[\d]+\s*/, '').replace(/\s*page\s*\d+\s*$/gi, '')
    if (questionText.length < 5) continue
    const options = []
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      const m = sec.match(optRe)
      if (m) {
        const txt = m[1] === '-' ? sec.replace(/^[A-E]\s*-\s*/, '').replace(/\s+/g, ' ').trim() : sec.replace(/^[A-E]\)\s*/, '').replace(/\s+/g, ' ').trim()
        if (txt.length > 1) options.push(`${m[1]}) ${txt.replace(/\s*\.\d+$/, '')}`)
      }
    }
    if (options.length < 2) continue
    const topics = identifyTopics(questionText)
    questions.push({ number: qNum, text: questionText.slice(0, 800), options, correct_answer: null, topic: topics[0] || 'geral', topics, year, specialty })
  }
  return questions
}

// ============================================================
// findQuestionPages — text search for page number per question
// ============================================================
function findQuestionPages(pages, questions) {
  const pageMap = {}
  for (const q of questions) {
    const searchTerms = [`Questão ${q.number} `, `Questão ${q.number}.`, `Questão ${q.number}ID:`, `Questão ${q.number}-`, `QUESTÃO ${q.number}`, `QUESTÃO ${q.number} `]
    let foundPage = null
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      for (const term of searchTerms) {
        if (pages[pIdx].text.includes(term)) { foundPage = pIdx + 1; break }
      }
      if (foundPage) break
    }
    pageMap[q.number] = foundPage || Math.ceil(q.number / 2)
  }
  return pageMap
}

// ============================================================
// assignImagesToQuestions — smart image→question matching
// ============================================================
function assignImagesToQuestions(pageImgMap, pageGroups) {
  for (const [pageNum, pageQuestions] of Object.entries(pageGroups)) {
    const imagesOnPage = pageImgMap[parseInt(pageNum)] || []
    const questionsNeedingImages = pageQuestions.filter(q => q.text.includes('imagem') || q.text.includes('figura') || q.text.includes('raio-x') || q.text.includes(' raio x') || q.text.includes('rx ') || q.text.includes(' observe') || q.text.includes('analise'))
    if (questionsNeedingImages.length === 0) continue
    if (imagesOnPage.length === 0) { for (const q of questionsNeedingImages) q.needs_image = true; continue }
    for (let i = 0; i < questionsNeedingImages.length; i++) {
      questionsNeedingImages[i].has_image = true
      questionsNeedingImages[i].image_base64 = imagesOnPage[i % imagesOnPage.length]
    }
  }
}

// ============================================================
// main
// ============================================================
async function main() {
  console.log('🚀 CBR Questions + Images (Merged)\n')
  let allQuestions = []

  for (const prova of PROVAS) {
    const pdfPath = path.join(CBR_BASE, prova.file)
    if (!fs.existsSync(pdfPath)) { console.log(`⚠️  Nao encontrado: ${prova.file}`); continue }
    if (prova.pattern === 'NONE') continue

    process.stdout.write(`📄 ${prova.specialty} ${prova.year}${prova.suffix}... `)
    try {
      const { doc, pages } = await extractAllText(pdfPath)
      process.stdout.write(`${doc.numPages}p `)

      // Load PDF with pdf-lib for image extraction
      const pdfBuffer = fs.readFileSync(pdfPath)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const imagesByPage = await extractPdfImages(pdfDoc)
      const totalImgs = [...imagesByPage.values()].reduce((s, p) => s + p.length, 0)
      process.stdout.write(`(${totalImgs} embedded imgs) `)

      const gabarito = prova.has_gabarito_pages ? extractGabarito(pages, prova.gabarito_pages) : {}
      if (Object.keys(gabarito).length) process.stdout.write(`(${Object.keys(gabarito).length} gab) `)

      const questions = parseAll(pages.map(p => p.text).join(''), prova.year, prova.specialty, prova.pattern)
      for (const q of questions) { if (gabarito[q.number]) q.correct_answer = gabarito[q.number] }
      const withAnswers = questions.filter(q => q.correct_answer).length

      // Precise image-to-question mapping
      const questionPageMap = findQuestionPages(pages, questions)
      const pageImgMap = {}
      for (const [pg, imgs] of imagesByPage) { pageImgMap[pg] = imgs }
      const pageGroups = {}
      for (const q of questions) {
        const pg = questionPageMap[q.number] || Math.ceil(q.number / 2)
        if (!pageGroups[pg]) pageGroups[pg] = []
        pageGroups[pg].push(q)
      }
      assignImagesToQuestions(pageImgMap, pageGroups)

      // At document level: mark questions that need images but document has none
      const docHasImages = imagesByPage.size > 0
      for (const q of questions) {
        const needsImg = q.text.includes('imagem') || q.text.includes('figura') || q.text.includes('raio-x') || q.text.includes(' raio x') || q.text.includes('rx ') || q.text.includes(' observe') || q.text.includes('analise')
        if (needsImg && !q.has_image) q.needs_image = true
      }

      const withImg = questions.filter(q => q.has_image).length
      const needImg = questions.filter(q => q.needs_image).length
      process.stdout.write(`✅ ${questions.length} Qs`)
      if (withAnswers) process.stdout.write(` (${withAnswers} c/resp)`)
      if (withImg > 0) process.stdout.write(` [${withImg} imgs]`)
      if (needImg > 0) process.stdout.write(` [${needImg} need img]`)
      process.stdout.write('\n')

      fs.writeFileSync(path.join(__dirname, 'cbr_output', `cbr_${prova.specialty.toLowerCase()}_${prova.year}${prova.suffix}_with_images.json`), JSON.stringify({
        specialty: prova.specialty, year: prova.year,
        source: `Provas CBR ${prova.year}${prova.suffix}`,
        total_questions: questions.length,
        questions: questions.map(q => ({
          number: q.number, text: q.text, options: q.options,
          correct_answer: q.correct_answer, topic: q.topic, topics: q.topics,
          has_image: q.has_image, image_base64: q.image_base64 || null, explanation: q.explanation,
          difficulty: q.text.split(/\s+/).length < 20 ? 'básica' : q.text.split(/\s+/).length < 50 ? 'intermediária' : 'avançada',
        })),
      }, null, 2), 'utf-8')

      allQuestions.push(...questions.map(q => ({ ...q, specialty: prova.specialty })))
    } catch (e) { process.stdout.write(`\n❌ ${e.message}\n`); console.error(e.stack) }
  }

  if (allQuestions.length) {
    const withImg = allQuestions.filter(q => q.has_image).length
    const needImg = allQuestions.filter(q => q.needs_image).length
    console.log(`\n📊 Total: ${allQuestions.length} questoes`)
    console.log(`   Com imagem: ${withImg}`)
    console.log(`   Precisa imagem: ${needImg}`)
    fs.writeFileSync(path.join(__dirname, 'cbr_output', 'cbr_all_combined.json'), JSON.stringify(allQuestions.map(q => ({
      number: q.number, text: q.text, options: q.options,
      correct_answer: q.correct_answer, topic: q.topic, topics: q.topics,
      has_image: q.has_image, image_base64: q.image_base64 || null, explanation: q.explanation,
      specialty: q.specialty, difficulty: q.text.split(/\s+/).length < 20 ? 'básica' : q.text.split(/\s+/).length < 50 ? 'intermediária' : 'avançada',
    })), null, 2))
    console.log(`💾 Salvo em scripts/cbr_output/`)
  }
  console.log(`\n✅ Feito!`)
}

main().catch(console.error)
