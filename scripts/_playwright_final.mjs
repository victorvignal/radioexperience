// PDF → image: create HTML wrapper with embedded PDF data URL, then screenshot
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ESCALAS_DIR = 'C:\\Users\\vigna\\OneDrive\\Documentos\\escalas';
const OUT_DIR = path.join(__dirname, 'test_shifts_out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const API_BASE = 'https://aria-backend-production-176b.up.railway.app';

function createServer(dir, pdfDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      
      // Root: serve HTML that loads PDF
      if (urlPath === '/' || urlPath === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><head><title>PDF Viewer</title></head>
<body style="margin:0;padding:0">
<iframe id="pdfFrame" width="100%" height="100%" style="border:none"></iframe>
<script>
  // Will be populated with PDF data URL
</script>
</body></html>`);
        return;
      }
      
      // PDF files: serve as HTML that embeds the PDF as data URL
      if (urlPath.startsWith('/pdf/')) {
        const fileName = urlPath.substring(4);
        const safePath = path.join(pdfDir, path.normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, ''));
        
        if (!fs.existsSync(safePath)) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        
        const buf = fs.readFileSync(safePath);
        const dataUrl = 'data:application/pdf;base64,' + buf.toString('base64');
        
        // Return HTML that embeds the PDF
        res.writeHead(200, { 'Content-Type': 'text/html' });
        const html = '<!DOCTYPE html><html><head><title>PDF</title></head>' +
          '<body style="margin:0;padding:0;background:white">' +
          '<iframe id="pdfFrame" src="' + dataUrl + '" width="100%" height="100%" style="border:none"></iframe>' +
          '</body></html>';
        res.end(html);
        return;
      }
      
      res.writeHead(404);
      res.end('Not found');
    });
    
    server.listen(8767, '127.0.0.1', () => resolve(server));
  });
}

async function pdfToImage(pdfPath) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage({ 
    viewport: { width: 1200, height: 1600 }
  });
  
  const fileName = encodeURIComponent(path.basename(pdfPath));
  const url = `http://127.0.0.1:8767/pdf/${fileName}`;
  
  console.log(`  Loading: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(4000);
    
    const state = await page.evaluate(() => {
      const frame = document.getElementById('pdfFrame');
      const iframeDoc = frame?.contentDocument || frame?.contentWindow?.document;
      return {
        hasFrame: !!frame,
        hasIframeDoc: !!iframeDoc,
        bodyLen: iframeDoc?.body?.innerHTML?.length || 0,
        readyState: document.readyState,
      };
    });
    console.log(`  Frame state: hasDoc=${state.hasIframeDoc}, bodyLen=${state.bodyLen}`);
    
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 85 });
    console.log(`  Screenshot: ${screenshot.length} bytes`);
    
    await browser.close();
    return screenshot;
  } catch (e) {
    await browser.close();
    throw e;
  }
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
    console.log('⏳ Renderizando...');
    const screenshot = await pdfToImage(filePath);
    const b64 = screenshot.toString('base64');
    
    const debugPath = path.join(OUT_DIR, `final_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`);
    fs.writeFileSync(debugPath, screenshot);
    
    console.log('📤 Upload #1...');
    const r1 = await uploadShifts([b64], fileName);
    console.log(`   Total: ${r1.total} | Disp: ${r1.available} | ${(r1.locations || []).join(', ')}`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('📤 Upload #2...');
    const r2 = await uploadShifts([b64], fileName);
    console.log(`   Total: ${r2.total} | Disp: ${r2.available} | ${(r2.locations || []).join(', ')}`);
    
    const diffs = [];
    if (r1.total !== r2.total) diffs.push(`total: ${r1.total} → ${r2.total}`);
    if (r1.available !== r2.available) diffs.push(`available: ${r1.available} → ${r2.available}`);
    
    console.log(diffs.length === 0 ? '\n   ✅ CONSISTENTE' : `\n   ❌ INCONSISTENTE: ${diffs.join(', ')}`);
  } catch (err) {
    console.log(`\n   ❌ ERRO: ${err.message.split('\n')[0]}`);
  }
}

async function main() {
  console.log('Iniciando servidor...');
  const server = await createServer(ESCALAS_DIR, ESCALAS_DIR);
  console.log('Servidor em http://127.0.0.1:8767\n');
  
  const files = fs.readdirSync(ESCALAS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(ESCALAS_DIR, f));
  
  console.log(`Found ${files.length} PDFs\n`);
  
  for (const file of files) {
    await testFile(file);
  }
  
  server.close();
  console.log('\nDone.');
}

main().catch(console.error);