/**
 * CBR Questions Extractor v3 — Fixed encoding + precise image-to-question mapping
 * Uses pdfjs-dist with proper CMap loading + text-search for image assignment
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, PDFName, PDFDict, PDFStream } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// CMap data for common Brazilian PDF encodings
const CMAPS = {
  'WinAnsiEncoding': 'Adobe-Ansi',
  'MacRomanEncoding': 'Adobe-Roman',
  'Identity-H': 'Identity-H',
}

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

// ── Global image for pdfjs canvas rendering ───────────────────────────────
// Must be set before pdfjs-dist is first loaded
try { Object.defineProperty(global, 'Image', { value: require('canvas').Image, configurable: true, writable: true }) } catch {}

const PROVAS = [
  { specialty: 'RDDI', year: 2025, file: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf', has_gabarito_pages: true, gabarito_pages: [65, 66], pattern: 'ID', suffix: '' },
  { specialty: 'RDDI', year: 2024, file: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf', has_gabarito_pages: true, gabarito_pages: [62], pattern: 'SIMPLE', suffix: '' },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf', has_gabarito_pages: false, pattern: 'USG', suffix: '_v1' },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v2-2023.pdf', has_gabarito_pages: false, pattern: 'USG', suffix: '_v2' },
]

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }

/**
 * Check if a text item looks like clean, readable text vs. raw glyph IDs.
 * Returns false if the item contains control characters, mixed ASCII corruption,
 * or other signs that it came from a font without proper Unicode mapping.
 */
function isCleanTextItem(text) {
  if (!text || text.length === 0) return true
  
  let hasControlChar = false
  let suspiciousCharCount = 0
  
  for (const char of text) {
    const cp = char.codePointAt(0)
    
    // Control characters (except tab, newline which are valid)
    if (cp < 0x0020 && cp !== 0x0009 && cp !== 0x000A && cp !== 0x000D) {
      hasControlChar = true
      break
    }
    
    // DEL and other problematic control range
    if (cp >= 0x007F && cp <= 0x009F) {
      hasControlChar = true
      break
    }
    
    // Suspicious: bytes > Latin-1 but not in valid extended range
    // Valid: Latin-1 Supplement (U+00A1-U+00FF) which includes Portuguese chars
    if (cp > 0x00FF && cp < 0x0100) {
      suspiciousCharCount++
    }
    
    // Very suspicious: high surrogates, low surrogates, private use, etc.
    if (cp >= 0xD800 || (cp >= 0xE000 && cp <= 0xF8FF)) {
      hasControlChar = true
      break
    }
  }
  
  if (hasControlChar) return false
  
  // If too many suspicious chars (> 30% of string), likely corrupted
  if (text.length > 3 && suspiciousCharCount / text.length > 0.3) {
    return false
  }
  
  return true
}

/**
 * Extract text using pdfjs with maximum compatibility for Brazilian fonts.
 * Filters out corrupted text items that come from fonts without Unicode mapping.
 */
