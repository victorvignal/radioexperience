const fs = require('fs')
const { createRequire } = require('module')
const path = require('path')

const localRequire = createRequire(path.join(__dirname, 'debug-parse2.cjs'))
const pdfjsLib = localRequire('pdfjs-dist/legacy/build/pdf.mjs')

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
  
  let fullText = ''
  for (const p of pagesInfo) fullText += '\n' + p.text
  
  const idx = fullText.indexOf('QUESTÃO 1')
  const nextIdx = fullText.indexOf('QUESTÃO 2')
  const block = fullText.slice(idx, nextIdx).replace(/^\n/, '')
  
  // Strip prefix
  let body = block.replace(/^[^Q]*QUEST[AO]O\s*\d+/i, '')
  console.log('Body starts:', JSON.stringify(body.substring(0, 80)))
  
  // Try both option patterns
  const simple = /([A-E])\)\s*(.+?)(?=[A-E]\)|$)/gs
  const simpleMatches = [...body.matchAll(simple)]
  console.log('Simple regex matches:', simpleMatches.length)
  
  // Test my new pattern
  const newPat = /([A-E])\s*[)\-]\s*([^\n](?:(?!^[A-E]\s*[)\-])[^\n])*)/gsm
  const newMatches = [...body.matchAll(newPat)]
  console.log('New regex matches:', newMatches.length)
  for (const m of newMatches) {
    console.log('  Label:', m[1], '| Text:', JSON.stringify(m[2].substring(0, 50)))
  }
}

main().catch(console.error)
