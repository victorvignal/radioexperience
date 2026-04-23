/**
 * Parte 2: perguntas 36-50
 */
const API_URL = 'https://aria-backend-production-176b.up.railway.app/chat'

const PERGUNTAS = [
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
    if (!resp.ok) return { status: 'error', error: `HTTP ${resp.status}` }
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
  console.log(`🚀 Parte 2 — ${PERGUNTAS.length} perguntas\n`)
  for (let i = 0; i < PERGUNTAS.length; i++) {
    const [dificuldade, especialidade, pergunta] = PERGUNTAS[i]
    const n = i + 36
    process.stdout.write(`[${String(n).padStart(2, '0')}/50] ${dificuldade.padEnd(16)} | ${especialidade.padEnd(22)} | ${pergunta.slice(0, 55)} ... `)
    const r = await sendQuestion(pergunta)
    if (r.status === 'ok') {
      console.log(`✅ fontes:${r.sources} chars:${r.answer.length}`)
      results.push({ n, dificuldade, especialidade, pergunta, ...r })
    } else {
      console.log(`❌ ${r.error}`)
      results.push({ n, dificuldade, especialidade, pergunta, status: 'error', error: r.error })
    }
    await new Promise(resolve => setTimeout(resolve, 800))
  }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const ok = results.filter(r => r.status === 'ok').length
  console.log(`\n📊 Parte 2: ${ok}/${results.length} OK em ${elapsed}s`)
  const fs = require('fs')
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  fs.writeFileSync(`aria_parte2_${ts}.json`, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`💾 Salvo em aria_parte2_${ts}.json`)
  // sample
  results.filter(r => r.status === 'ok').slice(0, 2).forEach(r => {
    console.log(`\n[${r.n}] ${r.especialidade}`)
    console.log(`Q: ${r.pergunta}`)
    console.log(`A: ${r.answer.slice(0, 250)}...`)
  })
}

main().catch(console.error)