async function extractAllText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
  
  const doc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalEnabled: false,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise

  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent({
      includeAnnotationContent: false,
      disableCombineTextItems: false,
    })
    
    // Join text items with proper spacing, filtering corrupted items
    let pageText = ''
    let lastY = null
    let lastX = null
    
    for (const item of content.items) {
      if ('str' in item) {
        const text = item.str
        
        // Skip text items that look like raw glyph IDs (corrupted)
        if (!isCleanTextItem(text)) {
          console.log(`  [WARN] Skipping corrupted text item on page ${i}: "${text.substring(0, 40)}"`)
          continue
        }
        
        // Check if this is a new line (different Y position)
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n'
          lastX = null
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

/**
 * Minimal cleanup for extracted text.
 * Corrupted text items are now filtered out in extractAllText,
 * so this only removes residual control characters and normalizes whitespace.
 */
function fixEncoding(text) {
  if (!text) return ''
  
  let result = text
  
  // Remove control characters except newline/tab/carriage return
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
  
  // Clean up multiple spaces/newlines
  result = result.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ')
  
  return result.trim()
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
    
    // Clean and fix encoding on question text
    let questionText = (sections[0] || body).replace(/\s+/g, ' ').trim()
    questionText = fixEncoding(questionText)
    questionText = questionText.replace(/^[\d]+\s*/, '').replace(/\s*page\s*\d+\s*$/gi, '')
    // Remove trailing bare question numbers (e.g. "E) Option text.4" -> "E) Option text")
    questionText = questionText.replace(/\s*\.(\d+)$/, '')
    
    // Remove page numbers at end of options (e.g. " 4" or " 56")
    const options = []
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      const m = sec.match(optRe)
      if (m) {
        let txt = m[1] === '-' ? sec.replace(/^[A-E]\s*-\s*/, '') : sec.replace(/^[A-E]\)\s*/, '')
        txt = fixEncoding(txt)
        txt = txt.replace(/\s+\d+$/g, '').replace(/\s*page\s*\d+\s*$/gi, '').trim()
        if (txt.length > 1) options.push(`${m[1]}) ${txt}`)
      }
    }
    if (options.length < 2) continue
    
    const topics = identifyTopics(questionText)
    questions.push({ 
      number: qNum, 
      text: questionText.slice(0, 800), 
      options, 
      correct_answer: null, 
      has_image: false, 
      image_base64: null, 
      explanation: null, 
      topic: topics[0] || 'geral', 
      topics, 
      year, 
      specialty 
    })
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

// Extract JPEG images from a raw pdf-lib page node (handles PDFArray filters)
async function extractPageImagesFromRaw(rawPage, pdfDoc) {
  const images = []
  try {
    let resources
    try { resources = rawPage.get(PDFName.of('Resources')) } catch {}
    if (!resources) {
      try { resources = rawPage.lookup(PDFName.of('Resources')) } catch {}
    }
    if (!resources) return images
    
    let xObject
    try { xObject = resources.get(PDFName.of('XObject')) } catch {}
    if (!xObject) {
      try { xObject = resources.lookup(PDFName.of('XObject')) } catch {}
    }
    if (!xObject) return images
    
    for (const [, ref] of xObject.entries()) {
      try {
        const stream = xObject.context.lookup(ref)
        if (!stream) continue
        const dict = stream.dict || stream
        
        let subtype
        try { subtype = dict.lookup(PDFName.of('Subtype')) } catch {}
        if (!subtype) { try { subtype = dict.get(PDFName.of('Subtype')) } catch {} }
        if (!subtype || subtype.toString() !== '/Image') continue
        
        // Get raw bytes
        let rawBytes = null
        if (typeof stream.getContents === 'function') {
          const c = stream.getContents()
          rawBytes = (c instanceof Uint8Array || c instanceof Buffer) ? c : Buffer.from(c)
        } else if (typeof stream.asUint8Array === 'function') {
          rawBytes = stream.asUint8Array()
        }
        if (!rawBytes || rawBytes.length === 0) continue
        
        // Get filter — handle PDFArray (multiple filters like [/FlateDecode /DCTDecode])
        let filterStr = 'none'
        try { filterStr = dict.lookup(PDFName.of('Filter'))?.toString() } catch {}
        if (filterStr === 'none') { try { filterStr = dict.get(PDFName.of('Filter'))?.toString() } catch {} }
        
        // Pure JPEG direct
        if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
          images.push(Buffer.from(rawBytes).toString('base64'))
          continue
        }
        
        // Filter chain: [/FlateDecode /DCTDecode] — decompress, then raw JPEG emerges
        if (filterStr.includes('/FlateDecode') && rawBytes[0] === 0x78) {
          try {
            const decompressed = require('zlib').inflateSync(Buffer.from(rawBytes))
            if (decompressed[0] === 0xFF && decompressed[1] === 0xD8) {
              images.push(Buffer.from(decompressed).toString('base64'))
              continue
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return images
}

/**
 * Find which page each question appears on by searching question text
 */
function findQuestionPages(pages, questions) {
  const pageMap = {} // questionNumber -> pageNumber (1-indexed)
  
  for (const q of questions) {
    // Try to find exact "Questão N" in page text
    const searchTerms = [
      `Questão ${q.number} `,
      `Questão ${q.number}.`,
      `Questão ${q.number}ID:`,
      `Questão ${q.number}-`,
      `QUESTÃO ${q.number}`,
      `QUESTÃO ${q.number} `,
    ]
    
    let foundPage = null
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const pageText = pages[pIdx].text
      for (const term of searchTerms) {
        if (pageText.includes(term)) {
          foundPage = pIdx + 1
          break
        }
      }
      if (foundPage) break
    }
    
    // Fallback: estimate based on document structure (rough guess)
    if (!foundPage) {
      foundPage = Math.ceil(q.number / 2)
    }
    
    pageMap[q.number] = foundPage
  }
  
  return pageMap
}

/**
 * Group questions by their page number
 */
function groupQuestionsByPage(questions, questionPageMap) {
  const pageGroups = {} // pageNum -> [questionObjects]
  for (const q of questions) {
    const page = questionPageMap[q.number] || Math.ceil(q.number / 2)
    if (!pageGroups[page]) pageGroups[page] = []
    pageGroups[page].push(q)
  }
  return pageGroups
}

/**
 * Smart image-to-question assignment:
 * - Only questions that explicitly mention "imagem" get images
 * - If multiple questions on same page, distribute images in order
 * - If 1 image and 1 question that needs image -> direct assignment
 * - If 1 image and multiple questions that need image -> assign to first
 * - If 2+ images and 2+ questions -> round-robin
 */
function assignImagesToQuestions(pageImgMap, pageGroups) {
  for (const [pageNum, pageQuestions] of Object.entries(pageGroups)) {
    const pageImgKey = parseInt(pageNum)
    const imagesOnPage = pageImgMap[pageNum] || []
    const questionsNeedingImages = pageQuestions.filter(q => 
      q.text.includes('imagem') || q.text.includes('figura') || 
      q.text.includes('raio-x') || q.text.includes(' raio x') ||
      q.text.includes('rx ') || q.text.includes(' RX') ||
      q.text.includes('observe') || q.text.includes('analise'))
    
    if (questionsNeedingImages.length === 0) continue
    if (imagesOnPage.length === 0) {
      // Mark questions that need images but none available
      for (const q of questionsNeedingImages) {
        q.needs_image = true
      }
      continue
    }
    
    // Assign images round-robin
    for (let i = 0; i < questionsNeedingImages.length; i++) {
      const imgIdx = i % imagesOnPage.length
      questionsNeedingImages[i].has_image = true
      questionsNeedingImages[i].image_base64 = imagesOnPage[imgIdx]
    }
  }
}

async function main() {
  console.log('🚀 CBR Questions + Images Extractor v3\n')
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
      const { doc, pages } = await extractAllText(pdfPath)
      process.stdout.write(`${doc.numPages}p `)

      // Apply encoding fixes to all pages
      for (let i = 0; i < pages.length; i++) {
        pages[i].text = fixEncoding(pages[i].text)
      }

      // Extract gabarito
      const gabarito = prova.has_gabarito_pages ? extractGabarito(pages, prova.gabarito_pages) : {}
      if (Object.keys(gabarito).length) process.stdout.write(`(${Object.keys(gabarito).length} gab) `)

      // Extract embedded images via pdf-lib (works for PDFs with XObject images like RDDI 2025)
      // For scanned PDFs (RDDI 2024, USG 2023) with no XObjects, images will be skipped
      const pageImages = []
      for (let i = 1; i <= doc.numPages; i++) {
        try {
          const rawPage = doc.getPage(i)
          const imgs = await extractPageImagesFromRaw(rawPage, doc)
          if (imgs.length > 0) {
            pageImages.push({ page: i, base64: imgs[0] }) // use first image per page
          }
        } catch {}
      }
      process.stdout.write(`(${pageImages.length} embedded imgs) `)

      // Parse questions
      const questions = parseAll(pages.map(p => p.text).join(''), prova.year, prova.specialty, prova.pattern)
      let withAnswers = 0
      for (const q of questions) {
        if (gabarito[q.number]) { q.correct_answer = gabarito[q.number]; withAnswers++ }
      }

      // Precise image-to-question mapping using text search
      const questionPageMap = findQuestionPages(pages, questions)
      const pageImgMap = {}
      for (const img of pageImages) {
        if (!pageImgMap[img.page]) pageImgMap[img.page] = []
        pageImgMap[img.page].push(img.base64)
      }
      const pageGroups = groupQuestionsByPage(questions, questionPageMap)
      assignImagesToQuestions(pageImgMap, pageGroups)

      process.stdout.write(`✅ ${questions.length} Qs`)
      if (withAnswers) process.stdout.write(` (${withAnswers} c/resp)`)
      
      // Count images assigned
      const withImg = questions.filter(q => q.has_image).length
      const needImg = questions.filter(q => q.needs_image).length
      if (withImg > 0) process.stdout.write(` [${withImg} imgs]`)
      if (needImg > 0) process.stdout.write(` [${needImg} need img]`)
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
            image_base64: q.image_base64 || null,
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
  const withImg = allQuestions.filter(q => q.has_image).length
  const needImg = allQuestions.filter(q => q.needs_image).length
  console.log(`   Com imagem: ${withImg}`)
  console.log(`   Precisa imagem: ${needImg}`)
  
  if (allQuestions.length) {
    fs.writeFileSync(path.join(outDir, 'cbr_all_combined.json'), JSON.stringify(allQuestions, null, 2))
    for (const sp of [...new Set(allQuestions.map(q => q.specialty))]) {
      fs.writeFileSync(path.join(outDir, `cbr_${sp.toLowerCase()}_combined.json`), JSON.stringify(allQuestions.filter(q => q.specialty === sp), null, 2))
    }
    console.log(`💾 Salvo em scripts/cbr_output/`)
  }
  console.log(`\n✅ Feito!`)
}

main().catch(console.error)