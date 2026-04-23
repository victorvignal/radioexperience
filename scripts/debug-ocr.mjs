/**
 * Debug: mostra sample do OCR de uma página
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const { NodeCanvasFactory } = pdfjsLib;
const Tesseract = require('tesseract.js');

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR';

async function main() {
  const pdfPath = path.join(CBR_BASE, 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise;
  
  console.log('Total pages:', doc.numPages);
  
  for (let i = 1; i <= 2; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvasFactory = new NodeCanvasFactory();
    const result = canvasFactory.create(viewport.width, viewport.height);
    const ctx = result.context;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    await page.render({ canvasContext: ctx, viewport, intent: 'display', canvasFactory }).promise;
    const imgBuffer = result.canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(__dirname, `debug_page_${i}.png`), imgBuffer);
    process.stdout.write(`Page ${i} rendered (${(imgBuffer.length/1024).toFixed(0)}KB)...`);
    
    const { data: { text } } = await Tesseract.recognize(imgBuffer, 'por', { logger: m => process.stdout.write('.') });
    console.log(`\n=== PAGE ${i} (${text.length} chars) ===`);
    console.log(text.slice(0, 2000));
    console.log('---');
  }
  console.log('\n✅ Debug complete!');
}

main().catch(console.error);
