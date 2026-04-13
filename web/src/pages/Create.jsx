import { useState } from 'react'
import { marked } from 'marked'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildPostMetadata, readImagePreview, uploadPostImage, validateImageFile } from '../lib/postImages'
import { useAuth } from '../contexts/AuthContext'

const C = {
  bg: '#001a2b',
  bgDeep: '#002233',
  glass: 'rgba(192,214,234,0.07)',
  glassHover: 'rgba(192,214,234,0.13)',
  glassBorder: 'rgba(192,214,234,0.15)',
  border: 'rgba(192,214,234,0.1)',
  text: '#F6F2E8',
  textSoft: '#C0D6EA',
  textMuted: '#8ba8c4',
  textDim: '#5a7d9a',
  accent: '#DDFF55',
  accentGlow: 'rgba(221,255,85,0.15)',
  accentSoft: 'rgba(221,255,85,0.08)',
  green: '#5ef0b0',
  greenGlow: 'rgba(94,240,176,0.15)',
  blue: '#7ecbff',
  blueGlow: 'rgba(126,203,255,0.15)',
}

const DEFAULT_API = 'https://aria-backend-production-176b.up.railway.app'

function getApiBaseUrl(rawUrl) {
  const fallback = DEFAULT_API
  if (!rawUrl) return fallback

  const normalized = rawUrl.trim().replace(/\/+$/, '')
  if (!normalized) return fallback

  return normalized.replace(/\/chat$/i, '')
}

const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const qs = new URLSearchParams(window.location.search)
    return getApiBaseUrl(qs.get('api') || window.ARIA_API_URL || import.meta.env.VITE_ARIA_API || DEFAULT_API)
  }
  return getApiBaseUrl(import.meta.env.VITE_ARIA_API || DEFAULT_API)
})()

marked.setOptions({ breaks: true, gfm: true })

function EX({ color = C.accent, size = 14 }) {
  return (
    <span style={{ color, fontWeight: 800, fontStyle: 'italic' }}>
      <span style={{ fontSize: size * 0.85 }}>e</span>
      <span style={{ fontSize: size * 1.12, fontWeight: 900 }}>X</span>
    </span>
  )
}

// ── Parse questions from generated text ──────────────────────────────────────
function parseQuestions(text) {
  // Match blocks starting with **QUESTÃO N:**
  const blocks = text.split(/(?=\*\*QUESTÃO \d+:)/)
  return blocks
    .map(block => {
      const headerMatch = block.match(/^\*\*QUESTÃO (\d+):\*\*(.+?)(?=\n[A-D]\))/s)
      if (!headerMatch) return null
      const num = headerMatch[1]
      const rest = headerMatch[2].trim()
      const altMatch = block.match(/([A-D])\)\s*(.+?)(?=\n[A-D]\)|$)/gs)
      const options = []
      let correctLetter = ''
      let explanation = ''
      let fonte = ''
      if (altMatch) {
        altMatch.forEach(m => {
          const inner = m.match(/^([A-D])\)\s*(.+)/s)
          if (inner) options.push({ letter: inner[1], text: inner[2].trim() })
        })
      }
      const correctMatch = block.match(/\*\*Resposta Correta:\*\*\s*([A-D])/i)
      if (correctMatch) correctLetter = correctMatch[1].toUpperCase()
      const expMatch = block.match(/\*\*Explicação:\*\*\s*([\s\S]+?)(?=\n\*\*Fonte:|$)/i)
      if (expMatch) explanation = expMatch[1].trim()
      const fonteMatch = block.match(/\*\*Fonte:\*\*\s*(.+)/i)
      if (fonteMatch) fonte = fonteMatch[1].trim()
      if (options.length === 4) {
        return { num, statement: rest, options, correctLetter, explanation, fonte }
      }
      return null
    })
    .filter(Boolean)
}

