// Fresh test: use locally installed pdfjs-dist (ESM) + node-canvas
import { createCanvas } from 'canvas';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from './node_modules/pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ESCALAS_DIR = 'C:\\Users\\vigna\\OneDrive\\Documentos\\escalas';

async function renderPdfPage(pdfPath, pageNum, scale = 2.0) {
  const data = new Uint8Array(readFileSync(pdfPath));
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  
  if (pageNum > pdf.numPages) {
    throw new Error(`PDF has only ${pdf.numPages} pages`);
  }
  
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
  
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });
  return buffer;
}

async function main() {
  const files = [
    '07.04.2026 - Escala Médica Cardio Bronstein.pdf',
    '07.04.2026 - Escala Médica Cardio Lâmina.pdf',
    '07.04.2026 - Escala Médica Ultra Bronstein.pdf',
    '07.04.2026 - Escala Médica Ultra Lâmina.pdf',
    '10.04.2026 - Escala Médica Ultra Bronstein (1).pdf',
    '20.02.26 - Escala Médica Ultra e Cardio CDPI Bangú.pdf',
  ];
  
  for (const file of files) {
    const filePath = path.join(ESCALAS_DIR, file);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 ${file}`);
    console.log('═'.repeat(60));
    
    try {
      console.log('⏳ Renderizando página 1...');
      const img = await renderPdfPage(filePath, 1, 2.0);
      console.log(`   Imagem: ${img.length} bytes (${Math.round(img.length/1024)}KB)`);
      
      if (img.length < 100000) {
        console.log('   ⚠️  Imagem pequena - possivelmente em branco');
      }
      
      const outPath = path.join(__dirname, `debug_${file.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`);
      writeFileSync(outPath, img);
      console.log(`   💾 Salva: ${path.basename(outPath)}`);
      
    } catch (err) {
      console.log(`   ❌ Erro: ${err.message.split('\n')[0]}`);
    }
  }
}

main().catch(console.error);