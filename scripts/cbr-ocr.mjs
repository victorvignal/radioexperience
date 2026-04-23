/**
 * CBR Questions Extractor — com OCR (Tesseract.js)
 * Usage: node cbr-ocr.mjs
 * 
 * Para PDFs escaneados (sem camada de texto).
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const { NodeCanvasFactory } = pdfjsLib;
const Tesseract = require('tesseract.js');

const canvasFactory = new NodeCanvasFactory();

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR';

const PROVAS = [
  { specialty: 'RDDI', year: 2025, file: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf', priority: 10 },
  { specialty: 'RDDI', year: 2024, file: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf', priority: 9 },
  { specialty: 'RDDI', year: 2024, file: 'RDDI/2024/Prova-Teorica-Teorico-Pratica-2024-2.pdf', priority: 8 },
  { specialty: 'RDDI', year: 2023, file: 'RDDI/2023/Prova-Teorico-Pratica-v3-2023.pdf', priority: 7 },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf', priority: 5 },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v2-2023.pdf', priority: 4 },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function renderPageAsImage(doc, pageNum, scale = 2.0) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const { width, height } = viewport;

  const canvasFactory = new NodeCanvasFactory();
  const result = canvasFactory.create(width, height);
  const ctx = result.context;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  await page.render({
    canvasContext: ctx,
    viewport,
    intent: 'display',
    canvasFactory,
  }).promise;

  const buffer = result.canvas.toBuffer('image/png');
  canvasFactory.reset(width, height, result);
  return buffer;
}

async function extractTextOCR(imageBuffer) {
  const result = await Tesseract.recognize(imageBuffer, 'por', {
    logger: () => {}, // silent
  });
  return result.data.text;
}

function parseQuestions(text, year, specialty) {
  const questions = [];
  
  // Normalize text
  let t = text.replace(/\r\n/g, '\n').replace(/\f/g, '\n');
  
  // Try to split by question numbers
  // Pattern: standalone number at start of line followed by text and options
  const lines = t.split('\n');
  let currentQuestion = null;
  let currentOptions = [];
  let currentText = '';
  let questionNum = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if this is a new question: number at start of line followed by period or parenthesis
    const numMatch = trimmed.match(/^(?:QUESTÃO|Q|U)\s*(\d+)\s*[.):]/i);
    if (numMatch) {
      // Save previous question if exists
      if (currentQuestion !== null && currentText.length > 20) {
        const options = parseOptions(currentText + '\n' + currentOptions.join('\n'));
        if (options.length >= 2) {
          questions.push({
            number: questionNum,
            text: cleanQuestionText(currentText),
            options,
            correct_answer: null,
            has_image: false,
            image_base64: null,
            explanation: null,
            topic: identifyTopics(currentText)[0] || 'geral',
            year,
            specialty,
          });
        }
      }
      questionNum = parseInt(numMatch[1]);
      currentText = trimmed.replace(/^(?:QUESTÃO|Q|U)\s*\d+\s*[.):]\s*/i, '');
      currentOptions = [];
      continue;
    }
    
    // Check for option letter at start of line
    const optMatch = trimmed.match(/^(?:[A-E])\s*[.()\-:]\s*(.+)/i);
    if (optMatch && questionNum !== null) {
      currentOptions.push(`${optMatch[1].trim()}`);
      continue;
    }
    
    // Continuation of question text
    if (questionNum !== null && currentOptions.length === 0) {
      currentText += ' ' + trimmed;
    }
  }
  
  // Don't forget last question
  if (questionNum !== null && currentText.length > 20) {
    const options = parseOptions(currentOptions.join('\n'));
    if (options.length >= 2) {
      questions.push({
        number: questionNum,
        text: cleanQuestionText(currentText),
        options,
        correct_answer: null,
        has_image: false,
        image_base64: null,
        explanation: null,
        topic: identifyTopics(currentText)[0] || 'geral',
        year,
        specialty,
      });
    }
  }
  
  return questions;
}

function parseOptions(text) {
  const options = [];
  // Match "A) text" or "A. text" or "A - text" patterns
  const matches = text.matchAll(/^([A-E])\s*[.)]\s*(.+)/gm);
  for (const m of matches) {
    const optText = m[2].replace(/\s+/g, ' ').trim();
    if (optText.length > 1) {
      options.push(`${m[1]}) ${optText}`);
    }
  }
  return options;
}

function cleanQuestionText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[A-E]\s*[.)].*/gi, '')
    .replace(/^(?:QUESTÃO|Q)\s*\d+\s*[.):]\s*/i, '')
    .trim()
    .slice(0, 600);
}