// ── Question Card ─────────────────────────────────────────────────────────────
function QuestionCard({ q, index }) {
  const [revealed, setRevealed] = useState(false)
  const correct = q.options.find(o => o.letter === q.correctLetter)
  return (
    <div style={{
      background: C.glass,
      border: `1px solid ${C.glassBorder}`,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <div style={{
          background: 'rgba(126,203,255,0.12)',
          border: '1px solid rgba(126,203,255,0.25)',
          borderRadius: 8,
          padding: '3px 10px',
          fontSize: 12,
          fontWeight: 700,
          color: C.blue,
          flexShrink: 0,
        }}>
          {q.num}
        </div>
        <p style={{ color: C.text, fontSize: 14, lineHeight: 1.55, margin: 0 }}>
          {q.statement}
        </p>
      </div>
      {/* Options */}
      <div style={{ padding: '12px 18px 12px' }}>
        {q.options.map(opt => {
          const isCorrect = opt.letter === q.correctLetter
          const bg = revealed && isCorrect
            ? 'rgba(94,240,176,0.1)'
            : revealed && !isCorrect
            ? 'rgba(255,107,107,0.05)'
            : 'transparent'
          const border = revealed && isCorrect
            ? 'rgba(94,240,176,0.35)'
            : revealed && !isCorrect
            ? 'rgba(255,107,107,0.2)'
            : `1px solid ${C.border}`
          const color = revealed && isCorrect ? C.green : C.textSoft
          const prefix = revealed && isCorrect ? '✓ ' : revealed && !isCorrect ? '✗ ' : ''
          return (
            <div key={opt.letter} style={{
              padding: '8px 12px',
              borderRadius: 8,
              border,
              background: bg,
              marginBottom: 6,
              display: 'flex',
              gap: 8,
            }}>
              <span style={{ color, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{prefix}{opt.letter})</span>
              <span style={{ color, fontSize: 13, lineHeight: 1.5 }}>{opt.text}</span>
            </div>
          )
        })}
        {revealed && correct && (
          <div style={{
            marginTop: 10,
            padding: '10px 14px',
            background: 'rgba(94,240,176,0.06)',
            border: `1px solid rgba(94,240,176,0.2)`,
            borderRadius: 8,
          }}>
            <p style={{ color: C.green, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              ✓ Explicação:
            </p>
            <p style={{ color: C.textSoft, fontSize: 12, lineHeight: 1.55, margin: 0 }}>
              {q.explanation}
            </p>
            {q.fonte && (
              <p style={{ color: C.textDim, fontSize: 11, marginTop: 4, marginBottom: 0 }}>
                {q.fonte}
              </p>
            )}
          </div>
        )}
      </div>
      {!revealed && (
        <div style={{ padding: '0 18px 14px' }}>
          <button
            onClick={() => setRevealed(true)}
            style={{
              background: 'rgba(126,203,255,0.08)',
              border: `1px solid rgba(126,203,255,0.2)`,
              borderRadius: 8,
              padding: '6px 16px',
              color: C.blue,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Revelar Resposta
          </button>
        </div>
      )}
    </div>
  )
}

// ── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ content, topic, template, typeLabel, imagePreview, onClose, onPublish, publishing, visibility, onVisibilityChange }) {
  const html = marked.parse(content || '')
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,10,20,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: C.bgDeep,
        border: `1px solid ${C.glassBorder}`,
        borderRadius: 20,
        width: '100%',
        maxWidth: 680,
        maxHeight: '85vh',
        overflow: 'auto',
        padding: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: 'rgba(126,203,255,0.1)', border: '1px solid rgba(126,203,255,0.2)', borderRadius: 6, padding: '2px 8px' }}>
                Preview
              </span>
              <span style={{ fontSize: 13, color: C.textDim }}>Como aparecerá na comunidade</span>
            </div>
            <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700, margin: 0 }}>
              {topic}
            </h2>
            <p style={{ color: C.textMuted, fontSize: 12, marginTop: 4, marginBottom: 0 }}>
              {typeLabel} • <EX size={12} />perience
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: C.textMuted,
            fontSize: 18, lineHeight: 1, fontFamily: 'inherit',
          }}>×</button>
        </div>
        {/* Preview card */}
        <div style={{
          background: C.glass, border: `1px solid ${C.glassBorder}`,
          borderRadius: 14, padding: 20, marginBottom: 20,
        }}>
          {imagePreview && <img src={imagePreview} alt='Prévia da capa' style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, marginBottom: 14, border: `1px solid ${C.glassBorder}` }} />}
          <p style={{ color: C.textSoft, fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
            {content}
          </p>
        </div>
        {/* Visibilidade */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Visibilidade:</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'public', l: 'Público' }, { v: 'private', l: 'Somente eu' }].map((opt) => (
              <button key={opt.v} onClick={() => onVisibilityChange(opt.v)} style={{
                padding: '6px 14px', borderRadius: 8,
                border: `1px solid ${visibility === opt.v ? 'rgba(94,240,176,0.35)' : C.border}`,
                background: visibility === opt.v ? 'rgba(94,240,176,0.1)' : 'transparent',
                color: visibility === opt.v ? C.green : C.textMuted,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {opt.v === 'public' ? '\u{1F310}' : '\u{1F512}'} {opt.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '10px 20px', cursor: 'pointer',
            color: C.textMuted, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}>Cancelar</button>
          <button onClick={onPublish} disabled={publishing} style={{
            background: C.green, border: 'none', borderRadius: 10,
            padding: '10px 24px', cursor: publishing ? 'not-allowed' : 'pointer',
            color: C.bgDeep, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            opacity: publishing ? 0.7 : 1,
          }}>
            {publishing ? 'Publicando...' : '✅ Publicar na Comunidade'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Create Page ─────────────────────────────────────────────────────────
function SlideRenderer({ content }) {
  const slides = content.split(/(?=## SLIDE \d+|## SLIDE)/i).filter(s => s.trim())
  if (slides.length < 2) return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: C.textSoft, lineHeight: 1.7 }}>{content}</pre>
  
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {slides.map((slide, i) => {
        const lines = slide.trim().split('\n')
        const titleLine = lines[0] || ''
        const title = titleLine.replace(/^#+\s*/, '').replace(/\*\*/g, '')
        const body = lines.slice(1).join('\n').trim()
        return (
          <div key={i} style={{
            background: 'linear-gradient(135deg, #0a1628, #0d1f3c)',
            border: '1px solid ' + C.glassBorder,
            borderRadius: 14,
            padding: '20px 24px',
            minHeight: 120,
          }}>
            <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Slide {i + 1}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 12 }}>{title}</div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: C.textSoft, lineHeight: 1.7, fontFamily: 'inherit', margin: 0 }}>{body}</pre>
          </div>
        )
      })}
    </div>
  )
}

export default function Create() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [topic, setTopic] = useState('')
  const [template, setTemplate] = useState('script') // 'script' | 'questoes'
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [visibility, setVisibility] = useState("public")
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [aiImage, setAiImage] = useState('')
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [specialty, setSpecialty] = useState('')
  const [level, setLevel] = useState('')

  const typeLabel = template === 'script' ? 'Script de Aula' : 'Questões de Estudo'

  const questions = template === 'questoes' ? parseQuestions(generatedContent) : []

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Digite um tema para gerar o conteúdo.')
      return
    }
    setGenerating(true)
    setError('')
    setGeneratedContent('')
    setEditedContent('')
    setAiImage('')
    setPublishSuccess(false)

    try {
      const endpoint = `${API_BASE_URL}/criar/${template}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), template, top_k: 10, ...(specialty ? { specialty } : {}), ...(level ? { level } : {}) }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Erro ${res.status}`)
      }
      const data = await res.json()
      setGeneratedContent(data.content || '')
      setEditedContent(data.content || '')
      setAiImage(data.image_url || '')
    } catch (e) {
      console.error('Generate error:', e)
      setError(`Erro ao gerar conteúdo: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handlePublish = async () => {
    if (!user) return
    setPublishing(true)
    try {
      const postTypeMap = { script: 'aula', slides: 'slides', mapa_mental: 'mapa_mental', tabela: 'tabela', questoes: 'questoes', caso_clinico: 'caso_clinico' }
      const postType = postTypeMap[template] || template
      let imageUrl = null
      if (imageFile) imageUrl = await uploadPostImage(imageFile, user.id)
      const { error: err } = await supabase.from('posts').insert({
        user_id: user.id,
        title: `${topic.trim()} — ${typeLabel}`,
        content: editedContent,
        type: postType,
        status: 'published',
        is_agent: false,
        visibility,
        metadata: buildPostMetadata({
          template,
          topic: topic.trim(),
        }, imageUrl),
      })
      if (err) throw err
      setPublishSuccess(true)
      setShowPreview(false)
      setTimeout(() => navigate('/feed'), 1500)
    } catch (e) {
      console.error('Publish error:', e)
      setError(`Erro ao publicar: ${e.message}`)
    } finally {
      setPublishing(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!user) return
    setPublishing(true)
    try {
      const postTypeMap = { script: 'aula', slides: 'slides', mapa_mental: 'mapa_mental', tabela: 'tabela', questoes: 'questoes', caso_clinico: 'caso_clinico' }
      const postType = postTypeMap[template] || template
      let imageUrl = null
      if (imageFile) imageUrl = await uploadPostImage(imageFile, user.id)
      const { error: err } = await supabase.from('posts').insert({
        user_id: user.id,
        title: `${topic.trim()} — ${typeLabel} (rascunho)`,
        content: editedContent,
        type: postType,
        status: 'draft',
        is_agent: false,
        visibility,
        metadata: buildPostMetadata({
          template,
          topic: topic.trim(),
        }, imageUrl),
      })
      if (err) throw err
      setPublishSuccess(true)
      setError('')
      setTimeout(() => navigate('/feed'), 1200)
    } catch (e) {
      console.error('Draft error:', e)
      setError(`Erro ao salvar rascunho: ${e.message}`)
    } finally {
      setPublishing(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(0,26,43,0.6)',
    border: `1px solid ${C.glassBorder}`,
    borderRadius: 10,
    padding: '11px 14px',
    color: C.text,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  const glassCard = {
    background: C.glass,
    border: `1px solid ${C.glassBorder}`,
    borderRadius: 16,
    padding: '24px',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg}}
        textarea{resize:vertical}
        input:focus, textarea:focus, button:focus { outline: none; }
      `}</style>

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(0,26,43,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textMuted }}>
            <EX size={13} />perience
          </span>
          <span style={{ color: C.border }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            StudyLab — Criar
          </span>
        </div>
        <button
          onClick={() => navigate('/feed')}
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '6px 14px',
            color: C.textMuted,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Feed
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, rgba(126,203,255,0.15), rgba(126,203,255,0.05))',
              border: '1px solid rgba(126,203,255,0.25)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#7ecbff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
              <EX size={22} /> StudyLab
            </h1>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim, background: 'rgba(192,214,234,0.06)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px' }}>
              Beta
            </span>
          </div>
          <p style={{ color: C.textMuted, fontSize: 14 }}>
            Gere scripts de aula e questões de estudo com IA usando a base de conhecimento de Radiologia.
          </p>
        </div>

        {/* INPUT SECTION */}
        <div style={{ ...glassCard, marginBottom: 20 }}>
          <label style={{ display: 'block', color: C.textSoft, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Tema da aula ou questão
          </label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Ex: Lesões benignas do fígado nos exames de imagem para R2"
            rows={3}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
            style={{
              ...inputStyle,
              minHeight: 80,
              resize: 'vertical',
            }}
          />
          <p style={{ color: C.textDim, fontSize: 11, marginTop: 6 }}>
            Pressione Ctrl+Enter para gerar rapidamente
          </p>

          {/* Template selector */}
          <div style={{ marginTop: 18 }}>
            <label style={{ display: 'block', color: C.textSoft, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Imagem da publicação (opcional)
            </label>
            <input
              type='file'
              accept='image/jpeg,image/png,image/webp,image/gif'
              onChange={async (e) => {
                const file = e.target.files?.[0] || null
                try {
                  setError('')
                  validateImageFile(file)
                  setImageFile(file)
                  setImagePreview(file ? await readImagePreview(file) : '')
                } catch (err) {
                  setImageFile(null)
                  setImagePreview('')
                  setError(err.message || 'Imagem inválida.')
                }
              }}
              style={inputStyle}
            />
            {imagePreview && <img src={imagePreview} alt='Prévia' style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, marginTop: 12, border: `1px solid ${C.glassBorder}` }} />}
          </div>

          <div style={{ marginTop: 18 }}>
            <label style={{ display: 'block', color: C.textSoft, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Tipo de conteúdo
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { value: 'script', label: '📝 Script de Aula', desc: 'Aula estruturada completa', color: C.blue, glow: C.blueGlow },
                { value: 'slides', label: '📊 Slides', desc: '6-12 slides didáticos', color: C.blue, glow: C.blueGlow },
                { value: 'mapa_mental', label: '🧠 Mapa Mental', desc: 'Hierarquia visual', color: '#b388ff', glow: 'rgba(179,136,255,0.12)' },
                { value: 'tabela', label: '📋 Tabela', desc: 'Comparação por modalidade', color: '#ffd166', glow: 'rgba(255,209,102,0.12)' },
                { value: 'questoes', label: '❓ Questões', desc: '5 questões múltipla escolha', color: C.green, glow: C.greenGlow },
                { value: 'caso_clinico', label: '🔬 Caso Clínico', desc: 'Caso completo para apresentação', color: '#ff6b6b', glow: 'rgba(255,107,107,0.12)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTemplate(opt.value)}
                  style={{
                    background: template === opt.value ? opt.glow : 'transparent',
                    border: `1px solid ${template === opt.value ? opt.color : C.border}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ color: template === opt.value ? opt.color : C.textSoft, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                    {opt.label}
                  </div>
                  <div style={{ color: C.textDim, fontSize: 11 }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Specialty and Level */}
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', color: C.textSoft, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Especialidade (opcional)
                </label>
                <select value={specialty} onChange={e => setSpecialty(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Todas</option>
                  <option value="Mama">Mama</option>
                  <option value="Abdome">Abdome</option>
                  <option value="Tórax">Tórax</option>
                  <option value="Neuroimagem">Neuroimagem</option>
                  <option value="Músculo Esquelético">Músculo Esquelético</option>
                  <option value="Pediatria">Pediatria</option>
                  <option value="Urgência">Urgência</option>
                  <option value="Vascular">Vascular</option>
                  <option value="Obstetrícia">Obstetrícia</option>
                  <option value="Cabeça e Pescoço">Cabeça e Pescoço</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: C.textSoft, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Nível (opcional)
                </label>
                <select value={level} onChange={e => setLevel(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Todos</option>
                  <option value="R1">R1 — Residente 1º ano</option>
                  <option value="R2">R2 — Residente 2º ano</option>
                  <option value="R3">R3 — Residente 3º ano</option>
                  <option value="R4">R4 — Residente 4º ano</option>
                  <option value="staff">Staff — Especialista</option>
                </select>
              </div>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            style={{
              marginTop: 18,
              width: '100%',
              background: generating
                ? 'rgba(221,255,85,0.08)'
                : topic.trim()
                ? 'linear-gradient(135deg, #DDFF55, #b8ff33)'
                : 'rgba(192,214,234,0.05)',
              border: generating
                ? '1px solid rgba(221,255,85,0.2)'
                : topic.trim()
                ? '1px solid rgba(221,255,85,0.5)'
                : `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '13px 20px',
              cursor: generating ? 'not-allowed' : 'pointer',
              color: generating ? C.textMuted : (topic.trim() ? C.bgDeep : C.textDim),
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? (
              <>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid rgba(192,214,234,0.2)',
                  borderTop: '2px solid #DDFF55',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                Gerando com ARIA...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" fill={C.bgDeep} stroke={C.bgDeep} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Gerar
              </>
            )}
          </button>

          {error && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              background: 'rgba(255,107,107,0.08)',
              border: '1px solid rgba(255,107,107,0.25)',
              borderRadius: 8,
              color: '#ff8080',
              fontSize: 12,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* OUTPUT SECTION */}
        {generatedContent && (
          <div style={{ ...glassCard }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28,
                  background: template === 'script' ? C.blueGlow : C.greenGlow,
                  border: `1px solid ${template === 'script' ? 'rgba(126,203,255,0.3)' : 'rgba(94,240,176,0.3)'}`,
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 14 }}>
                    {{ script: '📝', slides: '📊', mapa_mental: '🧠', tabela: '📋', questoes: '❓', caso_clinico: '🔬' }[template] || '📝'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    {typeLabel} gerado
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim }}>
                    Você pode editar antes de publicar
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSaveDraft}
                  disabled={publishing}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: '7px 14px',
                    cursor: publishing ? 'not-allowed' : 'pointer',
                    color: C.textMuted,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    opacity: publishing ? 0.5 : 1,
                  }}
                >
                  Salvar rascunho
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  style={{
                    background: C.green,
                    border: 'none',
                    borderRadius: 8,
                    padding: '7px 16px',
                    cursor: 'pointer',
                    color: C.bgDeep,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                >
                  Publicar na Comunidade →
                </button>
              </div>
            </div>

            {aiImage && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Visualização gerada por IA</div>
                <img src={aiImage} alt="Gerado por IA" style={{ width: '100%', borderRadius: 12, border: '1px solid ' + C.glassBorder, maxHeight: 500, objectFit: 'contain' }} />
              </div>
            )}
            {/* Editable content */}
            {template === 'script' ? (
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                rows={20}
                style={{
                  ...inputStyle,
                  minHeight: 400,
                  fontSize: 13,
                  lineHeight: 1.65,
                  fontFamily: "'Courier New', monospace",
                  whiteSpace: 'pre-wrap',
                }}
              />
            ) : ['slides', 'mapa_mental', 'tabela', 'caso_clinico'].includes(template) ? (
              <div>
                <SlideRenderer content={editedContent} />
                <textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  rows={8}
                  style={{
                    ...inputStyle,
                    marginTop: 16,
                    minHeight: 200,
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontFamily: "'Courier New', monospace",
                    opacity: 0.7,
                  }}
                />
              </div>
            ) : (
              <div>
                {questions.length > 0 ? (
                  questions.map((q, i) => (
                    <QuestionCard key={i} q={q} index={i} />
                  ))
                ) : (
                  /* Fallback: show raw content if parsing fails */
                  <textarea
                    value={editedContent}
                    onChange={e => setEditedContent(e.target.value)}
                    rows={15}
                    style={{
                      ...inputStyle,
                      minHeight: 300,
                      fontSize: 13,
                      lineHeight: 1.65,
                      fontFamily: "'Courier New', monospace",
                    }}
                  />
                )}
                {questions.length === 0 && (
                  <p style={{ color: C.textDim, fontSize: 12, marginTop: 10 }}>
                    As questões foram geradas. Reveja cada card acima.
                  </p>
                )}
              </div>
            )}

            {publishSuccess && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'rgba(94,240,176,0.08)',
                border: '1px solid rgba(94,240,176,0.25)',
                borderRadius: 8,
                color: C.green,
                fontSize: 12,
                textAlign: 'center',
              }}>
                ✓ Conteúdo publicado! Redirecionando para o feed...
              </div>
            )}
          </div>
        )}

        {generating && (
          <div style={{ ...glassCard, textAlign: 'center', padding: '40px 24px' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid rgba(192,214,234,0.1)',
              borderTop: '3px solid #DDFF55',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ color: C.textSoft, fontSize: 14, fontWeight: 600 }}>
              ARIA está gerando conteúdo...
            </p>
            <p style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>
              Buscando na base de conhecimento de Radiologia
            </p>
          </div>
        )}

      </div>

      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal
          content={editedContent}
          topic={topic}
          template={template}
          typeLabel={typeLabel}
          imagePreview={imagePreview}
          onClose={() => setShowPreview(false)}
          onPublish={handlePublish}
          publishing={publishing}
          visibility={visibility}
          onVisibilityChange={setVisibility}
        />
      )}
    </div>
  )
}
