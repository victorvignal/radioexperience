import { getDocument } from './node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from './node_modules/canvas/index.js'

console.log('getDocument type:', typeof getDocument)
console.log('createCanvas type:', typeof createCanvas)

// Try to list what's exported from pdf.mjs
const pdf = await import('./node_modules/pdfjs-dist/legacy/build/pdf.mjs')
console.log('pdfjs keys:', Object.keys(pdf).filter(k => k.toLowerCase().includes('canvas') || k.toLowerCase().includes('node')).join(', '))
