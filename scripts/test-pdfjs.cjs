const p = require('pdfjs-dist/legacy/build/pdf.mjs')
console.log('Keys with node/canvas:', Object.keys(p).filter(k => k.toLowerCase().includes('node') || k.toLowerCase().includes('canvas')).slice(0, 10))
console.log('PDF namespace keys:', Object.keys(p).filter(k => k.startsWith('PDF')).slice(0, 10))