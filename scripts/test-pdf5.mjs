import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')

const PDF_PATH = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2025\\Prova-TP-com-Gabarito-2025.pdf'

async function main() {
  console.log('Loading RDDI 2025 PDF...')
  const buffer = fs.readFileSync(PDF_PATH)
  const data = new Uint8Array(buffer)
  
  console.log('File size:', buffer.length)
  console.log('First 20 bytes:', Buffer.from(data.slice(0, 20)).toString('hex'))
  
  // Try pdfjs first
  try {
    const pdfjsDoc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false }).promise
    console.log('pdfjs OK - pages:', pdfjsDoc.numPages)
  } catch(e) {
    console.log('pdfjs error:', e.message)
  }
  
  // Try pdf-lib with arrayBuffer
  try {
    const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const pdfLibDoc = await PDFDocument.load(arrayBuf)
    console.log('pdf-lib OK - pages:', pdfLibDoc.getPageCount())
  } catch(e) {
    console.log('pdf-lib error:', e.message)
  }
}

main().catch(console.error)