function identifyTopics(text) {
  const t = text.toLowerCase();
  const topics = [];
  
  const kw = {
    mama: ['mama', 'mamografia', 'birads', 'bi-rads', 'nódulo mamário', 'carcinoma mamário', 'axila', 'rebanho mamário', 'ca mama'],
    neurorradiologia: ['cérebro', 'encefálic', 'rnmu', 'lc', 'hipófise', 'hipofis', 'hipocamp', 'temporal', 'nuclear', 'parkinson', 'alzheimer', 'esclerose', 'avc', 'acidente vascular', 'hemorragia intracraniana', 'isquemia', 'tumor cerebral', 'meningioma', 'glioma', 'neurocisticercose', 'malformação arteriovenosa', 'aneurisma intracraniano', 'esclerose múltipla', 'neurocisticercose', 'neuro'],
    tórax: ['pulmão', 'pulmonar', 'tórax', 'torácic', 'pleural', 'consolidação', 'nódulo pulmonar', 'massa mediastinal', 'cardiomegalia', 'edi', 'tuberculose', 'pneumotórax', 'asma', 'dpoc', 'enfisema', 'bronquiectasia', 'pneumonia', 'bronquite', 'fibrose pulmonar', 'hipertensão pulmonar', 'tireoide cervical', 'mediastino'],
    abdome: ['fígado', 'hepático', 'vesícula', 'biliar', 'colelitíase', 'pancreat', 'rins', 'renal', 'adrenal', 'baço', 'esplenic', 'intestinal', 'colite', 'apendicite', 'obstrutiva', 'diverticul', 'hepatoesplenomegalia', 'ascite', 'hepatomegalia', 'esteatose', 'cirrose', 'nefrolitíase', 'pielonefrite', 'cistite', 'ureterolitíase', 'hepatobiliar', 'adrenal'],
    musculoesquelético: ['óssea', 'osseo', 'fratura', 'articul', 'quadril', 'joelho', 'coluna', 'vertebral', 'lombalgia', 'tornozelo', 'ombro', 'cotovelo', 'femur', 'femoral', 'tíbia', 'perônio', 'úmero', 'artrose', 'artrit', 'osteomielite', 'necrose avascular', 'perthes', 'les', 'espondilite', 'espondilolistese', 'osteoporose', 'doença paget', 'metástase óssea', 'tumor ósseo', 'osso', 'esqueleto', 'bacia', 'sacro', 'clavícula', 'escápula', 'patologia'],
    vascular: ['aorta', 'aneurisma', 'vascular', 'arterial', 'venoso', 'tvp', 'trombose venosa', 'embolia pulmonar', 'isquemia arterial', 'dao', 'stent', 'angioplastia', 'endarterectomia', 'insuficiência venosa', 'varizes', 'dissecção aórtica', 'coarctação', 'arteriosclerose', 'doença arterial periférica'],
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
  if (words < 20) return 'básica';
  if (words < 50) return 'intermediária';
  return 'avançada';
}

function formatOutput(questions, specialty, year) {
  return {
    specialty,
    year,
    source: `Provas CBR ${year}`,
    total_questions: questions.length,
    questions: questions.map(q => ({
      number: q.number,
      text: q.text,
      options: q.options,
      correct_answer: q.correct_answer,
      topic: q.topic,
      has_image: q.has_image,
      explanation: q.explanation,
      difficulty: estimateDifficulty(q.text),
    })),
  };
}

async function processPDF(prova) {
  const pdfPath = path.join(CBR_BASE, prova.file);
  if (!fs.existsSync(pdfPath)) {
    console.log(`⚠️  Nao encontrado: ${prova.file}`);
    return [];
  }
  
  process.stdout.write(`📄 ${prova.specialty} ${prova.year}... `);
  
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalEnabled: false,
    useSystemFonts: true,
  }).promise;
  
  const numPages = doc.numPages;
  let fullText = '';
  const pageImages = {};
  
  // OCR each page (max 30 pages for speed)
  const maxPages = Math.min(numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    process.stdout.write(`.`);
    
    try {
      const imgBuffer = await renderPageAsImage(doc, i, 1.5);
      const pageText = await extractTextOCR(imgBuffer);
      fullText += `\n=== PAGE ${i} ===\n${pageText}`;
      pageImages[i] = imgBuffer;
    } catch (e) {
      fullText += `\n=== PAGE ${i} ===\n[OCR FAILED]\n`;
    }
  }
  
  const questions = parseQuestions(fullText, prova.year, prova.specialty);
  console.log(` ${questions.length} questoes de ${numPages} pags`);
  
  return questions;
}

async function main() {
  console.log('🚀 CBR Questions Extractor + OCR\n');
  console.log('⚠️  OCR pode ser lento (1-2 min/pagina)\n');
  
  const outDir = path.join(__dirname, 'cbr_output');
  ensureDir(outDir);
  
  let allQuestions = [];
  
  for (const prova of PROVAS) {
    try {
      const questions = await processPDF(prova);
      
      if (questions.length > 0) {
        const output = formatOutput(questions, prova.specialty, prova.year);
        const outFile = path.join(outDir, `cbr_${prova.specialty.toLowerCase()}_${prova.year}.json`);
        fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
        allQuestions.push(...questions.map(q => ({ ...q, specialty: prova.specialty })));
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }
  
  console.log(`\n📊 Resumo`);
  console.log(`   Total: ${allQuestions.length} questoes`);
  
  const bySp = {};
  for (const q of allQuestions) {
    bySp[q.specialty] = (bySp[q.specialty] || 0) + 1;
  }
  for (const [sp, c] of Object.entries(bySp)) {
    console.log(`   ${sp}: ${c}`);
  }
  
  if (allQuestions.length > 0) {
    const combinedFile = path.join(outDir, 'cbr_all_combined.json');
    fs.writeFileSync(combinedFile, JSON.stringify(allQuestions, null, 2), 'utf-8');
    console.log(`\n💾 Salvo em scripts/cbr_output/`);
  }
  
  console.log('\n✅ Feito!');
}

main().catch(console.error);
