import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  const pdfPath = CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  // Build full text EXACTLY like the original function does
  let fullText = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    fullText += '\n' + pageText
  }
  
  console.log('Full text length:', fullText.length)
  console.log('indexOf "Questão Gabarito":', fullText.indexOf('Questão Gabarito'))
  console.log('indexOf "Gabarito1":', fullText.indexOf('Gabarito1'))
  
  // Check what's around page 62
  // Find position of page 62 start by scanning
  let pos = 0
  let pageStartPositions = []
  for (let i = 1; i <= doc.numPages; i++) {
    pageStartPositions.push(pos)
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    pos += '\n'.length + pageText.length
  }
  console.log('Page 62 start position:', pageStartPositions[61]) // 0-indexed
  console.log('Text at page 62 start:', JSON.stringify(fullText.substring(pageStartPositions[61], pageStartPositions[61] + 50)))
  
  // Check last 100 chars
  console.log('Last 100 chars:', JSON.stringify(fullText.substring(fullText.length - 100)))
  
  // Now try the parsePage62 approach on fullText
  const idx = fullText.indexOf('Questão Gabarito')
  console.log('\nSearching for "Questão Gabarito" directly in fullText...')
  console.log('Is it there?', fullText.includes('Questão Gabarito'))
  
  // Maybe it's an encoding issue? Let's check char codes
  const check = 'Questão Gabarito'
  console.log('Search string char codes:', Array.from(check).map(c => c.charCodeAt(0)).join(','))
  
  // Check if there's a combining character or similar
  const qChar = 'ç'
  console.log('ç char code:', qChar.charCodeAt(0), 'in fullText?', fullText.includes('ç'))
}

main().catch(console.error)