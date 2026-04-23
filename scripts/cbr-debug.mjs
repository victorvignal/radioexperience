/**
 * Debug: dump page resources of CBR RDDI 2025 page 1
 */
import { createRequire } from 'module'
import { PDFDocument, PDFName, PDFDict, PDFStream } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  const pdfPath = path.join(CBR_BASE, 'RDDI', '2025', 'Prova-TP-com-Gabarito-2025.pdf')
  const buffer = fs.readFileSync(pdfPath)

  // pdf-lib inspection
  console.log('=== pdf-lib ===')
  const doc = await PDFDocument.load(buffer)
  const page = doc.getPages()[0]
  console.log('Page node keys:', [...page.node.keys()].map(k => k.toString()))

  let res
  try { res = page.node.get(PDFName.of('Resources')) } catch(e) { console.log('res error:', e.message) }
  console.log('Resources type:', res?.constructor?.name)
  if (res instanceof PDFDict) {
    console.log('Resources keys:', [...res.keys()].map(k => k.toString()))
    let xObj
    try { xObj = res.get(PDFName.of('XObject')) } catch(e) { console.log('XObject error:', e.message) }
    console.log('XObject type:', xObj?.constructor?.name)
    if (xObj instanceof PDFDict) {
      console.log('XObject entries:', xObj.entries().length)
      for (const [k, v] of xObj.entries()) {
        console.log(' ', k.toString(), '→', v?.constructor?.name, v?.toString?.())
      }
    }
  }

  // pdfjs-dist inspection
  console.log('\n=== pdfjs-dist ===')
  const data = new Uint8Array(buffer)
  const pdfjsDoc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  const pdfjsPage = await pdfjsDoc.getPage(1)
  const ops = await pdfjsPage.getOperatorList()
  console.log('Total ops:', ops.fnArray.length)
  const imgOps = ['paintImageXObject', 'paintInlineImageXObject', 'paintJpegXObject']
  const OPS = pdfjsLib.OPS
  for (const [name, val] of Object.entries(OPS)) {
    if (name.includes('Image') || name.includes('image')) {
      console.log(' ', name, '→', val, 'used:', ops.fnArray.includes(val))
    }
  }

  // Try to get page common dist
  const viewport = pdfjsPage.getViewport({ scale: 1 })
  console.log('\nPage size:', viewport.width, 'x', viewport.height)
}

main().catch(console.error)
