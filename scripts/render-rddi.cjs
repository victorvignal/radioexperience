/**
 * Patch pdfjs-dist 5.x to handle node-canvas HTMLCanvasElement
 * The error "Image or Canvas expected" in drawImageAtIntegerCoords is because
 * pdfjs 5.x changed to use a custom Canvas type that doesn't accept 
 * node-canvas HTMLCanvasElement in instanceof checks
 */
const fs = require('fs')
const path = require('path')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const { createCanvas } = require('canvas')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

// Patch drawImageAtIntegerCoords to accept node-canvas Image
const origDrawImage = pdfjsLib.CanvasGraphics.prototype.drawImageAtIntegerCoords
if (origDrawImage) {
  pdfjsLib.CanvasGraphics.prototype.drawImageAtIntegerCoords = function(ctx, img, p0, p1, p2, p3, p4) {
    try {
      // Try the original
      return origDrawImage.call(this, ctx, img, p0, p1, p2, p3, p4)
    } catch (e) {
      // If the error is "Image or Canvas expected", try to handle node-canvas images
      if (e.message === 'Image or Canvas expected' && img && img.constructor && img.constructor.name === 'Canvas') {
        // node-canvas Image (element) - draw using ctx.drawImage with a proxy
        // The node-canvas Image has a naturalWidth property
        try {
          // Draw the node-canvas image by getting its pixel data
          // We can't draw it directly, but we can use the page's image cache
          // Instead, throw original error
          throw e
        } catch(e2) {
          throw e
        }
      }
      throw e
    }
  }
}

// More importantly, patch the paintInlineImageXObject to handle node-canvas images
const origPaintInline = pdfjsLib.CanvasGraphics.prototype.paintInlineImageXObject
if (origPaintInline) {
  pdfjsLib.CanvasGraphics.prototype.paintInlineImageXObject = function(ctx, img, w, h, isInline) {
    try {
      return origPaintInline.call(this, ctx, img, w, h, isInline)
    } catch (e) {
      if (e.message === 'Image or Canvas expected' && img && img.constructor && img.constructor.name === 'Canvas') {
        // node-canvas HTMLCanvasElement - we need to get the pixel data and create a pdfjs-compatible image
        // Use the canvas's toBuffer to get JPEG data then create a new image
        try {
          const buf = img.toBuffer('image/png')
          // Convert PNG buffer to a Blob-like object that pdfjs can use
          const { PDFImage } = pdfjsLib
          if (PDFImage) {
            // Create an image from the PNG buffer
            const tmpImg = new PDFImage()
            // Try creating from data URL
            const dataUrl = 'data:image/png;base64,' + buf.toString('base64')
            // Instead of monkey-patching, let's convert canvas to file and read back as JPEG
          }
        } catch(e2) {
          // Fall back to original error
        }
        throw e
      }
      throw e
    }
  }
}

async function renderPage(doc, pageNum, scale = 1.5) {
  const page = await doc.getPage(pageNum)
  const vp = page.getViewport({ scale })
  
  const canvas = createCanvas(Math.floor(vp.width), Math.floor(vp.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, vp.width, vp.height)
  
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  return canvas
}

async function main() {
  const data = new Uint8Array(fs.readFileSync(CBR_BASE + '\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  
  console.log('Total pages:', doc.numPages)
  
  // Render pages 50-55 (Q49-Q54) and save
  const pageToQ = { 50: 49, 51: 50, 52: 51, 53: 52, 54: 53, 55: 54 }
  
  for (const [pageNum, qNum] of Object.entries(pageToQ)) {
    try {
      const canvas = await renderPage(doc, parseInt(pageNum), 1.5)
      const buf = canvas.toBuffer('image/jpeg', { quality: 90 })
      const outPath = OUT + `\\rddi_2024_q${qNum}.jpg`
      fs.writeFileSync(outPath, buf)
      console.log(`Q${qNum} (page ${pageNum}): ${buf.length} bytes ✓`)
    } catch(e) {
      console.log(`Q${qNum} (page ${pageNum}): FAILED — ${e.message.slice(0, 80)}`)
    }
  }
}

main().catch(console.error)