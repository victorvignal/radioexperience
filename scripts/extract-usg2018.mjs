import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  // USG 2018 - answers are at the end of the prova, format "57A 58A"
  const pdfPath = CBR_BASE + '\\USG\\2018\\Prova-Teorico-Pratica-Maio-2018.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  let fullText = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map(it => it.str).join('') + '\n'
  }
  
  // Last page text
  const lastPage = await doc.getPage(doc.numPages)
  const lc = await lastPage.getTextContent()
  const lastText = lc.items.map(it => it.str).join('')
  console.log('Last page:', lastText.slice(-200))
  
  // Parse spaced answers: "57A 58A"
  const answers = {}
  const re = /(\d+)\s+([A-E])\b/g
  let m
  while ((m = re.exec(fullText)) !== null) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 200) answers[n] = m[2]
  }
  console.log('USG 2018 answers:', Object.keys(answers).sort((a,b)=>a-b).map(n=>n+answers[n]).join(' '))
  console.log('Count:', Object.keys(answers).length)
  
  // Extract questions using RDDI-style parser (split by "QUESTÃO N")
  const questions = []
  const parts = fullText.split(/(?=Questão\s*\d+)/i)
  
  for (const part of parts) {
    if (!part.trim()) continue
    const numMatch = part.match(/Questão\s*(\d+)/i)
    if (!numMatch) continue
    const qNum = parseInt(numMatch[1])
    if (qNum < 1 || qNum > 200) continue
    
    let body = part.replace(/Questão\s*\d+/i, '')
    
    // Split by options pattern
    const sections = body.split(/(?=[A-E]\)\s*)/)
    
    const questionText = (sections[0] || body).replace(/\s+/g, ' ').trim()
    const options = []
    
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim()
      if (!sec) continue
      const optMatch = sec.match(/^([A-E])\)\s*(.+)/s)
      if (optMatch) {
        options.push(optMatch[0].trim())
      }
    }
    
    if (questionText.length > 5 && options.length >= 2) {
      const answer = answers[qNum]
      questions.push({
        number: String(qNum),
        text: questionText,
        options,
        correct_answer: answer || null,
        difficulty: 'medium',
        explanation: '',
      })
    }
  }
  
  // Deduplicate
  const seen = new Set()
  const deduped = questions.filter(q => {
    if (seen.has(q.number)) return false
    seen.add(q.number)
    return true
  })
  
  console.log('USG 2018 questions extracted:', deduped.length)
  console.log('With answers:', deduped.filter(q => q.correct_answer).length)
  
  // Save
  const OUT = __dirname + '\\cbr_output'
  fs.writeFileSync(OUT + '\\extracted_USG_2018.json', JSON.stringify({ questions: deduped }, null, 2))
  console.log('Saved extracted_USG_2018.json')
}

main().catch(console.error)