/**
 * CBR Questions + Images Extractor
 * - Text via pdfjs-dist
 * - Images: pdf-lib getContents() → zlib → raw JPEG bytes
 * - Questions get JPEG base64 images attached directly (not page renders)
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'
import sharp from 'sharp'
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

// Extract JPEG images from PDF pages
// Supports: pure DCTDecode (JPEG direct), FlateDecode→DCTDecode (zlib+jpeg)
async function extractPdfImages(pdfPath) {
  const buffer = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(buffer)
  const imagesByPage = new Map()

  for (let i = 0; i < pdfDoc.getPages().length; i++) {
    const page = pdfDoc.getPages()[i]
    let resources, xObject
    // Try newer API first, fall back to older lookup API
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

        // Check subtype
        const subtype = dict.lookup ? dict.lookup(PDFName.of('Subtype')) : dict.get(PDFName.of('Subtype'))
        if (!subtype || subtype.toString() !== '/Image') continue

        // Get raw bytes — try multiple methods
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

        // Pure JPEG (DCTDecode) — starts with FF D8
        if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
          pageImgs.push(Buffer.from(rawBytes).toString('base64'))
          continue
        }
        // FlateDecode zlib wrapper — starts with zlib header 0x78
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
  return { buffer, imagesByPage }
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
    let questionText = (sections[0] || body).replace(/\s+/g, ' ').trim().replace(/^[\d]+\s*/, '')
    const options = []
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      const m = sec.match(optRe)
      if (m) {
        const txt = m[1] === '-' ? sec.replace(/^[A-E]\s*-\s*/, '').replace(/\s+/g, ' ').trim() : sec.replace(/^[A-E]\)\s*/, '').replace(/\s+/g, ' ').trim()
        if (txt.length > 1) options.push(`${m[1]}) ${txt}`)
      }
    }
    if (options.length < 2) continue
    const topics = identifyTopics(questionText)
    questions.push({ number: qNum, text: questionText.slice(0, 800), options, correct_answer: null, topic: topics[0] || 'geral', topics, year, specialty })
  }
  return questions
}

function identifyTopics(text) {
  const t = text.toLowerCase()
  const topics = []
  const kw = {
    mama: ['mama', 'mamografia', 'birads', 'bi-rads', 'nódulo mamário', 'carcinoma mamário', 'axila', 'ca mama'],
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

async function extractAllText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push({ pageNum: i, text: '\n' + content.items.map(item => item.str).join('') + '\n' })
  }
  return pages
}

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

async function main() {
  console.log('🚀 CBR Questions + Images\n')
  let allQuestions = []

  for (const prova of PROVAS) {
    const pdfPath = path.join(CBR_BASE, prova.file)
    if (!fs.existsSync(pdfPath)) { console.log(`⚠️  Nao encontrado: ${prova.file}`); continue }
    if (prova.pattern === 'NONE') { continue }

    process.stdout.write(`📄 ${prova.specialty} ${prova.year}${prova.suffix}... `)
    try {
      const pages = await extractAllText(pdfPath)
      process.stdout.write(`${pages.length}p `)

      const { imagesByPage } = await extractPdfImages(pdfPath)
      const totalImgs = [...imagesByPage.values()].reduce((s, p) => s + p.length, 0)
      process.stdout.write(`(${totalImgs} imgs) `)

      const gabarito = prova.has_gabarito_pages ? extractGabarito(pages, prova.gabarito_pages) : {}
      if (Object.keys(gabarito).length) process.stdout.write(`(${Object.keys(gabarito).length} gab) `)

      const questions = parseAll(pages.map(p => p.text).join(''), prova.year, prova.specialty, prova.pattern)
      for (const q of questions) {
        if (gabarito[q.number]) q.correct_answer = gabarito[q.number]
      }
      const withAnswers = questions.filter(q => q.correct_answer).length

      const contentPages = prova.has_gabarito_pages ? pages.length - prova.gabarito_pages.length : pages.length
      const questionsPerPage = Math.max(1, Math.ceil(questions.length / contentPages))

      let imgCount = 0
      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi]
        let pageEstimate = Math.floor(qi / questionsPerPage) + 1
        if (prova.has_gabarito_pages) {
          const gabSet = new Set(prova.gabarito_pages)
          while (gabSet.has(pageEstimate) && pageEstimate <= pages.length) pageEstimate++
        }
        if (pageEstimate > pages.length) pageEstimate = pages.length

        const pageImgs = imagesByPage.get(pageEstimate)
        if (pageImgs && pageImgs.length > 0) {
          // Attach first image from this page
          q.has_image = true
          q.image_base64 = pageImgs[0]
          imgCount++
          if (pageImgs.length > 1) q.extra_images = pageImgs.slice(1)
        }
      }

      process.stdout.write(`✅ ${questions.length} Qs (${imgCount} c/img) (${withAnswers} c/resp)\n`)

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

      allQuestions.push(...questions)
    } catch (e) { process.stdout.write(`\n❌ ${e.message}\n`); console.error(e.stack) }
  }

  if (allQuestions.length) {
    // Use questions with images (same objects, now updated)
    fs.writeFileSync(path.join(__dirname, 'cbr_output', 'cbr_all_combined.json'), JSON.stringify(allQuestions.map(q => ({
      number: q.number, text: q.text, options: q.options,
      correct_answer: q.correct_answer, topic: q.topic, topics: q.topics,
      has_image: q.has_image, image_base64: q.image_base64 || null, explanation: q.explanation,
      specialty: q.specialty, difficulty: q.text.split(/\s+/).length < 20 ? 'básica' : q.text.split(/\s+/).length < 50 ? 'intermediária' : 'avançada',
    })), null, 2))
    console.log(`\n📊 Total: ${allQuestions.length} questoes\n💾 Feito!`)
  }
}

main().catch(console.error)
