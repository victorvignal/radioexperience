import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const data = new Uint8Array(fs.readFileSync('C:/Users/vigna/OneDrive/Documentos/Provas CBR/RDDI/2020/Prova-Anual-2020.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const pagesInfo = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join('')
    pagesInfo.push({ pageNum: i, text: pageText })
  }
  const fullText = pagesInfo.map(p => '\n' + p.text).join('')
  
  const idx = fullText.indexOf('QUESTÃO 1')
  const nextIdx = fullText.indexOf('QUESTÃO 2')
  const block = fullText.slice(idx, nextIdx)
  
  let body = block.replace(/^Questão\s*\d+[^\n]*\n?/i, '').replace(/^QUESTÃO\s*\d+[^\n]*\n?/i, '')
  
  console.log('Body starts with:', JSON.stringify(body.substring(0, 100)))
  
  // Try option extraction
  const optMatches = [...body.matchAll(/([A-E])\s*[)\-–]\s*(.+?)(?=(?:[A-E]\s*[)\-–])|$)/gs)]
  console.log('Option matches found:', optMatches.length)
  for (const m of optMatches) {
    console.log('  Label:', m[1], '| Text preview:', m[2].substring(0, 60))
  }
  
  if (optMatches.length > 0) {
    // Question text = body without options
    let questionText = body
    for (const m of optMatches) {
      const label = m[1]
      const optStr = label + ') ' + m[2].substring(0, 20)
      questionText = questionText.replace(optStr, ' [OPTTEMP] ')
    }
    questionText = questionText.replace(/\[OPTTEMP\]/g, '').replace(/\s+/g, ' ').trim()
    questionText = questionText.replace(/^[A-E]\s*[)\-–]\s*/gm, '').trim()
    console.log('\nFinal Q text:', questionText.substring(0, 200))
  }
}

main().catch(console.error)
