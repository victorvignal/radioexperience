/**
 * Teste de carga: 50 perguntas de radiologia variadas
 * Áreas: mama, tórax, neurorradiologia, abdome, musculoesquelético, vascular, pediatria, urgência
 * Dificuldades: básica, intermediária, avançada
 * Uso: node aria_50_perguntas.js
 */

const API_URL = 'https://aria-backend-production-176b.up.railway.app/chat'

const PERGUNTAS = [
  // --- BÁSICA (10) ---
  ['básica', 'mama', 'O que é BI-RADS?'],
  ['básica', 'tórax', 'O que é consolidação pulmonar?'],
  ['básica', 'musculoesquelético', 'O que é fratura em galho verde?'],
  ['básica', 'neurorradiologia', 'O que é edema cerebral?'],
  ['básica', 'abdome', 'O que é hepatomegalia?'],
  ['básica', 'tórax', 'Quais são os lobos pulmonares à direita?'],
  ['básica', 'mama', 'O que é calcificação na mamografia?'],
  ['básica', 'vascular', 'O que é aneurisma de aorta abdominal?'],
  ['básica', 'musculoesquelético', 'Qual a diferença entre luxação e subluxação?'],
  ['básica', 'tórax', 'O que é derrame pleural?'],

  // --- INTERMEDIÁRIA (20) ---
  ['intermediária', 'mama', 'Qual a diferença entre BIRADS 3 e BIRADS 4?'],
  ['intermediária', 'tórax', 'Como diferenciar consolidação de derrame pleural no raio-x?'],
  ['intermediária', 'neurorradiologia', 'Quais os critérios de McDonald para esclerose múltipla?'],
  ['intermediária', 'musculoesquelético', 'Qual a apresentação radiológica da doença de Perthes?'],
  ['intermediária', 'abdome', 'Como stratificar risco de apendicite pelo escore de Alvarado?'],
  ['intermediária', 'mama', 'Quando usar ultrassom complementar à mamografia?'],
  ['intermediária', 'tórax', 'Quais achados radiológicos sugerem insuficiência cardíaca esquerda?'],
  ['intermediária', 'neurorradiologia', 'Qual a diferença entre AVC isquêmico e hemorrágico na TC?'],
  ['intermediária', 'vascular', 'Quando pedir angio-TC de artérias renais?'],
  ['intermediária', 'musculoesquelético', 'Quais são os estágios de Ficat para necrose avascular da femoral?'],
  ['intermediária', 'abdome', 'Qual a sensibilidade da ultrassonografia para litíase biliar?'],
  ['intermediária', 'mama', 'Como funciona a classificação TNM para câncer de mama?'],
  ['intermediária', 'tórax', 'O que é sinal do halo invertido na tuberculose?'],
  ['intermediária', 'neurorradiologia', 'Quando pedir RNM de sela túrcica?'],
  ['intermediária', 'musculoesquelético', 'Qual a utilidade da radiografia na suspeita de osteomielite?'],
  ['intermediária', 'abdome', 'Quais achados de TC sugerem pancreatite necrosante?'],
  ['intermediária', 'tórax', 'Como stratificar nódulo pulmonar pelo sistema Lung-RADS?'],
  ['intermediária', 'vascular', 'Qual o papel do Doppler venoso no diagnóstico de TVP?'],
  ['intermediária', 'musculoesquelético', 'O que é sinal de Blinese?'],
  ['intermediária', 'neurorradiologia', 'Quais são os subtipos de glioma pela classificação WHO 2021?'],

  // --- AVANÇADA (20) ---
  ['avançada', 'mama', 'Qual o valor preditivo positivo real do BIRADS 4A na prática brasileira?'],
  ['avançada', 'neurorradiologia', 'Como o protocolo de Stroke do ACC/AHA muda a conduta no AVC agudo?'],
  ['avançada', 'musculoesquelético', 'Quais critérios de Steinberg classificam necrose avascular da femoral?'],
  ['avançada', 'tórax', 'Qual a acurácia do PET-CT no estadiamento do carcinoma brônquico não pequenas células?'],
  ['avançada', 'abdome', 'Quando a ressonância magnética com hepatobiliares substitui a colangio-Wirsung?'],
  ['avançada', 'mama', 'Qual a taxa de upgrade de lesão cistadenocarcinoma mucinoso no BIRADS 5?'],
  ['avançada', 'neurorradiologia', 'Quais os novos biomarcadores de imagem no diagnóstico de Alzheimer?'],
  ['avançada', 'vascular', 'Qual a mortalidade operatória do AAA roto vs eletivo?'],
  ['avançada', 'musculoesquelético', 'Como o ângulo alfa do fêmur prediz colapso na doença de Perthes?'],
  ['avançada', 'tórax', 'Quais são os padrões de perfusão no cintilograma V/Q e sua interpretação?'],
  ['avançada', 'abdome', 'Qual a sensibilidade e especificidade da elastografia na fibrose hepática?'],
  ['avançada', 'neurorradiologia', 'Como o Swallow Tail Sign exclui Parkinson?'],
  ['avançada', 'mama', 'Qual o papel do Sono no contexto do BIRADS 3?'],
  ['avançada', 'vascular', 'Quando indicar endarterectomia vs angioplastia na doença carotídea?'],
  ['avançada', 'musculoesquelético', 'Qual a utilidade do ângulo de rebatimento na displasia do desenvolvimento do quadril?'],
  ['avançada', 'tórax', 'Como os critérios de Fleischner 2023 mudaram o follow-up de nódulos incidentais?'],
  ['avançada', 'abdome', 'Qual a acurácia da RM multiparamétrica da próstata na detecção de Gleason ≥7?'],
  ['avançada', 'neurorradiologia', 'Quais achados de imagem distinguem neuromielite óptica de esclerose múltipla?'],
  ['avançada', 'mama', 'Como incorporar inteligência artificial na leitura mamográfica?'],
  ['avançada', 'vascular', 'Qual o algoritmo de tratamento para dissecção aórtica tipo B de Stanford?'],
]

