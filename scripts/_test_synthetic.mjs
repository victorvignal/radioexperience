import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'test_shifts_out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const API_BASE = 'https://aria-backend-production-176b.up.railway.app';

async function createSyntheticImage() {
  const width = 1200;
  const height = 1600;
  
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="white"/>
<text x="20" y="50" font-family="Arial" font-size="28" font-weight="bold">Escala Médica - Clínica Radiológica</text>
<text x="20" y="90" font-family="Arial" font-size="18">Data: 07/04/2026</text>

<!-- Header -->
<rect x="20" y="120" width="1160" height="40" fill="#2E86AB"/>
<text x="30" y="148" font-family="Arial" font-size="16" fill="white">LOCAL</text>
<text x="200" y="148" font-family="Arial" font-size="16" fill="white">SALA</text>
<text x="400" y="148" font-family="Arial" font-size="16" fill="white">SEG</text>
<text x="520" y="148" font-family="Arial" font-size="16" fill="white">TER</text>
<text x="640" y="148" font-family="Arial" font-size="16" fill="white">QUA</text>
<text x="760" y="148" font-family="Arial" font-size="16" fill="white">QUI</text>
<text x="880" y="148" font-family="Arial" font-size="16" fill="white">SEX</text>

<!-- Row 1 -->
<rect x="20" y="165" width="1160" height="50" fill="white" stroke="#ddd"/>
<text x="30" y="200" font-family="Arial" font-size="14">LA ARPOADOR</text>
<text x="200" y="200" font-family="Arial" font-size="14">USG - Sala 1</text>
<text x="410" y="200" font-family="Arial" font-size="14" fill="green">Dr. Carlos</text>
<text x="530" y="200" font-family="Arial" font-size="14" fill="green">Dr. Ana</text>
<text x="650" y="200" font-family="Arial" font-size="14" fill="red">VAGO</text>
<text x="770" y="200" font-family="Arial" font-size="14" fill="green">Dr. Pedro</text>
<text x="890" y="200" font-family="Arial" font-size="14" fill="red">VAGO</text>

<!-- Row 2 -->
<rect x="20" y="220" width="1160" height="50" fill="#f9f9f9" stroke="#ddd"/>
<text x="30" y="255" font-family="Arial" font-size="14">LA BOTAFOGO</text>
<text x="200" y="255" font-family="Arial" font-size="14">USG - Sala 2</text>
<text x="410" y="255" font-family="Arial" font-size="14" fill="red">VAGO</text>
<text x="530" y="255" font-family="Arial" font-size="14" fill="green">Dr. Maria</text>
<text x="650" y="255" font-family="Arial" font-size="14" fill="green">Dr. João</text>
<text x="770" y="255" font-family="Arial" font-size="14" fill="green">Dr. Paulo</text>
<text x="890" y="255" font-family="Arial" font-size="14" fill="red">VAGO</text>

<!-- Row 3 -->
<rect x="20" y="275" width="1160" height="50" fill="white" stroke="#ddd"/>
<text x="30" y="310" font-family="Arial" font-size="14">LA MEGA BARRA</text>
<text x="200" y="310" font-family="Arial" font-size="14">USG - Sala 3</text>
<text x="410" y="310" font-family="Arial" font-size="14" fill="green">Dr. Roberto</text>
<text x="530" y="310" font-family="Arial" font-size="14" fill="red">VAGO</text>
<text x="650" y="310" font-family="Arial" font-size="14" fill="green">Dr. Fernanda</text>
<text x="770" y="310" font-family="Arial" font-size="14" fill="green">Dr. Lucas</text>
<text x="890" y="310" font-family="Arial" font-size="14" fill="green">Dr. Marcos</text>

<!-- Footer -->
<text x="20" y="380" font-family="Arial" font-size="12" fill="#666">Total: 3 locais | 9 vagas (3 disponíveis)</text>
</svg>`;

  const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, 'synthetic_shifts.jpg'), buf);
  console.log(`Synthetic image: ${buf.length} bytes (${Math.round(buf.length/1024)}KB)`);
  return buf;
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

async function main() {
  console.log('=== Test 1: Synthetic shift table ===');
  const imgBuf = await createSyntheticImage();
  const b64 = imgBuf.toString('base64');
  
  console.log('\n📤 Upload #1...');
  const r1 = await uploadShifts([b64], 'synthetic_shifts.jpg');
  console.log(`   Total: ${r1.total} | Disp: ${r1.available} | Locations: ${(r1.locations || []).join(', ')}`);
  console.log('   JSON:', JSON.stringify(r1, null, 2));
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n📤 Upload #2 (mesma imagem)...');
  const r2 = await uploadShifts([b64], 'synthetic_shifts.jpg');
  console.log(`   Total: ${r2.total} | Disp: ${r2.available} | Locations: ${(r2.locations || []).join(', ')}`);
  
  if (r1.total === r2.total && r1.available === r2.available) {
    console.log('\n   ✅ CONSISTENTE');
  } else {
    console.log('\n   ❌ INCONSISTENTE!');
  }
}

main().catch(console.error);