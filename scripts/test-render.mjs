import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas } from 'canvas'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function testRender() {
  const pdfPath = CBR_BASE + '\\USG\\2023\\Prova-Teorica-TP-v1-2023.pdf'
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  const page = await doc.getPage(25)
  const viewport = page.getViewport({ scale: 1.5 })
  
  console.log('Viewport:', viewport.width, 'x', viewport.height)
  
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  
  // Fill white background
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  await page.render({ canvasContext: ctx, viewport }).promise
  
  const buffer = canvas.toBuffer('image/png')
  const outPath = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output\\test_page25.png'
  fs.writeFileSync(outPath, buffer)
  console.log('Saved: ' + outPath + ' (' + buffer.length + ' bytes)')
}

testRender().catch(e => { console.error('Error:', e.message) })
