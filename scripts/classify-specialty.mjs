/**
 * classify-specialty.mjs
 * 
 * Classifies all questions in challenge_question_pool by specialty using GPT.
 * Questions without a specialty (or with "Geral") will be classified.
 * 
 * Usage: 
 *   Set OPENAI_API_KEY env var
 *   node classify-specialty.mjs [--dry-run] [--specialty Mama]
 */

import https from 'https'
import { fileURLToPath } from 'url'
import path from 'path'
import OpenAI from 'openai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://pcdequsipbkxcfsewiow.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

const SPECIALTIES = [
  'Mama',
  'Neurorradiologia', 
  'Abdome',
  'Tórax',
  'Pediatria',
  'Musculoesquelético',
  'Intervenção',
  'Vascular',
  'Obstetrícia',
  'Cabeça e Pescoço',
  'Geral',
]

// GPT model for classification
const GPT_MODEL = 'gpt-5.4-nano'

// ── CLI args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const TARGET_SPECIALTY = args.find(a => a.startsWith('--specialty='))?.split('=')[1] || null

console.log(`\n🩺 Classificador de Especialidades — ARIA Challenge`)
console.log(`   Dry run: ${DRY_RUN ? 'SIM (sem alterações)' : 'NÃO (vai alterar o banco)'}`)
console.log(`   Especialidade alvo: ${TARGET_SPECIALTY || 'TODAS'}\n`)

// ── Supabase helpers ───────────────────────────────────────────────────────────
function supabaseRequest(method, table, params = {}) {
  return new Promise((resolve, reject) => {
    const queryStr = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    const urlPath = queryStr ? `/${table}?${queryStr}` : `/${table}`
    
    const options = {
      hostname: SUPABASE_URL.replace('https://', ''),
      path: `/rest/v1${urlPath}`,
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      }
    }
    
    const req = https.request(options, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, data })
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function fetchAllQuestions() {
  console.log('📥 Buscando questões do pool...')
  const params = {
    select: 'id,question_text,specialty,source_title,times_used',
    order: 'times_used.asc',
  }
  if (TARGET_SPECIALTY) {
    params.specialty = `eq.${TARGET_SPECIALTY}`
  }
  const { status, data } = await supabaseRequest('GET', 'challenge_question_pool', params)
  if (status !== 200) {
    throw new Error(`Failed to fetch questions: ${status} ${JSON.stringify(data)}`)
  }
  console.log(`   Encontradas ${data.length} questões`)
  return data
}

async function updateSpecialty(id, specialty) {
  if (DRY_RUN) return { status: 200 }
  
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ specialty })
    const options = {
      hostname: SUPABASE_URL.replace('https://', ''),
      path: `/rest/v1/challenge_question_pool?id=eq.${id}`,
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, data }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não está definida!')
  console.error('   Execute: export OPENAI_API_KEY=sua-chave')
  process.exit(1)
}

async function classifySpecialty(questionText) {
  const prompt = `Você é um radiologista especialista. Classifique a questão abaixo em UMA ÚNICA especialidade de radiologia.

ESPECIALIDADES VÁLIDAS:
- Mama
- Neurorradiologia
- Abdome
- Tórax
- Pediatria
- Musculoesquelético
- Intervenção
- Vascular
- Obstetrícia
- Cabeça e Pescoço
- Geral (só use se não houver como classificar em nenhuma das outras)

QUESTÃO:
${questionText.substring(0, 1200)}

Respondendo SOMENTE com o nome da especialidade (uma palavra/sigla), sem explicação.`

  try {
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_completion_tokens: 30,
    })
    
    const specialty = response.choices[0].message.content.trim()
    
    // Validate response
    const normalized = specialty.toLowerCase().trim()
    const match = SPECIALTIES.find(s => s.toLowerCase() === normalized)
    if (!match) {
      console.warn(`   ⚠️ Resposta inválida "${specialty}", usando "Geral"`)
      return 'Geral'
    }
    return match
  } catch (error) {
    throw error
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const questions = await fetchAllQuestions()
  
  // Filter questions that need classification
  const toClassify = questions.filter(q => 
    !q.specialty || 
    q.specialty === 'Geral' ||
    q.specialty.toLowerCase() === 'geral'
  )
  
  console.log(`\n📋 ${toClassify.length} questões precisam de classificação`)
  
  if (toClassify.length === 0) {
    console.log('✅ Nenhuma questão para classificar!')
    return
  }
  
  // Process in batches to avoid rate limits
  const BATCH_SIZE = 5
  const DELAY_MS = 500 // ms between batches
  
  let processed = 0
  let errors = 0
  const stats = {}
  SPECIALTIES.forEach(s => stats[s] = 0)
  
  for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
    const batch = toClassify.slice(i, i + BATCH_SIZE)
    
    console.log(`\n🔄 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toClassify.length / BATCH_SIZE)} (${batch.length} questões)`)
    
    const promises = batch.map(async (q) => {
      try {
        const newSpecialty = await classifySpecialty(q.question_text)
        await new Promise(r => setTimeout(r, 200)) // Small delay within batch
        
        stats[newSpecialty]++
        
        if (!DRY_RUN) {
          await updateSpecialty(q.id, newSpecialty)
        }
        
        processed++
        const label = newSpecialty === 'Geral' ? '🔵' : '🟢'
        console.log(`   ${label} ${q.source_title?.substring(0, 40) || 'sem título'} → ${newSpecialty}`)
      } catch (err) {
        errors++
        console.error(`   ❌ Erro na questão ${q.id}: ${err.message}`)
      }
    })
    
    await Promise.all(promises)
    
    // Rate limit delay between batches
    if (i + BATCH_SIZE < toClassify.length) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }
  
  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('📊 RESUMO DA CLASSIFICAÇÃO')
  console.log('═'.repeat(60))
  console.log(`   Total processado: ${processed}`)
  console.log(`   Erros: ${errors}`)
  console.log('\n   Por especialidade:')
  Object.entries(stats)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([specialty, count]) => {
      const bar = '█'.repeat(Math.min(count, 40))
      console.log(`   ${specialty.padEnd(22)} ${count.toString().padStart(4)} ${bar}`)
    })
  
  if (DRY_RUN) {
    console.log('\n⚠️  MODO DRY-RUN — Nenhuma alteração foi feita ao banco.')
    console.log('   Execute sem --dry-run para aplicar as mudanças.')
  } else {
    console.log('\n✅ Classificação concluída e salva no banco!')
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
