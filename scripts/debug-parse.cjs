const fs = require('fs')
const { createRequire } = require('module')
const path = require('path')

const localRequire = createRequire(path.join(__dirname, 'debug-parse.cjs'))
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
  const fullText = pagesInfo.map(p => '\n' + p.text).join('')
  
  const idx = fullText.indexOf('QUESTÃO 1')
  const nextIdx = fullText.indexOf('QUESTÃO 2')
  const block = fullText.slice(idx, nextIdx)
  
  console.log('Block starts:', JSON.stringify(block.substring(0, 80)))
  
  // Try to strip QUESTAO prefix more aggressively
  let body = block.replace(/^[^Q]*QUESTÃO\s*\d+/i, '').replace(/^[^Q]*QUESTAO\s*\d+/i, '')
  console.log('After aggressive replace:', JSON.stringify(body.substring(0, 80)))
  
  // Try option extraction with simpler regex
  const optMatches1 = [...body.matchAll(/([A-E])\)\s*(.+?)(?=[A-E]\)|$)/gs)]
  console.log('Option matches (simple):', optMatches1.length)
  
  const optMatches2 = [...body.matchAll(/(?:^|\n)([A-E])\s*[-)]\s*(.+?)(?=(?:[A-E]\s*[-)])|$)/gm)]
  console.log('Option matches (multiline):', optMatches2.length)
  
  // Just show the last part of body
  console.log('Last 200 of body:', JSON.stringify(body.slice(-200)))
}

main().catch(console.error)
