// Test pdfjs-dist/node-next exports
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const pdfjsNext = require('pdfjs-dist/node-next/build/pdf.mjs')
const keys = Object.keys(pdfjsNext).filter(k => k.includes('Canvas') || k.includes('Factory') || k.includes('Node') || k === 'getDocument')
console.log('node-next exports:', keys)