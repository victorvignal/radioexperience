import { createRequire } from 'module'
import fs from 'fs'

const __dirname = '.'
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const provas = [
    { name: 'USG_V1', path: 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\USG\\2023\\Prova-Teorica-TP-v1-2023.pdf' },
    { name: 'USG_V2', path: 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\USG\\2023\\Prova-Teorica-TP-v2-2023.pdf' }
  ];
  
  for (const prova of provas) {
    const data = new Uint8Array(fs.readFileSync(prova.path));
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise;
    
    console.log('\n=== ' + prova.name + ' ===');
    
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join('');
      const qMatches = text.match(/QUESTÃO\s*(\d+)/gi);
      const observeIdx = text.indexOf('Observe');
      if (qMatches || observeIdx >= 0) {
        console.log('Page ' + i + ': ' + (qMatches ? qMatches.join(', ') : 'no-Q') + (observeIdx >= 0 ? ' [HAS OBSERVE]' : ''));
      }
    }
  }
}

main().catch(console.error);
