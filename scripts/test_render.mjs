import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire(import.meta.url)

const canvas = require('canvas')
Object.defineProperty(global, 'Image', { value: canvas.Image, configurable: true, writable: true })

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const data = new Uint8Array(fs.readFileSync('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, disableFontFace: true, useSystemFonts: true }).promise
  console.log('doc numPages:', doc.numPages)
  const page = await doc.getPage(3)
  const viewport = page.getViewport({ scale: 1.5 })
  console.log('viewport:', viewport.width, viewport.height)
  const cvs = canvas.createCanvas(Math.round(viewport.width), Math.round(viewport.height))
  const ctx = cvs.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  const buf = cvs.toBuffer('image/jpeg', { quality: 0.85 })
  console.log('JPEG ok, len=' + buf.length)
}

main().catch(console.error)