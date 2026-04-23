const fs = require('fs');
const { createRequire } = require('module');
const require2 = createRequire(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));

async function main() {
  const pdfjsLib = require2;
  const data = new Uint8Array(fs.readFileSync('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\USG\\2023\\Prova-Teorica-TP-v1-2023.pdf'));
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise;
  
  console.log('Total pages:', doc.numPages);
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join('');
    if (text.includes('QUESTÃO') || text.includes('Observe')) {
      const qMatches = text.match(/QUESTÃO\s*(\d+)/gi);
      const hasObserve = text.includes('Observe');
      console.log('\nPage ' + i + ': questions=' + (qMatches ? qMatches.join(', ') : 'none') + ' hasObserve=' + hasObserve);
      if (hasObserve) {
        const idx = text.indexOf('Observe');
        console.log('  Snippet:', text.slice(Math.max(0, idx-20), idx+100));
      }
    }
  }
}

main().catch(console.error);
