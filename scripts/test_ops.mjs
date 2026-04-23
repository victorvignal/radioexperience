// Check OPS mapping
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

// Find the OPS values for paintInlineImageXObject etc
const opsByName = {}
for (const [name, value] of Object.entries(pdfjsLib.OPS)) {
  if (!opsByName[value]) opsByName[value] = []
  opsByName[value].push(name)
}

const interesting = ['paintInlineImageXObject', 'paintImageXObject', 'paintImageMaskXObject', 'paintImageMask', 'paintFormXObject', 'paintXObject']
for (const name of interesting) {
  if (pdfjsLib.OPS[name] !== undefined) {
    console.log(`${name} = ${pdfjsLib.OPS[name]}`)
  }
}

// Also show what op44 is
console.log('\nOPS[44]:', pdfjsLib.OPS[44])
console.log('OPS[37]:', pdfjsLib.OPS[37])
console.log('OPS[43]:', pdfjsLib.OPS[43])

// Show all OPS
console.log('\nAll OPS:')
for (const [name, val] of Object.entries(pdfjsLib.OPS).sort((a,b) => typeof a[1] === 'number' && typeof b[1] === 'number' ? a[1]-b[1] : 0)) {
  if (typeof val === 'number') console.log(`  ${val}: ${name}`)
}