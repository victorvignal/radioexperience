// Test: capture page renders using canvas API directly (no pdfjs render)
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const canvas = require('canvas')
Object.defineProperty(global, 'Image', { value: canvas.Image, configurable: true, writable: true })

const fs = require('fs')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const data = new Uint8Array(fs.readFileSync('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, disableFontFace: true, useSystemFonts: true }).promise
  console.log('doc numPages:', doc.numPages)

  const page = await doc.getPage(3)
  const viewport = page.getViewport({ scale: 1.5 })
  console.log('viewport:', viewport.width, viewport.height)

  // Use pdfjs's NodeCanvasFactory  
  const { NodeCanvasFactory } = require('pdfjs-dist/legacy/build/pdf.mjs')
  const canvasFactory = new NodeCanvasFactory()
  
  const viewport2 = page.getViewport({ scale: 1.5 })
  console.log('viewport2:', viewport2.width, viewport2.height)
  
  // Try using the canvas factory
  const { width, height } = viewport2
  const canvasEntry = canvasFactory.create(width, height)
  console.log('canvasEntry:', canvasEntry.constructor.name)
  console.log('canvasEntry.canvas:', canvasEntry.canvas.constructor.name)
  
  const ctx = canvasEntry.context
  console.log('ctx:', ctx.constructor.name)
  
  // Render directly to canvas using the canvas factory  
  await page.render({
    canvasContext: ctx,
    viewport: viewport2,
    canvasFactory,
  }).promise
  
  console.log('Render complete!')
  
  // Convert to JPEG
  const buf = canvasEntry.canvas.toBuffer('image/jpeg', { quality: 0.85 })
  console.log('JPEG ok, len=' + buf.length)
  fs.writeFileSync('test_render_output.jpg', buf)
  console.log('Saved test_render_output.jpg')
}

main().catch(console.error)