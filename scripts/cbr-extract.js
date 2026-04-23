/**
 * CBR Questions Extractor
 * Usage: node cbr-extract.js
 * 
 * Processes CBR exam PDFs and extracts questions in ARIA Challenge format.
 * Requires: pdfjs-dist (installed via npm in this directory)
 */

const fs = require('fs');
const path = require('path');

// Check for pdfjs-dist
let pdfjsLib = null;
try {
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (e) {
  console.error('❌ pdfjs-dist not found. Run: npm install pdfjs-dist');
  process.exit(1);
}

const CBR_BASE = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR';

// Priority order: most recent first
const PROVAS = [
  // RDDI
  { specialty: 'RDDI', year: 2025, file: 'RDDI/2025/Prova-TP-com-Gabarito-2025.pdf', priority: 10 },
  { specialty: 'RDDI', year: 2024, file: 'RDDI/2024/Caderno-Completo-com-Gabarito-Preliminar-2024.pdf', priority: 9 },
  { specialty: 'RDDI', year: 2024, file: 'RDDI/2024/Prova-Teorica-Teorico-Pratica-2024-2.pdf', priority: 8 },
  { specialty: 'RDDI', year: 2023, file: 'RDDI/2023/Prova-Teorico-Pratica-v3-2023.pdf', priority: 7 },
  // USG
  { specialty: 'USG', year: 2025, file: 'USG/2025/Gabarito-Prova-USG-2025.pdf', priority: 6 },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v1-2023.pdf', priority: 5 },
  { specialty: 'USG', year: 2023, file: 'USG/2023/Prova-Teorica-TP-v2-2023.pdf', priority: 4 },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let fullText = '';
  const pagesWithImages = [];
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `\n=== PAGE ${i} ===\n${pageText}`;
    
    // Check for images
    const ops = await page.getOperatorList();
    for (let j = 0; j < ops.fnArray.length; j++) {
      if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject) {
        pagesWithImages.push(i);
        break;
      }
    }
  }
  return { fullText, pagesWithImages };
}

function parseQuestions(text, year, specialty) {
  // Pattern: question number followed by text and options A-E
  const questions = [];
  
  // Split into individual questions using common patterns
  const questionBlocks = text.split(/(?:^|\n)\s*(?:\d{1,3})\s*[.)]/m);
  
  for (const block of questionBlocks) {
    if (block.trim().length < 30) continue;
    
    // Extract question number
    const numMatch = block.match(/^(\d{1,3})\s*[.)]/);
    if (!numMatch) continue;
    const number = parseInt(numMatch[1]);
    
    // Extract options (A) through (E) or A) through E)
    const options = [];
    const optionMatches = block.matchAll(/(?:^|\n)\s*([A-E])\s*[).]\s*([^\n]*)/gi);
    for (const m of optionMatches) {
      options.push(`${m[1]}) ${m[2].trim()}`);
    }
    
    if (options.length < 2) continue;
    
    // Clean question text
    let questionText = block
      .replace(/^\d+\s*[.)]\s*/, '')
      .replace(/\n[A-E]\s*[).][^\n]*/gi, '')
      .trim();
    
    // Identify topic from question text
    const topics = identifyTopics(questionText);
    
    questions.push({
      number,
      text: questionText.slice(0, 500),
      options,
      correct_answer: null, // To be filled from gabarito if available
      has_image: false,
      image_base64: null,
      explanation: null,
      topic: topics[0] || 'geral',
      topics: topics,
      year,
      specialty,
    });
  }
  
  return questions;
}

