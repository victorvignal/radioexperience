/**
 * Debug v2: understand XObject lookup in pdf-lib
 */
import { createRequire } from 'module'
import { PDFDocument, PDFName, PDFDict, PDFStream } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)
const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function main() {
  const pdfPath = path.join(CBR_BASE, 'RDDI', '2025', 'Prova-TP-com-Gabarito-2025.pdf')
  const buffer = fs.readFileSync(pdfPath)
  const doc = await PDFDocument.load(buffer)
  const page = doc.getPages()[0]
  const res = page.node.get(PDFName.of('Resources'))
  const xObj = res.get(PDFName.of('XObject'))

  console.log('XObject is PDFDict:', xObj instanceof PDFDict)
  for (const [name, ref] of xObj.entries()) {
    console.log('\nName:', name.toString())
    console.log('Ref:', ref.toString())

    // Try lookup via context
    let resolved
    try {
      // Try the context lookup
      const ctx = xObject.context
      resolved = xObj.context.lookup(ref)
      console.log('Resolved type:', resolved?.constructor?.name)
      if (resolved) {
        console.log('Resolved keys:', resolved?.keys ? [...resolved.keys()].map(k=>k.toString()) : 'n/a')
        const subtype = resolved?.dict?.get ? resolved.dict.get(PDFName.of('Subtype')) : resolved?.get?.(PDFName.of('Subtype'))
        console.log('Subtype (dict.get):', subtype?.toString?.() || subtype)
      }
    } catch(e) {
      console.log('lookup error:', e.message)
    }

    // Try another approach - lookup in doc.context
    try {
      const fromDoc = doc.context.lookup(ref)
      console.log('fromDoc type:', fromDoc?.constructor?.name)
      if (fromDoc) {
        const subtype2 = fromDoc?.dict?.get ? fromDoc.dict.get(PDFName.of('Subtype')) : fromDoc?.get?.(PDFName.of('Subtype'))
        console.log('Subtype (fromDoc):', subtype2?.toString?.() || subtype2)
        const filter2 = fromDoc?.dict?.get ? fromDoc.dict.get(PDFName.of('Filter')) : fromDoc?.get?.(PDFName.of('Filter'))
        console.log('Filter:', filter2?.toString?.() || filter2)
      }
    } catch(e) {
      console.log('fromDoc error:', e.message)
    }
  }
}

main().catch(console.error)
