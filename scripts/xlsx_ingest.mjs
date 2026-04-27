/**
 * xlsx_ingest.mjs
 * Ingestão de questões do XLSX para a tabela challenge_question_pool do Supabase.
 * Uso: node xlsx_ingest.mjs
 *
 * Dependências: xlsx, httpx
 * npm install --prefix scripts xlsx httpx
 *
 * Variáveis de ambiente (ou hardcoded):
 *   SUPABASE_URL=https://pcdequsipbkxcfsewiow.supabase.co
 *   SUPABASE_SERVICE_KEY=<service_role_key>
 */

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const XLSX_PATH = 'C:\\Users\\vigna\\.openclaw\\media\\inbound\\questoes_MASTER_FINAL---92b84197-357a-446d-ac04-71bd7a3b3dab.xlsx';
const SUPABASE_URL = 'https://pcdequsipbkxcfsewiow.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const POOL_TABLE = 'challenge_question_pool';
const IMAGE_DIR = path.join(__dirname, 'ingested_images');

// ── Upsert mode: if true, skip existing (question_text + correct_answer) ───────
const UPSERT_MODE = true;

// ── Helpers ───────────────────────────────────────────────────────────────────
function headers() {
  return {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function supabaseGet(table, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  return r.json();
}

async function supabaseUpsert(table, payload) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  return r;
}

async function alterTableAddColumn(table, column, type = 'text') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'GET',
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept-Profile': 'public' },
  });
  // Just check if column exists by querying one row with select
  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1&select=${column}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  if (r2.status === 400) {
    // Column missing — need to ALTER via postgres meta
    console.log(`  [SCHEMA] Column ${column} not found in ${table}, would need manual ALTER TABLE. Skipping safe check.`);
  }
}

function normalizeText(t) {
  if (!t) return '';
  return t.replace(/\s+/g, ' ').trim().toLowerCase();
}

async function downloadImageAsBase64(url) {
  try {
    const r = await fetch(url, { timeout: 10000 });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const mime = r.headers.get('content-type') || 'image/png';
    const b64 = Buffer.from(buf).toString('base64');
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

function parseSpecialty(specialtyStr) {
  if (!specialtyStr) return '';
  // First specialty = before first |
  return specialtyStr.split('|')[0].trim();
}

function buildOptions(row) {
  const opts = {};
  for (const key of ['A', 'B', 'C', 'D', 'E']) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      opts[key] = String(val).trim();
    }
  }
  return opts;
}

// ── Progress log ──────────────────────────────────────────────────────────────
let logLines = [];
function log(msg) {
  console.log(msg);
  logLines.push(msg);
}

