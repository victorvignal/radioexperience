const fs = require('fs')
const { createRequire } = require('module')
const path = require('path')

const localRequire = createRequire(path.join(__dirname, 'debug-parse4.cjs'))
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
  
  // Using the actual code's approach
  const markerRegex = /(?:^|\n)(QUEST[AO]O\s*\d+)/gi
  const matches = [...fullText.matchAll(markerRegex)]
  
  const firstMatch = matches[0]
  const startPos = firstMatch.index
  const nextMatch = matches[1]
  const endPos = nextMatch ? nextMatch.index : fullText.length
  let block = fullText.slice(startPos, endPos).replace(/^\n/, '')
  
  console.log('Block starts:', JSON.stringify(block.substring(0, 80)))
  
  // Test the body replace
  let body1 = block.replace(/^[^Q]*QUEST[AO]O\s*\d+/i, '')
  console.log('Body after [^Q]* replace:', JSON.stringify(body1.substring(0, 80)))
  
  let body2 = block.replace(/^QUEST[AO]O\s*\d+/i, '')
  console.log('Body after simple replace:', JSON.stringify(body2.substring(0, 80)))
  
  // The issue: the block starts with "QUESTÃO 1O gráfico..." no space, no newline
  // [^Q]* means "match any char except Q" - but the block STARTS with Q
  // So [^Q]* matches empty string, then QUEST[AO]O\s*\d+ matches "QUESTÃO 1"
  // So body should be "O gráfico..."
  // But we're seeing "QUESTÃO 1" still...
  
  // Wait, the block itself - let me check if it starts with \n
  console.log('Block first 10 chars:', JSON.stringify(block.substring(0, 10)))
  console.log('Block char codes:', [...block.substring(0, 15)].map(c => c.charCodeAt(0)))
}

main().catch(console.error)
