const fs = require('fs')
const { createRequire } = require('module')
const path = require('path')

const localRequire = createRequire(path.join(__dirname, 'debug-parse3.cjs'))
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
  let body = block.replace(/^[^Q]*QUEST[AO]O\s*\d+/i, '')
  
  // Find where options are
  const firstOptIdx = body.search(/[A-E]\)\s*/)
  console.log('First option at char:', firstOptIdx)
  const beforeOpts = JSON.stringify(body.substring(0, firstOptIdx))
  console.log('Before options:', beforeOpts.substring(0, 200))
  
  // Check what comes after each option letter
  const optRegex = /([A-E])\)\s*/g
  let m
  while ((m = optRegex.exec(body)) !== null) {
    console.log(`Option ${m[1]} at ${m.index}: ${JSON.stringify(body.substring(m.index, m.index+60))}`)
  }
  
  // Try a different approach: find all A) B) C) D) E) positions
  const allOptPattern = /([A-E])\)\s*/g
  const positions = []
  while ((m = allOptPattern.exec(body)) !== null) {
    positions.push({ label: m[1], index: m.index })
  }
  console.log('\nOption positions:', positions)
  
  // Extract each option's text
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index + positions[i].label.length + 1
    const end = i < positions.length - 1 ? positions[i + 1].index : body.length
    let optText = body.slice(start, end).trim()
    // Remove trailing option marker if any
    optText = optText.replace(/\n[A-E]\)\s*$/, '').trim()
    console.log(`Option ${positions[i].label}: ${JSON.stringify(optText.substring(0, 60))}`)
  }
}

main().catch(console.error)
