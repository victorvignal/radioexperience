// PDF → image via local HTTP server + Playwright
// Intercept PDF downloads and serve as data URL
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

function createServer(dir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url === '/' ? '/index.html' : req.url;
      urlPath = decodeURIComponent(urlPath.split('?')[0]);
      let safePath;
      try {
        safePath = path.join(dir, path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, ''));
      } catch (e) {
        res.writeHead(400);
        res.end('Bad path');
        return;
      }
      
      if (!fs.existsSync(safePath)) {
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
        'Content-Disposition': `inline; filename="${path.basename(safePath)}"`,
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
    args: ['--disable-web-security', '--no-sandbox', '--disable-features=DownloadShield']
  });
  
  // Block downloads
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1600 },
    ignoreHTTPSErrors: true,
  });
  
  // Intercept ALL requests to catch the PDF
  const pdfData = { buffer: null, url: null };
  
  const page = await context.newPage();
  
  // Route to catch any downloads
  await page.route('**/*', async route => {
    const req = route.request();
    const url = req.url();
    
    // If PDF is requested, load it as data URL
    if (url.includes('.pdf') && !url.startsWith('data:')) {
      console.log(`  Intercepting PDF: ${url.substring(0, 80)}...`);
      // Read the PDF file
      const fileName = decodeURIComponent(url.split('/').pop());
      const filePath = path.join(ESCALAS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
        pdfData.url = url;
        await route.fulfill({
          contentType: 'application/pdf',
          body: buf,
        });
        return;
      }
    }
    
    await route.continue();
  });
  
  const fileName = encodeURIComponent(path.basename(pdfPath));
  const pdfUrl = `http://127.0.0.1:${port}/${fileName}`;
  
  console.log(`  Loading: ${pdfUrl}`);
  
  try {
    await page.goto(pdfUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Check what's loaded
    const pageState = await page.evaluate(() => {
      const bodyText = document.body ? document.body.innerText?.substring(0, 200) : '';
      const imgs = document.images?.length || 0;
      const iframes = document.querySelectorAll('iframe').length;
      const embeds = document.querySelectorAll('embed').length;
      const objects = document.querySelectorAll('object').length;
      return { bodyText, imgs, iframes, embeds, objects, readyState: document.readyState };
    });
    console.log(`  State: imgs=${pageState.imgs} iframes=${pageState.iframes} embeds=${pageState.embeds} objects=${pageState.objects}`);
    if (pageState.bodyText) console.log(`  Body text: ${pageState.bodyText.substring(0, 100)}`);
    
    // Try screenshot
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 85 });
    console.log(`  Screenshot: ${screenshot.length} bytes`);
    
    // Save debug
    const debugPath = path.join(OUT_DIR, `pw2_${path.basename(pdfPath).replace(/[^a-zA-Z0-9]/g, '_')}.jpg`);
    fs.writeFileSync(debugPath, screenshot);
    
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
    const screenshot = await pdfToImagesViaPlaywrightHTTPServer(filePath, 8765);
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
  console.log('Servidor em http://127.0.0.1:8765\n');
  
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