async function sendQuestion(q) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, top_k: 5 }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!resp.ok) {
      const err = await resp.text()
      return { status: 'error', error: `HTTP ${resp.status}: ${err.slice(0, 100)}` }
    }
    const data = await resp.json()
    return {
      status: 'ok',
      answer: (data.answer || '').slice(0, 400),
      sources: data.sources ? data.sources.length : 0,
      truncated: data.answer ? data.answer.length > 400 : false,
    }
  } catch (e) {
    return { status: 'error', error: e.message }
  }
}

async function main() {
  const results = []
  const start = Date.now()

  console.log(`🚀 Teste — 50 perguntas — ${new Date().toLocaleTimeString('pt-BR')}\n`)

  for (let i = 0; i < PERGUNTAS.length; i++) {
    const [dificuldade, especialidade, pergunta] = PERGUNTAS[i]
    const n = i + 1
    process.stdout.write(`[${String(n).padStart(2, '0')}/50] ${dificuldade.padEnd(16)} | ${especialidade.padEnd(22)} | ${pergunta.slice(0, 55)} ... `)
    const r = await sendQuestion(pergunta)
    if (r.status === 'ok') {
      console.log(`✅ fontes:${r.sources} chars:${r.answer.length}${r.truncated ? ' [TRUNC]' : ''}`)
      results.push({ n, dificuldade, especialidade, pergunta, ...r })
    } else {
      console.log(`❌ ${r.error}`)
      results.push({ n, dificuldade, especialidade, pergunta, status: 'error', error: r.error })
    }
    // small delay to avoid hammering
    await new Promise(resolve => setTimeout(resolve, 800))
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const ok = results.filter(r => r.status === 'ok').length
  const err = results.length - ok

  console.log(`\n\n📊 RESUMO — ${elapsed}s total`)
  console.log(`   Total: ${ok}/50 OK | Erros: ${err}/50`)
  console.log('\n   Por dificuldade:')
  for (const diff of ['básica', 'intermediária', 'avançada']) {
    const sub = results.filter(r => r.dificuldade === diff)
    const okd = sub.filter(r => r.status === 'ok').length
    console.log(`   ${diff.toUpperCase().padEnd(16)}: ${okd}/${sub.length} OK`)
  }
  console.log('\n   Por especialidade:')
  for (const esp of [...new Set(results.map(r => r.especialidade))].sort()) {
    const sub = results.filter(r => r.especialidade === esp)
    const oke = sub.filter(r => r.status === 'ok').length
    console.log(`   ${esp.toUpperCase().padEnd(22)}: ${oke}/${sub.length} OK`)
  }

  // Salvar JSON
  const fs = require('fs')
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  fs.writeFileSync(`aria_50_perguntas_${ts}.json`, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`\n💾 Salvo em aria_50_perguntas_${ts}.json`)

  // Sample de respostas boas e ruins
  console.log('\n\n--- AMOSTRA: primeiras 3 respostas ---')
  results.filter(r => r.status === 'ok').slice(0, 3).forEach(r => {
    console.log(`\n[${r.n}] ${r.dificuldade} | ${r.especialidade}`)
    console.log(`Q: ${r.pergunta}`)
    console.log(`A: ${r.answer.slice(0, 200)}...`)
  })
}

main().catch(console.error)
