import './_canvas-polyfill.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ESCALAS_DIR = path.join(__dirname, 'test_escalas');

const API_BASE = 'https://aria-backend-production-176b.up.railway.app';

async function convertPdfToImages(pdfPath) {
  const arrayBuffer = fs.readFileSync(pdfPath);
  const uint8 = new Uint8Array(arrayBuffer);
  const pdf = await getDocument({ data: uint8 }).promise;
  const maxPages = Math.min(pdf.numPages, 4);
  const images = [];
  const errors = [];

  for (let i = 1; i <= maxPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const ctx = canvas.getContext('2d');
      
      // Fill white background first (for transparent pages)
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      await page.render({ canvasContext: ctx, viewport }).promise;
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      images.push(base64);
      console.log(`  Page ${i}: OK (${Math.round(viewport.width)}x${Math.round(viewport.height)}, ${base64.length} chars)`);
    } catch (err) {
      errors.push(`page ${i}: ${err.message}`);
      console.log(`  Page ${i}: ❌ ${err.message.split('\n')[0]}`);
    }
  }

  return { images, errors };
}

async function uploadShifts(images, sourceFile) {
  const res = await fetch(`${API_BASE}/upload-shifts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, source_file: sourceFile }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json();
}

async function testFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 ${fileName}`);
  console.log('═'.repeat(60));

  try {
    console.log('⏳ Convertendo PDF → imagens...');
    const { images, errors } = await convertPdfToImages(filePath);
    
    if (images.length === 0) {
      console.log(`   ❌ Nenhuma página convertida com sucesso`);
      console.log(`   Erros: ${errors.join('; ')}`);
      return;
    }
    
    console.log(`   → ${images.length}/${errors.length + images.length} página(s) extraída(s)`);

    console.log('📤 Upload #1...');
    const r1 = await uploadShifts(images, fileName);
    console.log(`   Total: ${r1.total} | Disp: ${r1.available} | ${(r1.locations || []).join(', ')}`);

    await new Promise(r => setTimeout(r, 3000));

    console.log('📤 Upload #2...');
    const r2 = await uploadShifts(images, fileName);
    console.log(`   Total: ${r2.total} | Disp: ${r2.available} | ${(r2.locations || []).join(', ')}`);

    const loc1 = [...(r1.locations || [])].sort();
    const loc2 = [...(r2.locations || [])].sort();
    const diffs = [];
    if (r1.total !== r2.total) diffs.push(`total: ${r1.total} → ${r2.total}`);
    if (r1.available !== r2.available) diffs.push(`available: ${r1.available} → ${r2.available}`);
    const loc1Set = new Set(loc1);
    const loc2Set = new Set(loc2);
    const onlyIn1 = loc1.filter(l => !loc2Set.has(l));
    const onlyIn2 = loc2.filter(l => !loc1Set.has(l));
    if (onlyIn1.length) diffs.push(`locations only in 1st: ${onlyIn1.join(', ')}`);
    if (onlyIn2.length) diffs.push(`locations only in 2nd: ${onlyIn2.join(', ')}`);

    if (diffs.length === 0) {
      console.log('\n   ✅ CONSISTENTE');
    } else {
      console.log('\n   ❌ INCONSISTENTE:');
      diffs.forEach(d => console.log(`      - ${d}`));
    }
  } catch (err) {
    console.log(`\n   ❌ ERRO: ${err.message}`);
  }
}

async function main() {
  if (!fs.existsSync(ESCALAS_DIR)) return;

  const files = fs.readdirSync(ESCALAS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(ESCALAS_DIR, f));

  console.log(`Found ${files.length} PDF(s)\n`);

  for (const file of files) {
    await testFile(file);
  }
}

main().catch(console.error);