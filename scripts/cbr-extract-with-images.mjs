/**
 * CBR Questions Extractor — with images via pdf-lib + pdfjs text
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas } from 'canvas'
import { PDFDocument, PDFName, PDFDict, PDFStream } from 'pdf-lib'

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

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }

async function extractAllText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push({ pageNum: i, text: '\n' + content.items.map(item => item.str).join('') + '\n' })
  }
  return { doc, pages }
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
    questions.push({ number: qNum, text: questionText.slice(0, 800), options, correct_answer: null, has_image: false, image_base64: null, explanation: null, topic: topics[0] || 'geral', topics, year, specialty })
  }
  return questions
}

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

// ── Image extraction via pdf-lib ────────────────────────────────────────────
async function extractPageImages(pageDict, pageNum, canvas) {
  const images = []
  try {
    const resources = pageDict.lookup(PDFName.of('Resources'))
    if (!resources || !(resources instanceof PDFDict)) return images
    const xObject = resources.lookup(PDFName.of('XObject'))
    if (!xObject || !(xObject instanceof PDFDict)) return images
    for (const [name, ref] of xObject.entries()) {
      const stream = xObject.context.lookup(ref)
      if (!(stream instanceof PDFStream)) continue
      const subtype = stream.dict.lookup(PDFName.of('Subtype'))
      if (!subtype || subtype.asString()?.toString() !== 'Image') continue
      const width = stream.dict.lookup(PDFName.of('Width'))?.asNumber()
      const height = stream.dict.lookup(PDFName.of('Height'))?.asNumber()
      const filter = stream.dict.lookup(PDFName.of('Filter'))?.asString()?.toString()
      let imageData = stream.readBytes()
      let mimeType = 'image/jpeg'
      if (filter === 'DCTDecode') {
        mimeType = 'image/jpeg'
      } else if (filter === 'FlateDecode' || !filter) {
        try {
          const w = width || 800, h = height || 600
          const c = createCanvas(w, h)
          const ctx = c.getContext('2d')
          const imgData = ctx.createImageData(w, h)
          imgData.data.set(imageData)
          ctx.putImageData(imgData, 0, 0)
          imageData = Buffer.from(c.toDataURL('image/png').split(',')[1], 'base64')
          mimeType = 'image/png'
        } catch { continue }
      }
      const base64 = imageData.toString('base64')
      if (base64.length > 1000) images.push({ page: pageNum, base64, mimeType })
    }
  } catch (e) {}
  return images
}

async function main() {
  console.log('🚀 CBR Questions + Images Extractor\n')
  const outDir = path.join(__dirname, 'cbr_output')
  ensureDir(outDir)
  let allQuestions = []

  for (const prova of PROVAS) {
    const pdfPath = path.join(CBR_BASE, prova.file)
    if (!fs.existsSync(pdfPath)) { console.log(`⚠️  Nao encontrado: ${prova.file}`); continue }
    if (prova.pattern === 'NONE') { console.log(`⏭️  ${prova.specialty} ${prova.year}: formato nao suportado`); continue }

    process.stdout.write(`📄 ${prova.specialty} ${prova.year}${prova.suffix}... `)
    try {
      const buffer = fs.readFileSync(pdfPath)
      const data = new Uint8Array(buffer)
      const { doc, pages } = await extractAllText(pdfPath)
      process.stdout.write(`${doc.numPages}p `)

      // Extract gabarito
      const gabarito = prova.has_gabarito_pages ? extractGabarito(pages, prova.gabarito_pages) : {}
      if (Object.keys(gabarito).length) process.stdout.write(`(${Object.keys(gabarito).length} gab) `)

      // Extract images via pdf-lib
      const pdfDoc = await PDFDocument.load(buffer)
      const pageImages = []
      for (let i = 0; i < pdfDoc.getPages().length; i++) {
        const pageDict = pdfDoc.getPages()[i].node
        const imgs = await extractPageImages(pageDict, i + 1)
        if (imgs.length) pageImages.push(...imgs)
      }
      process.stdout.write(`(${pageImages.length} imgs) `)

      // Parse questions
      const questions = parseAll(pages.map(p => p.text).join(''), prova.year, prova.specialty, prova.pattern)
      let withAnswers = 0
      for (const q of questions) {
        if (gabarito[q.number]) { q.correct_answer = gabarito[q.number]; withAnswers++ }
      }

      // Simple image assignment: distribute images across questions by page
      // Find which page each question appears on
      const pageImgMap = {}
      for (const img of pageImages) {
        if (!pageImgMap[img.page]) pageImgMap[img.page] = []
        pageImgMap[img.page].push(img.base64)
      }

      for (const q of questions) {
        // Estimate page: questions are spread across doc pages, try to find by text proximity
        // Just attach first available image from page near question number
        const qPageEstimate = Math.ceil(q.number / 2)
        if (pageImgMap[qPageEstimate] && pageImgMap[qPageEstimate].length > 0) {
          q.has_image = true
          q.image_base64 = pageImgMap[qPageEstimate].shift()
        }
      }

      process.stdout.write(`✅ ${questions.length} Qs`)
      if (withAnswers) process.stdout.write(` (${withAnswers} c/resp)`)
      process.stdout.write('\n')

      if (questions.length) {
        const output = {
          specialty: prova.specialty, year: prova.year, suffix: prova.suffix,
          source: `Provas CBR ${prova.year}${prova.suffix}`,
          total_questions: questions.length,
          questions: questions.map(q => ({
            number: q.number, text: q.text, options: q.options,
            correct_answer: q.correct_answer, topic: q.topic, topics: q.topics,
            has_image: q.has_image, explanation: q.explanation,
            difficulty: q.text.split(/\s+/).length < 20 ? 'básica' : q.text.split(/\s+/).length < 50 ? 'intermediária' : 'avançada',
          })),
        }
        const outFile = path.join(outDir, `cbr_${prova.specialty.toLowerCase()}_${prova.year}${prova.suffix}_with_images.json`)
        fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8')
        allQuestions.push(...questions.map(q => ({ ...q, specialty: prova.specialty })))
      }
    } catch (e) { process.stdout.write(`❌ ${e.message}\n`); console.error(e) }
  }

  console.log(`\n📊 Total: ${allQuestions.length} questoes`)
  if (allQuestions.length) {
    fs.writeFileSync(path.join(outDir, 'cbr_all_combined.json'), JSON.stringify(allQuestions, null, 2))
    for (const sp of [...new Set(allQuestions.map(q => q.specialty))]) {
      fs.writeFileSync(path.join(outDir, `cbr_${sp.toLowerCase()}_combined.json`), JSON.stringify(allQuestions.filter(q => q.specialty === sp), null, 2))
    }
    console.log(`💾 Salvo em scripts/cbr_output/\n✅ Feito!`)
  }
}

main().catch(console.error)
