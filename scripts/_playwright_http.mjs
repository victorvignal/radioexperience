// PDF → image via local HTTP server + Playwright
// The PDF is served over HTTP (not file://) so browser renders it properly
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

// Simple HTTP server for PDFs
function createServer(dir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url === '/' ? '/index.html' : req.url;
      // Remove query string
      urlPath = urlPath.split('?')[0];
      // URL decode
      urlPath = decodeURIComponent(urlPath);
      // Safe path
      let safePath;
      try {
        safePath = path.join(dir, path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, ''));
      } catch (e) {
        res.writeHead(400);
        res.end('Bad path');
        return;
      }
      
      if (!fs.existsSync(safePath)) {
        console.log(`  [404] ${urlPath}`);
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      
      const ext = path.extname(safePath).toLowerCase();
      const contentTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.png': 'image/png',
      };
      
      res.writeHead(200, {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(safePath).pipe(res);
    });
    
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function pdfToImagesViaPlaywrightHTTPServer(pdfPath, port) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-web-security', '--no-sandbox']
  });
  
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
  
  const fileName = encodeURIComponent(path.basename(pdfPath));
  const pdfUrl = `http://127.0.0.1:${port}/${fileName}`;
  
  console.log(`  Loading: ${pdfUrl}`);
  
  // Navigate and wait for PDF to load
  await page.goto(pdfUrl, { waitUntil: 'networkidle', timeout: 20000 });
  
  // Wait for PDF to fully render
  await page.waitForTimeout(3000);
  
  // Check page state
  const pageState = await page.evaluate(() => {
    return {
      title: document.title,
      contentLength: document.body ? document.body.innerHTML.length : 0,
      readyState: document.readyState,
    };
  });
  console.log(`  Page state: ready=${pageState.readyState}, contentLen=${pageState.contentLength}`);
  
  // Take screenshot
  const screenshot = await page.screenshot({ type: 'jpeg', quality: 85 });
  console.log(`  Screenshot: ${screenshot.length} bytes`);
  
  await browser.close();
  return screenshot;
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
    console.log('⏳ Renderizando via Playwright (HTTP server)...');
    const screenshot = await pdfToImagesViaPlaywrightHTTPServer(filePath, 8765);
    
    // Save debug screenshot
    const debugPath = path.join(OUT_DIR, `playwright_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`);
    fs.writeFileSync(debugPath, screenshot);
    console.log(`  💾 Debug: ${path.basename(debugPath)}`);
    
    const b64 = screenshot.toString('base64');
    
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
    
    if (diffs.length === 0) {
      console.log('\n   ✅ CONSISTENTE');
    } else {
      console.log('\n   ❌ INCONSISTENTE:');
      diffs.forEach(d => console.log(`      - ${d}`));
    }
  } catch (err) {
    console.log(`\n   ❌ ERRO: ${err.message.split('\n')[0]}`);
  }
}

async function main() {
  console.log('Iniciando servidor HTTP...');
  const server = await createServer(ESCALAS_DIR, 8765);
  console.log('Servidor rodando em http://127.0.0.1:8765');
  
  const files = fs.readdirSync(ESCALAS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(ESCALAS_DIR, f));
  
  console.log(`Found ${files.length} PDFs\n`);
  
  for (const file of files) {
    await testFile(file);
  }
  
  server.close();
  console.log('\nServidor encerrado.');
}

main().catch(console.error);