function identifyTopics(text) {
  const textLower = text.toLowerCase();
  const topics = [];
  
  const topicKeywords = {
    'mama': ['mama', 'mamografia', 'birads', 'bi-rads', 'nódulo mamário', 'carcinoma mamário'],
    'neurorradiologia': ['cérebro', 'encefálic', 'rnmu', 'lc', 'hipófise', 'hipofis', 'hipocamp', 'temporal', 'nuclear', 'parkinson', 'alzheimer', 'esclerose', 'avc', 'acidente vascular', 'hemorragia', 'isquemia', 'tumor cerebral', 'meningioma', 'glioma'],
    'tórax': ['pulmão', 'pulmonar', 'tórax', 'torácic', 'pleural', 'consolidação', 'nódulo pulmonar', 'massa mediastinal', 'cardiomegalia', 'edi', 'dren', 'tuberculose'],
    'abdome': ['fígado', 'hepático', 'vesícula', 'biliar', 'pancreat', 'rins', 'renal', 'adrenal', 'baço', 'esplenic', 'intestinal', 'colite', 'apendicite', 'obstrutiva', 'diverticul', 'hepatoesplenomegalia'],
    'musculoesquelético': ['óssea', 'osseo', 'fratura', 'articul', 'quadril', 'joelho', 'coluna', 'vertebral', 'lombalgia', 'tornozelo', 'ombro', 'cotovelo', 'femur', 'femoral', 'tíbia', 'perônio', 'úmero', 'artrose', 'artrit', 'osteomielite', 'necrose', 'perthes', 'sluc', 'les', 'doença de gaucher'],
    'vascular': ['aorta', 'aneurisma', 'vascular', 'arterial', 'venoso', 'tvp', 'trombose', 'embolia', 'isquemia arterial', 'doença arterial obstrutiva', 'dao', 'stent', 'angioplastia'],
    'pediatria': ['pediátric', 'neonatal', 'recém-nascido', 'lactente', 'criança', 'infantil', 'malformação congênita'],
    'medicina nuclear': ['cintilografia', 'pet', 'spect', 'tc99m', 'mibi', 'dmtp', 'gammagrafia', 'hipertireoidismo', 'tireoide', 'paratireoide', 'óssea', 'renal', 'cardíaca', 'pulmonar', 'hepática'],
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      topics.push(topic);
    }
  }
  
  if (topics.length === 0) topics.push('geral');
  return [...new Set(topics)]; // deduplicate
}

function formatAsARIAChallenge(questions, specialty, year) {
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

function estimateDifficulty(text) {
  // Simple heuristic based on text length and complexity
  const words = text.split(/\s+/).length;
  if (words < 20) return 'básica';
  if (words < 50) return 'intermediária';
  return 'avançada';
}

async function main() {
  console.log('🚀 CBR Questions Extractor\n');
  ensureDir(path.join(__dirname, 'cbr_output'));
  
  let allResults = [];
  
  for (const prova of PROVAS) {
    const pdfPath = path.join(CBR_BASE, prova.file);
    
    if (!fs.existsSync(pdfPath)) {
      console.log(`⚠️  Not found: ${prova.file}`);
      continue;
    }
    
    console.log(`📄 Processing: ${prova.specialty} ${prova.year}...`);
    
    try {
      const { fullText, pagesWithImages } = await extractTextFromPDF(pdfPath);
      const questions = parseQuestions(fullText, prova.year, prova.specialty);
      
      console.log(`   → ${questions.length} questões extraídas`);
      if (pagesWithImages.length > 0) {
        console.log(`   → ${pagesWithImages.length} páginas com imagens`);
      }
      
      const output = formatAsARIAChallenge(questions, prova.specialty, prova.year);
      const outFile = path.join(__dirname, 'cbr_output', `cbr_${prova.specialty.toLowerCase()}_${prova.year}.json`);
      fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`   💾 Salvo: cbr_output/cbr_${prova.specialty.toLowerCase()}_${prova.year}.json`);
      
      allResults.push(...questions.map(q => ({ ...q, specialty: prova.specialty, year: prova.year })));
    } catch (e) {
      console.error(`   ❌ Erro: ${e.message}`);
    }
  }
  
  // Summary
  console.log(`\n📊 RESUMO`);
  console.log(`   Total de questões extraídas: ${allResults.length}`);
  
  const bySpecialty = {};
  for (const q of allResults) {
    bySpecialty[q.specialty] = (bySpecialty[q.specialty] || 0) + 1;
  }
  for (const [sp, count] of Object.entries(bySpecialty)) {
    console.log(`   ${sp}: ${count} questões`);
  }
  
  // Save combined output
  const combinedFile = path.join(__dirname, 'cbr_output', 'cbr_all_combined.json');
  fs.writeFileSync(combinedFile, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\n💾 Base combinada: cbr_output/cbr_all_combined.json`);
}

main().catch(console.error);