// ── Row → pool record ─────────────────────────────────────────────────────────
function rowToPoolRecord(row, index) {
  const question_text = String(row['Enunciado'] || '').trim();
  const gabarito = String(row['Gabarito'] || '').trim().toUpperCase();
  const options = buildOptions(row);
  const image_url = String(row['URL Imagem'] || '').trim();
  const specialty = parseSpecialty(String(row['Especialidade(s)'] || ''));
  const source_title = String(row['Especialidade(s)'] || '').trim();
  const ai_answer = String(row['Resposta Correta'] || '').trim();
  const explanation = String(row['Explicação'] || '').trim();

  return {
    question_text,
    options: JSON.stringify(options),
    correct_answer: gabarito,
    ai_answer,
    explanation: explanation || 'Explicação não disponível.',
    specialty,
    source_title,
    image_url: image_url || '',
    image_base64: '',
    question_type: 'multiple_choice',
    times_used: 0,
    times_correct: 0,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SERVICE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_KEY not set. Set env var or edit top of script.');
    process.exit(1);
  }

  log('═══════════════════════════════════════════════════════════════');
  log('  RadioeXperience XLSX Ingest — ARIA Challenge Question Pool');
  log('═══════════════════════════════════════════════════════════════');
  log(`  Started: ${new Date().toISOString()}`);
  log('');

  // ── Step 0: Ensure image columns exist in DB ─────────────────────────────
  log('[SCHEMA] Checking table columns...');
  const existingCols = new Set();
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/${POOL_TABLE}?limit=1&select=id,question_text,options,correct_answer,ai_answer,explanation,source_title,specialty,question_type,times_used,times_correct`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (r.ok) {
      const sample = await r.json();
      if (sample && sample[0]) {
        Object.keys(sample[0]).forEach(k => existingCols.add(k));
      }
    }
  } catch (e) {
    log(`  [WARN] Could not fetch existing columns: ${e.message}`);
  }

  // Check if image_base64 and image_url exist, warn if not
  if (!existingCols.has('image_base64')) {
    log('  [SCHEMA] ⚠️  image_base64 column MISSING in challenge_question_pool');
    log('  [SCHEMA] Run this SQL in Supabase SQL editor:');
    log('    ALTER TABLE challenge_question_pool ADD COLUMN image_base64 TEXT DEFAULT \'\';');
    log('    ALTER TABLE challenge_question_pool ADD COLUMN image_url TEXT DEFAULT \'\';');
    log('');
  }
  if (!existingCols.has('image_url')) {
    log('  [SCHEMA] ⚠️  image_url column MISSING in challenge_question_pool');
  }

  // ── Step 1: Read XLSX ─────────────────────────────────────────────────────
  log('[XLSX] Loading workbook...');
  const xl = require('xlsx');
  const wb = xl.readFile(XLSX_PATH, { cellDates: false, cellNF: false });
  const sheetNames = wb.SheetNames;
  log(`  Sheets: ${sheetNames.join(', ')}`);
  log('');

  // Primary sheet = TODAS AS QUESTÕES
  const primarySheet = 'TODAS AS QUESTÕES';
  const ws = wb.Sheets[primarySheet];
  const rawData = xl.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // Filter out header row (row with '#' in first column)
  const allRows = rawData.filter(r => r[0] !== '#' && r[0] !== undefined && r[0] !== '');

  log(`[XLSX] Total questions to ingest: ${allRows.length}`);

  // Build headers map
  const headerRow = rawData.find(r => r[0] === '#') || rawData[0];
  const headerMap = {};
  headerRow.forEach((h, i) => { headerMap[String(h).trim()] = i; });

  // ── Step 2: Fetch existing records for dedup check ────────────────────────
  log('');
  log('[DEDUP] Checking existing pool records...');
  const existingMap = new Map(); // key → id
  if (UPSERT_MODE) {
    try {
      const allExisting = await supabaseGet(POOL_TABLE, { select: 'id,question_text,correct_answer', limit: 10000 });
      for (const rec of allExisting) {
        const key = normalizeText(rec.question_text) + '|' + (rec.correct_answer || '').toUpperCase();
        existingMap.set(key, rec.id);
      }
      log(`  Found ${existingMap.size} existing pool records for dedup check.`);
    } catch (e) {
      log(`  [WARN] Could not fetch existing records: ${e.message}. Upsert may create duplicates.`);
    }
  }

  log('');
  log('[INGEST] Starting ingestion...');
  log('');

  let ingested = 0;
  let skipped = 0;
  let withImages = 0;
  let errors = 0;
  const batchSize = 50;
  const records = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const rowNum = i + 2; // +2 for 1-based and header

    // Map by header name
    const record = {};
    for (const [h, idx] of Object.entries(headerMap)) {
      record[h] = row[idx] !== undefined ? row[idx] : '';
    }

    const poolRec = rowToPoolRecord(record, i);
    const dedupKey = normalizeText(poolRec.question_text) + '|' + poolRec.correct_answer;

    // Deduplicate
    if (UPSERT_MODE && existingMap.has(dedupKey)) {
      skipped++;
      if ((i + 1) % 500 === 0) log(`  [${i + 1}/${allRows.length}] Skipped (exists): ${poolRec.question_text.substring(0, 60)}...`);
      continue;
    }

    // Download image if URL present
    if (poolRec.image_url && poolRec.image_url.startsWith('http')) {
      if ((i + 1) % 100 === 0) process.stderr.write(`  [IMG] Downloading image ${i + 1}/${allRows.length}...\r`);
      try {
        const b64 = await downloadImageAsBase64(poolRec.image_url);
        if (b64) {
          poolRec.image_base64 = b64;
          withImages++;
        }
      } catch {
        // keep image_url without base64
      }
    }

    // Upsert payload
    const payload = {
      question_text: poolRec.question_text,
      options: poolRec.options,
      correct_answer: poolRec.correct_answer,
      ai_answer: poolRec.ai_answer,
      explanation: poolRec.explanation,
      specialty: poolRec.specialty,
      source_title: poolRec.source_title,
      question_type: poolRec.question_type,
      times_used: 0,
      times_correct: 0,
      image_url: poolRec.image_url,
      image_base64: poolRec.image_base64,
    };

    // Add ON CONFLICT clause via headers
    // We'll do individual upserts since we need ON CONFLICT (question_text, correct_answer)
    // Use RPC or direct POST with ON CONFLICT
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${POOL_TABLE}`, {
        method: 'POST',
        headers: {
          ...headers(),
          'Prefer': 'resolution=merge-duplicates',
          'X-Kong-Name': '',
        },
        body: JSON.stringify([payload]),
      });

      if (r.ok || r.status === 201 || r.status === 409) {
        ingested++;
        if (ingested % 100 === 0) {
          log(`  ✓ Ingested ${ingested}/${allRows.length} questions (${withImages} with images)`);
        }
      } else {
        const errText = await r.text();
        errors++;
        if (errors <= 5) log(`  [ERR] Row ${rowNum}: ${errText.substring(0, 120)}`);
      }
    } catch (e) {
      errors++;
      if (errors <= 5) log(`  [ERR] Row ${rowNum}: ${e.message}`);
    }

    // Update existingMap so we don't re-insert in same run
    existingMap.set(dedupKey, 'new');
  }

  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('  INGESTION COMPLETE');
  log('═══════════════════════════════════════════════════════════════');
  log(`  Total rows in XLSX:   ${allRows.length}`);
  log(`  Ingested (upserted):  ${ingested}`);
  log(`  Skipped (duplicate):  ${skipped}`);
  log(`  Errors:               ${errors}`);
  log(`  With images:          ${withImages}`);
  log(`  Ended:                ${new Date().toISOString()}`);

  // Save log
  const logPath = path.join(__dirname, 'xlsx_ingest_log.txt');
  fs.writeFileSync(logPath, logLines.join('\n'), 'utf8');
  log(`  Log saved: ${logPath}`);

  if (withImages === 0 && ingested > 0) {
    log('');
    log('  NOTE: No images were downloaded. Check that URL Imagem column');
    log('  has valid URLs (https://...) in the XLSX.');
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});