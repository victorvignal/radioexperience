import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    text += '\n' + (await page.getTextContent()).items.map(i => i.str).join(' ')
  }
  return text
}

function parseDenseGabarito(text) {
  const answers = {}
  const re = /(\d{1,3})\s+([A-E])\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 300) answers[n] = m[2]
  }
  return answers
}

async function main() {
  const exams = [
    { name: 'RDDI 2018', provaPath: 'RDDI/2018/Prova-Anual-2018.pdf', gabPath: null, expected: 52 },
    { name: 'RDDI 2019', provaPath: 'RDDI/2019/Prova-A-Avaliacao-Anual-2019.pdf', gabPath: 'RDDI/2019/Gabarito-Avaliacao-Anual-2019.pdf', expected: 70 },
    { name: 'RDDI 2020', provaPath: 'RDDI/2020/Prova-Anual-2020.pdf', gabPath: 'RDDI/2020/Gabarito-2020-v2.pdf', expected: 50 },
    { name: 'RDDI 2021', provaPath: 'RDDI/2021/Prova-Anual-R3-2021.pdf', gabPath: null, expected: 49 },
    { name: 'RDDI 2022', provaPath: null, gabPath: null, expected: 0 },
    { name: 'RDDI 2023 TP', provaPath: 'RDDI/2023/Prova-Teorico-Pratica-v3-2023.pdf', gabPath: 'RDDI/2023/Gabarito-Teorico-Pratica-2023.pdf', expected: 60 },
    { name: 'RDDI 2024', provaPath: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf', gabPath: null, expected: 60 },
    { name: 'RDDI 2025', provaPath: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf', gabPath: null, expected: 60 },
    { name: 'USG 2018', provaPath: 'USG/2018/Prova-Teorico-Pratica-Maio-2018.pdf', gabPath: null, expected: null },
    { name: 'USG 2019', provaPath: 'USG/2019/Prova-Anual-2019.pdf', gabPath: 'RDDI/2019/Gabarito-Teorico-Pratica-2019.pdf', expected: 50 },
    { name: 'USG 2020', provaPath: 'USG/2020/Prova-Teorica-Teorico-Pratica-2020.pdf', gabPath: null, expected: 50 },
    { name: 'USG 2022', provaPath: null, gabPath: 'USG/2022/Gabarito-Ginecologia-Obstetricia-2022.pdf', expected: 30 },
    { name: 'USG 2023 V1', provaPath: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf', gabPath: 'USG/2023/Gabarito-USG-Geral-maio-2023.pdf', expected: 50 },
    { name: 'USG 2023 V2', provaPath: 'USG/2023/Prova-Teorica-TP-v2-2023.pdf', gabPath: 'USG/2023/Gabarito-USG-Geral-junho-2023.pdf', expected: 50 },
    { name: 'USG 2025', provaPath: null, gabPath: 'USG/2025/Gabarito-Prova-USG-2025.pdf', expected: null },
  ]

  for (const exam of exams) {
    console.log(`\n=== ${exam.name} (expect ~${exam.expected} Qs) ===`)
    
    if (exam.gabPath) {
      const fp = CBR_BASE + '\\' + exam.gabPath.replace('/', '\\')
      if (!fs.existsSync(fp)) { console.log('  Gab MISSING'); exam.gabPath = null }
      else {
        const text = await extractTextFromPDF(fp)
        const gab = parseDenseGabarito(text)
        const nums = Object.keys(gab).map(Number).sort((a,b)=>a-b)
        const sample = nums.slice(0,15).map(n=>`${n}${gab[n]}`).join(' ')
        console.log(`  Gab: ${Object.keys(gab).length} answers | sample: ${sample}`)
        exam.gabAnswers = gab
      }
    }
    
    if (exam.provaPath) {
      const fp = CBR_BASE + '\\' + exam.provaPath.replace('/', '\\')
      if (!fs.existsSync(fp)) { console.log('  Prova MISSING'); exam.provaPath = null }
      else {
        const text = await extractTextFromPDF(fp)
        const firstLine = text.split('\n').filter(l=>l.trim().length>0)[0] || ''
        const questMatches = text.match(/QUESTÃO\s*(\d+)/gi) || []
        const lastQ = questMatches.length > 0 ? questMatches[questMatches.length-1] : '?'
        console.log(`  Prova: first="${firstLine.slice(0,60)}" | ~${questMatches.length} Q markers | ends=${text.slice(-100).trim().replace(/\s+/g,' ').slice(0,60)}`)
        exam.provaText = text
      }
    }
  }
}

main().catch(console.error)