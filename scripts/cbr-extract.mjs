/**
 * CBR Questions Extractor — Final version
 * Extracts multiple-choice questions from CBR exam PDFs.
 * Output: scripts/cbr_output/cbr_{specialty}_{year}.json
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR';

const PROVAS = [
  { specialty: 'RDDI', year: 2025, file: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf', has_gabarito_pages: true, gabarito_pages: [65, 66], pattern: 'ID', suffix: '' },
  { specialty: 'RDDI', year: 2024, file: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf', has_gabarito_pages: true, gabarito_pages: [62], pattern: 'SIMPLE', suffix: '' },
  { specialty: 'RDDI', year: 2023, file: 'RDDI/2023/Prova-Teorico-Pratica-v3-2023.pdf', has_gabarito_pages: false, pattern: 'NONE', suffix: '' },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf', has_gabarito_pages: false, pattern: 'USG', suffix: '_v1' },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v2-2023.pdf', has_gabarito_pages: false, pattern: 'USG', suffix: '_v2' },
];

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

async function extractAllText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalEnabled: false, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push({ pageNum: i, text: '\n' + content.items.map(item => item.str).join('') + '\n' });
  }
  return { doc, pages };
}

function extractGabarito(pages, gabaritoPages) {
  const text = gabaritoPages.map(p => pages[p - 1]?.text || '').join('\n')
    .replace(/GABARITO\s*PRELI[GМ]?AR/gi, '').replace(/GABARITO/gi, '').replace(/Questão\s*/gi, '')
    .replace(/2ª\s*ETAPA.*$/gs, '').replace(/RADIOLOGIA.*$/gs, '').replace(/nulada/gi, '').trim();
  const answers = {};
  for (const m of text.matchAll(/(\d+)\s+([A-E])(?=\d|$)/g)) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 100) answers[n] = m[2];
  }
  return answers;
}

function parseAll(fullText, year, specialty, pattern) {
  const questions = [];
  let parts;
  let numRe, bodyRe, optRe;

  if (pattern === 'ID') {
    parts = fullText.split(/(?=Questão\s+\d+\s+(?:-)?\s*ID:)/);
    numRe = /^Questão\s+(\d+)\s+(?:-)?\s*ID:/i;
    bodyRe = /^Questão\s+\d+\s+(?:-)?\s*ID:\s*\d+/i;
    optRe = /^([A-E])\)\s*/;
  } else if (pattern === 'USG') {
    parts = fullText.split(/(?=QUESTÃO\s*\d+)/i);
    numRe = /^QUESTÃO\s*(\d+)/i;
    bodyRe = /^QUESTÃO\s*\d+/i;
    optRe = /^([A-E])\s*-\s*/;
  } else {
    parts = fullText.split(/(?=Questão\s*\d+)/i);
    numRe = /^Questão\s*(\d+)/i;
    bodyRe = /^Questão\s*\d+/i;
    optRe = /^([A-E])\)\s*/;
  }

  for (const part of parts) {
    if (!part.trim()) continue;
    const numMatch = part.match(numRe);
    if (!numMatch) continue;
    const qNum = parseInt(numMatch[1]);
    let body = part.replace(bodyRe, '');
    const sections = body.split(pattern === 'USG' ? /(?=[A-E]\s*-\s*)/ : /(?=[A-E]\)\s*)/);
    let questionText = (sections[0] || body).replace(/\s+/g, ' ').trim().replace(/^[\d]+\s*/, '');
    const options = [];
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i].trim();
      if (!sec) continue;
      const m = sec.match(optRe);
      if (m) {
        const txt = m[1] === '-' ? sec.replace(/^[A-E]\s*-\s*/, '').replace(/\s+/g, ' ').trim() : sec.replace(/^[A-E]\)\s*/, '').replace(/\s+/g, ' ').trim();
        if (txt.length > 1) options.push(`${m[1]}) ${txt}`);
      }
    }
    if (options.length < 2) continue;
    const topics = identifyTopics(questionText);
    questions.push({ number: qNum, text: questionText.slice(0, 800), options, correct_answer: null, has_image: false, image_base64: null, explanation: null, topic: topics[0] || 'geral', topics, year, specialty });
  }
  return questions;
}

