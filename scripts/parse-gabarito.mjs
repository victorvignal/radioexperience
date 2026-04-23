import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR'

async function parseGabaritoAnswers(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += ' ' + content.items.map(item => item.str).join('')
  }

  const answers = {}

  // Split TEORICA and TEORICO-PRATICA sections
  const t1 = text.indexOf('GABARITO PROVA TEÓRICAQT. Gabarito')
  const t2 = text.indexOf('GABARITO PROVA TEÓRICO-PRÁTICA')
  const teoricaBlock = text.slice(t1, t2 > t1 ? t2 : text.length)

  // Pattern: number + space + ANULADA or single letter
  const p1 = [...teoricaBlock.matchAll(/(\d+)\s+(ANULADA|[A-E])/g)]
  for (const m of p1) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 100) answers[n] = m[2]
  }

  // Pattern: number immediately followed by letter (no space) 
  // e.g. "1C2D" in the TEORICA block
  // Only for numbers 1-9 followed by A-E
  const p2 = [...teoricaBlock.matchAll(/(?<=[^\d\n])(\d)([A-E])(?=\d|[A-Z]|\s|$)/g)]
  for (const m of p2) {
    const n = parseInt(m[1])
    if (n >= 1 && n <= 100 && !answers[n]) answers[n] = m[2]
  }

  // Also check the TP block if present
  if (t2 > 0) {
    const tpBlock = text.slice(t2)
    const tp1 = [...tpBlock.matchAll(/(\d+)\s+(ANULADA|[A-E])/g)]
    for (const m of tp1) {
      const n = parseInt(m[1])
      if (n >= 1 && n <= 100) answers['TP' + n] = m[2]
    }
    const tp2 = [...tpBlock.matchAll(/(?<=[^\d\n])(\d)([A-E])(?=\d|[A-Z]|\s|$)/g)]
    for (const m of tp2) {
      const n = parseInt(m[1])
      if (n >= 1 && n <= 100) answers['TP' + n] = m[2]
    }
  }

  return answers
}

async function main() {
  const files = {
    'May 2023': CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-maio-2023.pdf',
    'June 2023': CBR_BASE + '\\USG\\2023\\Gabarito-USG-Geral-junho-2023.pdf',
  }
  for (const [label, filePath] of Object.entries(files)) {
    const ans = await parseGabaritoAnswers(filePath)
    const valid = Object.fromEntries(Object.entries(ans).filter(([k, v]) => v !== 'ANULADA'))
    const anuladas = Object.keys(ans).filter(k => ans[k] === 'ANULADA')
    const tpKeys = Object.keys(ans).filter(k => String(k).startsWith('TP'))
    console.log(`${label}: ${Object.keys(valid).length} válidas, ${anuladas.length} anuladas (Q${anuladas.join(', Q')})${tpKeys.length > 0 ? ', ' + tpKeys.length + ' TP' : ''}`)
    console.log('  TEORICA Q1-10:', Object.entries(ans).filter(([k]) => !String(k).startsWith('TP')).slice(0, 10).map(e => e[0] + ':' + e[1]).join(','))
  }
}

main().catch(console.error)
