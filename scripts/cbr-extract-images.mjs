/**
 * CBR Question Extractor with Image Support
 * Uses pdf-lib for image extraction + pdfjs-dist for text
 */
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createCanvas } from 'canvas'
import { PDFDocument, PDFName, PDFDict, PDFStream } from 'pdf-lib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const OUTPUT_DIR = join(__dirname, 'cbr_output')
const CBR_DIR = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

// ── Image extraction via pdf-lib ────────────────────────────────────────────
async function extractImagesFromPage(pageDict) {
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

      // Handle DCTDecode (JPEG)
      if (filter === 'DCTDecode') {
        mimeType = 'image/jpeg'
      }
      // Handle FlateDecode (raw RGB/CMYK) - convert to PNG via canvas
      else if (filter === 'FlateDecode' || !filter) {
        try {
          const canvas = createCanvas(width || 800, height || 600)
          const ctx = canvas.getContext('2d')
          const imgData = ctx.createImageData(width || 800, height || 600)
          // pdf-lib gives raw RGBA bytes
          imgData.data.set(Buffer.from(imageData.slice(0, imgData.data.length)))
          ctx.putImageData(imgData, 0, 0)
          imageData = canvas.toBuffer('image/png')
          mimeType = 'image/png'
        } catch (e) {
          console.warn('Canvas conversion failed:', e.message)
          continue
        }
      }
      // LZWDecode or other filters - skip
      else {
        console.warn(`Unsupported filter: ${filter}`)
        continue
      }

      const b64 = imageData.toString('base64')
      images.push({
        name: name.toString(),
        width,
        height,
        mimeType,
        base64: b64,
      })
    }
  } catch (e) {
    console.warn('Image extraction error:', e.message)
  }
  return images
}

// ── Text extraction via pdfjs-dist ──────────────────────────────────────────
async function extractTextFromPage(page) {
  try {
    const textContent = await page.getTextContent()
    return textContent.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

// ── Parse questions from text ───────────────────────────────────────────────
function parseQuestions(text, metadata) {
  const questions = []
  // Match question blocks - CBR format varies, try multiple patterns
  const blocks = text.split(/(?=\*\*QUESTÃO\s+\d+[:.]?)/i)
    .filter(b => /\d+[.)]\s*\(?[A-D]\)?/i.test(b))

  for (const block of blocks) {
    const numMatch = block.match(/\*\*QUESTÃO\s+(\d+)[:.]?\s*/i)
    if (!numMatch) continue

    const qNum = parseInt(numMatch[1])
    const rest = block.replace(/\*\*QUESTÃO\s+\d+[:.]?\s*/i, '')

    // Options: A), B), C), D)
    const optMatches = []
    const optIter = rest.matchAll(/(?:^|\n)([A-D])\)\s*([\s\S]*?)(?=\n[A-D]\)|\n\s*(?:QUESTÃO|Justificativa|Gabarito)|$)/gi)
    for (const m of optIter) {
      let content = m[2].replace(/\*\*/g, '').trim()
      content = content.replace(/\n+/g, ' ')
      optMatches.push({ letter: m[1].toUpperCase(), text: content })
    }

    if (optMatches.length < 4) continue

    // Try to find correct answer from text patterns
    let correct = ''
    const corrMatch = block.match(/Gabarito[:\s]*([A-D])/i)
    if (corrMatch) correct = corrMatch[1].toUpperCase()

    questions.push({
      number: qNum,
      text: rest.substring(0, 500).replace(/\n+/g, ' ').replace(/\*\*/g, '').trim(),
      options: optMatches.map(o => `${o.letter}) ${o.text}`),
      correct_answer: correct || null,
      topic: metadata.topic || 'geral',
      year: metadata.year,
      specialty: metadata.specialty,
      has_image: false,
      image_base64: null,
      explanation: null,
    })
  }
  return questions
}

// ── Extract from a PDF file ─────────────────────────────────────────────────
async function processPDF(filePath, metadata) {
  console.log(`\nProcessing: ${filePath}`)
  const buffer = readFileSync(filePath)
  const pdfDoc = await PDFDocument.load(buffer)
  const pages = pdfDoc.getPages()
  console.log(`  Total pages: ${pages.length}`)

  let allText = ''
  const pageImages = []

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    process.stdout.write(`  Page ${i + 1}/${pages.length}...`)

    // Extract text via pdfjs-dist
    try {
      const doc = await pdfjsLib.getDocument({ data: buffer, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
      const pdfPage = await doc.getPage(i + 1)
      const content = await pdfPage.getTextContent()
      allText += ' ' + ('\n' + content.items.map(item => item.str).join('') + '\n')
    } catch (e) {
      // Fallback: no text extraction
    }

    // Extract images via pdf-lib
    try {
      const pageDict = page.node
      const images = await extractImagesFromPage(pageDict)
      if (images.length > 0) {
        pageImages.push({ page: i + 1, images })
      }
    } catch (e) {}

    console.log(' done')
  }

  // If we got text, parse questions
  if (allText.trim().length > 100) {
    const questions = parseQuestions(allText, metadata)
    console.log(`  → ${questions.length} questions extracted from text`)
    return { questions, pageImages, allText: allText.trim() }
  }

  return { questions: [], pageImages, allText: allText.trim() }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const exams = [
  { path: join(CBR_DIR, 'RDDI', '2025', 'Prova-TP-com-Gabarito-2025.pdf'), specialty: 'RDDI', year: 2025, topic: 'rddi' },
  { path: join(CBR_DIR, 'RDDI', '2024', 'Prova-Teorica-Teorico-Pratica-2024-2.pdf'), specialty: 'RDDI', year: 2024, topic: 'rddi' },
  { path: join(CBR_DIR, 'USG', '2023', 'Prova-Teorica-TP-v1-2023.pdf'), specialty: 'USG', year: 2023, topic: 'usg' },
  { path: join(CBR_DIR, 'USG', '2025', 'Prova-TP-com-Gabarito-2025.pdf'), specialty: 'USG', year: 2025, topic: 'usg' },
]

let allQuestions = []
for (const exam of exams) {
  if (!existsSync(exam.path)) {
    console.log(`\nSkipping (not found): ${exam.path}`)
    continue
  }
  const { questions, pageImages } = await processPDF(exam.path, exam)

  // Attach images to questions by page proximity
  for (const q of questions) {
    // Find images from page near where question appears
    // (simple heuristic: distribute by question number)
  }

  allQuestions = allQuestions.concat(questions.map(q => ({
    ...q,
    topic: exam.topic,
    year: exam.year,
    specialty: exam.specialty,
  })))

  const outFile = join(OUTPUT_DIR, `cbr_${exam.topic.toLowerCase()}_${exam.year}_with_images.json`)
  writeFileSync(outFile, JSON.stringify({ specialty: exam.specialty, year: exam.year, questions, pageImages }, null, 2))
  console.log(`  → Saved ${questions.length} questions to ${outFile}`)
}

const combined = join(OUTPUT_DIR, 'cbr_all_combined.json')
writeFileSync(combined, JSON.stringify({ total: allQuestions.length, questions: allQuestions }, null, 2))
console.log(`\nTotal: ${allQuestions.length} questions saved to ${combined}`)