function identifyTopics(text) {
  const t = text.toLowerCase();
  const topics = [];
  const kw = {
    mama: ['mama', 'mamografia', 'birads', 'bi-rads', 'nódulo mamário', 'carcinoma mamário', 'axila', 'rebanho mamário', 'ca mama'],
    neurorradiologia: ['cérebro', 'encefálic', 'rnmu', 'lc', 'hipófise', 'hipofis', 'hipocamp', 'temporal', 'nuclear', 'parkinson', 'alzheimer', 'esclerose', 'avc', 'acidente vascular', 'hemorragia intracraniana', 'isquemia', 'tumor cerebral', 'meningioma', 'glioma', 'neurocisticercose', 'malformação arteriovenosa', 'aneurisma intracraniano', 'esclerose múltipla', 'neuro'],
    torax: ['pulmão', 'pulmonar', 'tórax', 'torácic', 'pleural', 'consolidação', 'nódulo pulmonar', 'massa mediastinal', 'cardiomegalia', 'edi', 'tuberculose', 'pneumotórax', 'asma', 'dpoc', 'enfisema', 'bronquiectasia', 'pneumonia', 'bronquite', 'fibrose pulmonar', 'hipertensão pulmonar', 'mediastino'],
    abdome: ['fígado', 'hepático', 'vesícula', 'biliar', 'colelitíase', 'pancreat', 'rins', 'renal', 'adrenal', 'baço', 'esplenic', 'intestinal', 'colite', 'apendicite', 'obstrutiva', 'diverticul', 'hepatoesplenomegalia', 'ascite', 'hepatomegalia', 'esteatose', 'cirrose', 'nefrolitíase', 'pielonefrite', 'cistite', 'ureterolitíase', 'hepatobiliar'],
    msk: ['óssea', 'osseo', 'fratura', 'articul', 'quadril', 'joelho', 'coluna', 'vertebral', 'lombalgia', 'tornozelo', 'ombro', 'cotovelo', 'femur', 'femoral', 'tíbia', 'perônio', 'úmero', 'artrose', 'artrit', 'osteomielite', 'necrose avascular', 'perthes', 'les', 'espondilite', 'espondilolistese', 'osteoporose', 'paget', 'metástase óssea', 'tumor ósseo', 'osso', 'esqueleto', 'bacia', 'sacro', 'clavícula', 'escápula', 'dmo', 'dxa'],
    vascular: ['aorta', 'aneurisma', 'vascular', 'arterial', 'venoso', 'tvp', 'trombose venosa', 'embolia pulmonar', 'isquemia arterial', 'dao', 'stent', 'angioplastia', 'endarterectomia', 'insuficiência venosa', 'varizes', 'dissecção aórtica', 'coarctação', 'arteriosclerose', 'endoleak', 'vertebral', 'subclávia', 'femoral', 'mesentérica'],
    pediatria: ['pediátric', 'neonatal', 'recém-nascido', 'lactente', 'criança', 'infantil', 'malformação congênita', 'atresia', 'estenose', 'onfalocele', 'gastrosquise', 'hidronefrose', 'displasia congênita do quadril', 'doença hipercética'],
    medicina_nuclear: ['cintilografia', 'pet-ct', 'spect', 'tc99m', 'mibi', 'dmtp', 'gammagrafia', 'hipertireoidismo', 'tireoide', 'paratireoide', 'cintilografia renal', 'cintilografia óssea', 'cintilografia pulmonar', 'perfusão pulmonar', 'ventilação pulmonar', 'renal', 'hepatobiliar', 'hepática', 'cardíaca', 'miocárdio', 'viabilidade miocárdica', 'pet fdg'],
  };
  for (const [topic, keywords] of Object.entries(kw)) {
    if (keywords.some(k => t.includes(k))) topics.push(topic);
  }
  return topics.length ? [...new Set(topics)] : ['geral'];
}

function estimateDifficulty(text) {
  const words = text.split(/\s+/).length;
  return words < 20 ? 'básica' : words < 50 ? 'intermediária' : 'avançada';
}

function formatOutput(questions, specialty, year, suffix) {
  return {
    specialty, year, suffix,
    source: `Provas CBR ${year}${suffix}`,
    total_questions: questions.length,
    questions: questions.map(q => ({
      number: q.number, text: q.text, options: q.options,
      correct_answer: q.correct_answer, topic: q.topic, topics: q.topics,
      has_image: q.has_image, explanation: q.explanation,
      difficulty: estimateDifficulty(q.text),
    })),
  };
}

async function main() {
  console.log('🚀 CBR Questions Extractor\n');
  const outDir = path.join(__dirname, 'cbr_output');
  ensureDir(outDir);
  let allQuestions = [];

  for (const prova of PROVAS) {
    const pdfPath = path.join(CBR_BASE, prova.file);
    if (!fs.existsSync(pdfPath)) { console.log(`⚠️  Nao encontrado: ${prova.file}`); continue; }
    if (prova.pattern === 'NONE') { console.log(`⏭️  ${prova.specialty} ${prova.year}: formato nao suportado`); continue; }

    process.stdout.write(`📄 ${prova.specialty} ${prova.year}${prova.suffix}... `);
    try {
      const { doc, pages } = await extractAllText(pdfPath);
      process.stdout.write(`${doc.numPages}p `);
      const gabarito = prova.has_gabarito_pages ? extractGabarito(pages, prova.gabarito_pages) : {};
      if (Object.keys(gabarito).length) process.stdout.write(`(${Object.keys(gabarito).length} gab) `);
      const questions = parseAll(pages.map(p => p.text).join(''), prova.year, prova.specialty, prova.pattern);
      let withAnswers = 0;
      for (const q of questions) { if (gabarito[q.number]) { q.correct_answer = gabarito[q.number]; withAnswers++; } }
      process.stdout.write(`✅ ${questions.length} Qs`);
      if (withAnswers) process.stdout.write(` (${withAnswers} c/resp)`);
      process.stdout.write('\n');
      if (questions.length) {
        const output = formatOutput(questions, prova.specialty, prova.year, prova.suffix);
        const outFile = path.join(outDir, `cbr_${prova.specialty.toLowerCase()}_${prova.year}${prova.suffix}.json`);
        fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
        allQuestions.push(...questions.map(q => ({ ...q, specialty: prova.specialty })));
      }
    } catch (e) { process.stdout.write(`❌ ${e.message}\n`); }
  }

  console.log(`\n📊 Total: ${allQuestions.length} questoes`);
  if (allQuestions.length) {
    fs.writeFileSync(path.join(outDir, 'cbr_all_combined.json'), JSON.stringify(allQuestions, null, 2));
    for (const sp of [...new Set(allQuestions.map(q => q.specialty))]) {
      fs.writeFileSync(path.join(outDir, `cbr_${sp.toLowerCase()}_combined.json`), JSON.stringify(allQuestions.filter(q => q.specialty === sp), null, 2));
    }
    console.log(`💾 Salvo em scripts/cbr_output/\n✅ Feito!`);
  }
}

main().catch(console.error);
