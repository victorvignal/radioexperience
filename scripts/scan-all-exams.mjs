import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = __dirname + '\\cbr_output'

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    text += '\n' + (await page.getTextContent()).items.map(item => item.str).join(' ')
  }
  return text
}

// Try to find and parse the gabarito in any PDF
async function findGabarito(pdfPath) {
  const text = await extractTextFromPDF(pdfPath)
  
  // Look for patterns that indicate answers
  // Pattern 1: "Questão Gabarito 1 B 2 C 3 A..."
  const qgMatch = text.match(/Questão\s*Gabarito\s*([\s\S]+)/)
  if (qgMatch) {
    const raw = qgMatch[1].replace(/\s+/g, ' ').trim()
    const answers = {}
    const re = /(\d+)\s+([A-E])/g
    let m
    while ((m = re.exec(raw)) !== null) {
      const n = parseInt(m[1])
      if (n >= 1 && n <= 300) answers[n] = m[2]
    }
    if (Object.keys(answers).length >= 10) return { format: 'Questão Gabarito', answers }
  }
  
  // Pattern 2: dense number+letter "1A2B3C..."
  const denseMatches = []
  const re1 = /(\d{1,3})([A-E])(?=\d|$)/g
  let m
  while ((m = re1.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) denseMatches.push({ n, a: m[2] })
  }
  // Check for reasonable answer distribution
  if (denseMatches.length >= 30) {
    const answers = {}
    for (const { n, a } of denseMatches) answers[n] = a
    return { format: 'dense', answers }
  }
  
  // Pattern 3: spaced "1 A 2 B" 
  const spacedRe = /(\d+)\s+([A-E])\b/g
  const spacedMatches = []
  while ((m = spacedRe.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) spacedMatches.push({ n, a: m[2] })
  }
  if (spacedMatches.length >= 30) {
    const answers = {}
    for (const { n, a } of spacedMatches) answers[n] = a
    return { format: 'spaced', answers }
  }
  
  return { format: 'none', answers: {} }
}

// Extract questions from a prova PDF
async function extractQuestionsFromProva(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  const questions = []
  
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join(' ')
    
    // Try to find question pattern "QUESTÃO N" or "Questão N" or "N."
    // Each question typically starts with a number
    const lines = text.split(/\s{2,}/).filter(l => l.trim().length > 10)
    
    for (const line of lines) {
      // Try to extract question number
      const questMatch = line.match(/^(?:QUESTÃO|Questão|Q\.?)\s*(\d+)/i) || line.match(/^(\d+)\s*\./)
      if (questMatch) {
        const qNum = parseInt(questMatch[1])
        if (qNum >= 1 && qNum <= 300) {
          // Get options (A), (B), (C), (D), (E) patterns
          const options = []
          const optMatches = line.matchAll(/([A-E])\s*[\.\)]\s*(.+?)(?=[A-E]\s*[\.\)]|$)/gi)
          for (const opt of optMatches) {
            options.push(opt[0].trim())
          }
          
          if (options.length >= 2) {
            questions.push({
              number: String(qNum),
              text: line.replace(/\s+/g, ' ').slice(0, 500),
              options: options.slice(0, 5),
              has_image: false,
              image_base64: null,
            })
          }
        }
      }
    }
  }
  
  // Deduplicate by number
  const seen = new Set()
  const deduped = []
  for (const q of questions) {
    if (!seen.has(q.number)) {
      seen.add(q.number)
      deduped.push(q)
    }
  }
  
  return deduped.sort((a, b) => parseInt(a.number) - parseInt(b.number))
}

async function main() {
  console.log('=== Scanning all CBR exams ===\n')
  
  const exams = [
    // RDDI exams
    { name: 'RDDI 2018', prova: 'RDDI/2018/Prova-Anual-2018.pdf', gab: null },
    { name: 'RDDI 2019 Prova', prova: 'RDDI/2019/Prova-A-Avaliacao-Anual-2019.pdf', gab: 'RDDI/2019/Gabarito-Avaliacao-Anual-2019.pdf' },
    { name: 'RDDI 2019 TP', prova: null, gab: 'RDDI/2019/Gabarito-Prova-Titulo-2019.pdf' },
    { name: 'RDDI 2020', prova: 'RDDI/2020/Prova-Anual-2020.pdf', gab: 'RDDI/2020/Gabarito-2020-v2.pdf' },
    { name: 'RDDI 2021', prova: 'RDDI/2021/Prova-Anual-R3-2021.pdf', gab: null },
    { name: 'RDDI 2023 TP', prova: 'RDDI/2023/Prova-Teorico-Pratica-v3-2023.pdf', gab: 'RDDI/2023/Gabarito-Teorico-Pratica-2023.pdf' },
    { name: 'RDDI 2023 Geral', prova: null, gab: 'RDDI/2023/Gabarito-Geral-2023.pdf' },
    { name: 'RDDI 2024', prova: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf', gab: null },
    { name: 'RDDI 2025', prova: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf', gab: null },
    // USG exams
    { name: 'USG 2018', prova: 'USG/2018/Prova-Teorico-Pratica-Maio-2018.pdf', gab: null },
    { name: 'USG 2019', prova: 'USG/2019/Prova-Anual-2019.pdf', gab: null },
    { name: 'USG 2020', prova: 'USG/2020/Prova-Teorica-Teorico-Pratica-2020.pdf', gab: null },
    { name: 'USG 2022', prova: null, gab: 'USG/2022/Gabarito-Ginecologia-Obstetricia-2022.pdf' },
    { name: 'USG 2025', prova: null, gab: 'USG/2025/Gabarito-Prova-USG-2025.pdf' },
  ]
  
  for (const exam of exams) {
    console.log(`\n=== ${exam.name} ===`)
    
    if (exam.gab) {
      const gabPath = CBR_BASE + '\\' + exam.gab.replace('/', '\\')
      if (!fs.existsSync(gabPath)) {
        console.log('  Gab MISSING')
      } else {
        const result = await findGabarito(gabPath)
        console.log(`  Gab format: ${result.format} | answers: ${Object.keys(result.answers).length}`)
        if (Object.keys(result.answers).length > 0) {
          const sample = Object.keys(result.answers).map(Number).sort((a,b)=>a-b).slice(0,10).map(n=>n+result.answers[n]).join(' ')
          console.log(`  Sample: ${sample}`)
        }
      }
    }
    
    if (exam.prova) {
      const provaPath = CBR_BASE + '\\' + exam.prova.replace('/', '\\')
      if (!fs.existsSync(provaPath)) {
        console.log('  Prova MISSING')
      } else {
        console.log(`  Prova: ${fs.statSync(provaPath).size / 1024 / 1024} MB`)
      }
    }
  }
  
  console.log('\n\n=== Checking JSON coverage ===')
  const jsonFiles = fs.readdirSync(OUT).filter(f => f.endsWith('.json') && f.startsWith('cbr_'))
  for (const f of jsonFiles) {
    const d = JSON.parse(fs.readFileSync(OUT + '\\' + f, 'utf8'))
    const q = d.questions || []
    const nums = [...new Set(q.map(x => parseInt(x.number)).filter(n => !isNaN(n)))]
    const min = Math.min(...nums), max = Math.max(...nums)
    console.log(`${f}: ${q.length} Qs (${nums.length} unique, range ${min}-${max})`)
  }
}

main().catch(console.error)