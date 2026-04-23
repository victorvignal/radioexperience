// Test pdfjs rendering on different pages
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const fs = require('fs')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const canvas = require('canvas')

async function main() {
  const data = new Uint8Array(fs.readFileSync('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, disableFontFace: true, useSystemFonts: true }).promise
  console.log('numPages:', doc.numPages)
  
  for (const pageNum of [1, 2, 3, 4]) {
    console.log(`\n--- Page ${pageNum} ---`)
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 })
    console.log('viewport:', viewport.width, viewport.height)
    
    const cvs = canvas.createCanvas(Math.round(viewport.width), Math.round(viewport.height))
    const ctx = cvs.getContext('2d')
    
    try {
      await page.render({ canvasContext: ctx, viewport }).promise
      console.log(`Page ${pageNum}: OK`)
    } catch (e) {
      console.error(`Page ${pageNum} Error: ${e.message}`)
    }
  }
}

main().catch(console.error)