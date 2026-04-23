import fs from 'fs'
import { PDFDocument, PDFName } from 'pdf-lib'

const pdfPath = 'CBR_PDFs/rddi_2025.pdf'
const buffer = fs.readFileSync(pdfPath)
const pdfDoc = await PDFDocument.load(buffer)
const page = pdfDoc.getPage(0)

let resources
try { resources = page.get(PDFName.of('Resources')) } catch {}
if (!resources) { try { resources = page.lookup(PDFName.of('Resources')) } catch {} }

let xObject
if (resources) {
  try { xObject = resources.get(PDFName.of('XObject')) } catch {}
  if (!xObject) { try { xObject = resources.lookup(PDFName.of('XObject')) } catch {} }
}

console.log('XObject:', xObject ? xObject.toString() : 'null')
if (xObject) {
  console.log('Entries:', [...xObject.entries()].map(([k,v]) => k + ' -> ' + v.toString()).join(', '))
}