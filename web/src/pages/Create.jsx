import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import { useNavigate, useLocation } from 'react-router-dom'
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
  if (!text) return []
  // Match blocks starting with **QUESTÃO N:**
  const blocks = text.split(/(?=\*\*QUESTÃO \d+:)/)
  return blocks
    .map(block => {
      const headerMatch = block.match(/^\*\*QUESTÃO (\d+):\*\*(.+?)(?=\n[A-D]\))/s)
      if (!headerMatch) return null
      const num = headerMatch[1]
      const rest = headerMatch[2].trim()

      // Fixed: consume all content between \nX) and \nY) or end markers, handling blank lines between options
      const optMatches = []
      const optIter = block.matchAll(/\n([A-D])\)\s*([\s\S]*?)(?=\n[A-D]\)\s*|\n\*\*Resposta|\n\*\*Fonte|$)/g)
      for (const m of optIter) {
        let content = m[2].trim()
        // Strip any stray **Resposta** or **Fonte** that got captured
        content = content.replace(/\*\*Resposta[^:]*:\s*/i, '').replace(/\*\*Fonte:\s*/i, '').trim()
        optMatches.push({ letter: m[1], text: content })
      }
      const options = optMatches

      let correctLetter = ''
      const correctMatch = block.match(/\*\*Resposta Correta:\*\*\s*([A-D])/i)
      if (correctMatch) correctLetter = correctMatch[1].toUpperCase()

      let explanation = ''
      const expMatch = block.match(/\*\*Explicação:\*\*\s*([\s\S]+?)(?=\n\*\*Fonte:|$)/i)
      if (expMatch) explanation = expMatch[1].trim()

      let fonte = ''
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
          const bg = revealed
            ? isCorrect
              ? 'rgba(94,240,176,0.1)'
              : 'rgba(255,107,107,0.05)'
            : 'transparent'
          const border = revealed
            ? isCorrect
              ? 'rgba(94,240,176,0.35)'
              : 'rgba(255,107,107,0.2)'
            : `1px solid ${C.border}`
          const color = revealed
            ? isCorrect
              ? C.green
              : C.textSoft
            : C.textSoft
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

// ── Mind Map Renderer ───────────────────────────────────────────────────────
function MindMapRenderer({ markdown }) {
  const [theme, setTheme] = useState('dark')
  const [density, setDensity] = useState('default')
  const [expandLevel, setExpandLevel] = useState(3)

  const densityOptions = {
    compact: { gap: 8, padY: 6, padX: 10, font: 12 },
    default: { gap: 10, padY: 8, padX: 12, font: 13 },
    airy: { gap: 14, padY: 10, padX: 14, font: 14 },
  }

  const surfaceBg = theme === 'dark' ? '#00131f' : '#f5fbff'
  const chipBg = theme === 'dark' ? 'rgba(126,203,255,0.08)' : 'rgba(0,26,43,0.04)'

  // Shared input style for selects inside this component
  const mmInputStyle = {
    background: theme === 'dark' ? 'rgba(0,26,43,0.6)' : 'rgba(255,255,255,0.9)',
    border: `1px solid ${theme === 'dark' ? 'rgba(179,136,255,0.25)' : 'rgba(126,203,255,0.22)'}`,
    borderRadius: 8,
    padding: '6px 10px',
    color: theme === 'dark' ? '#F6F2E8' : '#001a2b',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  }

  // Parse nodes from markdown — support headings AND list items
  const lines = (markdown || '').split('\n')
  const nodes = []
  let currentRoot = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Match headings: # ## ### etc
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      if (text) {
        nodes.push({ id: `h-${level}-${text}`, level, text, isHeading: true })
      }
      continue
    }

    // Match list items: - or * (non-heading)
    const listMatch = line.match(/^[-*]\s+(.*)$/)
    if (listMatch) {
      const text = listMatch[1].replace(/\*\*(.*?)\*\*/g, '$1').trim()
      if (text) {
        nodes.push({ id: `l-${text}`, level: (currentRoot?.level || 1) + 1, text, isHeading: false })
      }
      continue
    }

    // Plain text paragraph — treat as level-2 node
    if (line.length > 2 && !line.startsWith('!') && !line.startsWith('```')) {
      const clean = line.replace(/\*\*/g, '').replace(/^>\s*/, '').trim()
      if (clean && clean.length > 1) {
        nodes.push({ id: `p-${clean.substring(0, 20)}`, level: 2, text: clean, isHeading: false })
      }
    }
  }

  const visibleNodes = nodes.filter(node => node.level <= Number(expandLevel))

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        marginBottom: 12, padding: '12px 14px', borderRadius: 12,
        background: theme === 'dark' ? 'rgba(179,136,255,0.08)' : 'rgba(126,203,255,0.08)',
        border: `1px solid ${theme === 'dark' ? 'rgba(179,136,255,0.25)' : 'rgba(126,203,255,0.22)'}`,
      }}>
        <strong style={{ color: C.textSoft, fontSize: 12 }}>Preview do mapa</strong>
        <select value={theme} onChange={e => setTheme(e.target.value)} style={{ ...mmInputStyle, width: 140, padding: '8px 10px' }}>
          <option value='dark'>Tema escuro</option>
          <option value='light'>Tema claro</option>
        </select>
        <select value={density} onChange={e => setDensity(e.target.value)} style={{ ...mmInputStyle, width: 140, padding: '8px 10px' }}>
          <option value='compact'>Compacto</option>
          <option value='default'>Padrão</option>
          <option value='airy'>Espaçado</option>
        </select>
        <select value={expandLevel} onChange={e => setExpandLevel(Number(e.target.value))} style={{ ...mmInputStyle, width: 160, padding: '8px 10px' }}>
          <option value={1}>Mostrar nível 1</option>
          <option value={2}>Mostrar nível 2</option>
          <option value={3}>Mostrar nível 3</option>
          <option value={4}>Mostrar nível 4</option>
        </select>
        <span style={{ color: C.textDim, fontSize: 11 }}>{visibleNodes.length} nós</span>
      </div>

      <div style={{
        background: surfaceBg,
        border: `1px solid ${C.glassBorder}`,
        borderRadius: 16,
        minHeight: 260,
        padding: 14,
      }}>
        {!markdown || markdown.trim() === '' ? (
          <div style={{ color: C.textDim, fontSize: 12 }}>
            Digite a estrutura do mapa mental em markdown para ver o preview.
          </div>
        ) : visibleNodes.length === 0 ? (
          <div style={{ color: C.textDim, fontSize: 12 }}>
            Nenhum nó encontrado. Use headings (# título, ## subtítulo) ou listas (- item) no markdown.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: densityOptions[density].gap }}>
            {visibleNodes.map(node => (
              <div
                key={node.id}
                style={{
                  marginLeft: `${(node.level - 1) * 18}px`,
                  padding: `${densityOptions[density].padY}px ${densityOptions[density].padX}px`,
                  borderRadius: 12,
                  background: node.isHeading && node.level === 1
                    ? (theme === 'dark' ? 'rgba(221,255,85,0.08)' : 'rgba(0,26,43,0.05)')
                    : chipBg,
                  border: `1px solid ${node.isHeading && node.level === 1 ? 'rgba(221,255,85,0.25)' : C.glassBorder}`,
                  color: node.isHeading && node.level === 1 ? C.accent : (node.isHeading ? '#b388ff' : C.textSoft),
                  fontSize: densityOptions[density].font,
                  fontWeight: node.level <= 2 ? 700 : 500,
                  lineHeight: 1.45,
                }}
              >
                {node.isHeading && node.level === 1 ? '● ' : (node.isHeading ? '○ ' : '▸ ')}
                {node.text}
              </div>
            ))}
          </div>
        )}
      </div>
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

// ── ARIA Edit Panel (sliding side panel) ─────────────────────────────────────
function EditPanel({ onClose, topic, template, content, specialty, onApply }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const chatRef = useRef(null)
  const scrollDown = () => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }

  useEffect(() => { scrollDown() }, [messages, busy])

  const typeLabelMap = {
    script: 'Script de Aula', slides: 'Slides', mapa_mental: 'Mapa Mental',
    tabela: 'Tabela Comparativa', questoes: 'Questões de Estudo', caso_clinico: 'Caso Clínico',
  }
  const typeLabel = typeLabelMap[template] || template

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setBusy(true)
    setInput('')
    const userMsg = { role: 'user', text: q }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await fetch(`${getApiBaseUrl(API_BASE_URL)}/chat/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          content: content || '',
          template,
          topic: topic || '',
          top_k: 6,
          specialty: specialty || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMessages(prev => [...prev, { role: 'bot', text: `Erro: ${err.detail || 'Falha na conexão'}` }])
      } else {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'bot', text: data.answer, sources: data.sources || [] }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Não foi possível conectar ao servidor ARIA.' }])
    }
    setBusy(false)
  }

  const handleApply = (text) => {
    // Extract content after "EDITADO:" if present
    const match = text.match(/^EDITADO:\s*\n?([\s\S]*)$/i)
    const toApply = match ? match[1].trim() : text
    onApply(toApply)
  }

  const suggestions = [
    'Revise este conteúdo e corrija erros médicos',
    'Melhore a didática e clareza',
    'Traduza para formato de slides',
    'Verifique se os critérios diagnósticos estão corretos',
    'Expanda a seção de diagnóstico diferencial',
    'Ajude-me a transformar em mapa mental',
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,10,20,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Panel */}
      <div class="edit-panel" style={{
        width: '100%', maxWidth: 480,
        background: C.bgDeep,
        borderLeft: `1px solid ${C.glassBorder}`,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease',
        height: '100dvh',
        maxHeight: '100dvh',
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @media (max-width: 640px) {
            .edit-panel {
              maxWidth: 100% !important;
              border-left: none !important;
              border-radius: 0 !important;
            }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(0,26,43,0.8)',
        }}>
          <div style={{
            width: 34, height: 34,
            background: 'rgba(179,136,255,0.15)',
            border: '1px solid rgba(179,136,255,0.3)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>✏️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>✏️ Modo Edição — eX StudyLabs</div>
            <div style={{ fontSize: 11, color: C.textDim }}>
              Editando: {typeLabel} — {topic || 'Sem título'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '6px 10px',
            color: C.textMuted, fontSize: 16, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Context strip */}
        {content && (
          <div style={{
            padding: '8px 16px',
            background: 'rgba(179,136,255,0.05)',
            borderBottom: `1px solid rgba(179,136,255,0.15)`,
            fontSize: 11, color: C.textDim,
            maxHeight: 60, overflow: 'hidden',
          }}>
            📋 Conteúdo atual: {content.substring(0, 120).replace(/\n/g, ' ')}...
          </div>
        )}

        {/* Messages */}
        <div ref={chatRef} style={{
          flex: 1, overflowY: 'auto', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 10,
          scrollbarWidth: 'thin', scrollbarColor: 'rgba(192,214,234,0.15) transparent',
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: C.textMuted, padding: '20px 12px' }}>
              <p style={{ fontSize: 22, marginBottom: 6 }}>✏️</p>
              <p style={{ fontWeight: 700, color: C.text, marginBottom: 4, fontSize: 13 }}>Modo Edição — eX StudyLabs</p>
              <p style={{ fontSize: 12 }}>Pergunte como editar, revisar ou melhorar este conteúdo.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', padding: '12px 0 0' }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => { setInput(s); setBusy(true); setMessages(prev => [...prev, { role: 'user', text: s }]); send(); }} style={{
                    background: 'rgba(179,136,255,0.08)', border: '1px solid rgba(179,136,255,0.2)',
                    color: '#b388ff', padding: '5px 10px', borderRadius: 20,
                    fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: m.role === 'user' ? 'rgba(179,136,255,0.15)' : 'rgba(192,214,234,0.06)',
                border: m.role === 'user' ? '1px solid rgba(179,136,255,0.3)' : `1px solid ${C.border}`,
                color: C.text,
                fontSize: 13, lineHeight: 1.55,
              }}>
                {m.role === 'user' ? m.text : (
                  <>
                    {m.text.split('\n').map((line, j) => <span key={j}>{line}<br/></span>)}
                    {m.sources && m.sources.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textDim }}>
                        📚 Fontes: {m.sources.slice(0, 2).map((s, k) => <span key={k}> • {s.title}{s.page_start ? ` p.${s.page_start}` : ''}</span>)}
                      </div>
                    )}
                    {m.text.startsWith('EDITADO:') || /\nEDITADO:/i.test(m.text) ? (
                      <button onClick={() => handleApply(m.text)} style={{
                        marginTop: 10, background: 'rgba(179,136,255,0.15)',
                        border: '1px solid rgba(179,136,255,0.35)', borderRadius: 8,
                        padding: '7px 14px', cursor: 'pointer',
                        color: '#b388ff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        ✏️ Aplicar esta edição ao conteúdo
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div style={{ display: 'flex', gap: 4, padding: '4px 0', alignSelf: 'flex-start' }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, background: C.textDim, borderRadius: '50%', animation: 'chatblink 1.4s infinite both', animationDelay: `${i*0.2}s` }} />)}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 14px',
          borderTop: `1px solid ${C.border}`,
          background: 'rgba(0,34,51,0.5)',
          display: 'flex', gap: 8, alignItems: 'flex-end',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Peça para editar, revisar, expandir..."
            rows={2}
            style={{
              flex: 1, background: 'rgba(0,26,43,0.6)',
              border: `1px solid ${C.glassBorder}`, borderRadius: 10,
              padding: '9px 12px', color: C.text, fontSize: 13,
              fontFamily: 'inherit', resize: 'none', outline: 'none',
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            style={{
              background: (!input.trim() || busy) ? 'rgba(179,136,255,0.2)' : '#b388ff',
              border: 'none', borderRadius: 10,
              padding: '9px 14px', color: C.bgDeep,
              fontSize: 15, fontWeight: 700, cursor: (!input.trim() || busy) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
              transition: 'all 0.15s',
            }}
          >➤</button>
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
  const location = useLocation()

  // Load project from navigation state (Meus Projetos -> Editar) or sessionStorage backup
  useEffect(() => {
    const { state } = location
    let project = state?.project

    // Fallback: try sessionStorage if no state passed (handles page refresh after navigation)
    if (!project) {
      try {
        const stored = sessionStorage.getItem('restoreProject')
        if (stored) {
          project = JSON.parse(stored)
          sessionStorage.removeItem('restoreProject')
        }
      } catch (_) {}
    }

    if (project) {
      // Backup to sessionStorage in case navigation state is lost on refresh
      try { sessionStorage.setItem('restoreProject', JSON.stringify(project)) } catch (_) {}

      const p = project
      if (p.title) setTopic(p.title)
      else if (p.topic) setTopic(p.topic)
      if (p.type) setTemplate(p.type)
      if (p.content) {
        setEditedContent(p.content)
        setGeneratedContent(p.content) // needed to show output section on reload
      }
      if (p.specialty) setSpecialty(p.specialty)
      if (p.level) setLevel(p.level)
      // Clear the state so a refresh doesn't reload the same project
      navigate(location.pathname, { replace: true })
    }
  }, [location])

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
  const [savingProject, setSavingProject] = useState(false)
  const [copyConfirm, setCopyConfirm] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)

  const typeLabelMap = {
    script: 'Script de Aula',
    slides: 'Slides',
    mapa_mental: 'Mapa Mental',
    tabela: 'Tabela Comparativa',
    questoes: 'Questões de Estudo',
    caso_clinico: 'Caso Clínico',
  }
  const typeLabel = typeLabelMap[template] || 'Conteúdo'

  const questions = template === 'questoes' ? parseQuestions(editedContent || generatedContent) : []

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

  const handleSaveProject = async () => {
    if (!user || !generatedContent) return
    setSavingProject(true)
    try {
      const project = {
        localId: `study_${Date.now()}`,
        userId: user.id,
        title: topic.trim(),
        content: editedContent,
        type: template,
        specialty,
        level,
        created_at: new Date().toISOString(),
      }
      const existing = JSON.parse(localStorage.getItem('studyProjects') || '[]')
      existing.push(project)
      localStorage.setItem('studyProjects', JSON.stringify(existing))
      setSavingProject(false)
      navigate('/meus-projetos')
    } catch (e) {
      console.error('Save project error:', e)
      setSavingProject(false)
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
        @media (min-width: 640px) {
          .mobile-stack { flex-direction: row !important; }
          .template-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .page-padding { padding: 20px 14px 60px !important; }
        }
        @media (max-width: 480px) {
          .template-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 6px !important; }
          .specialty-row { flex-direction: column !important; gap: 8px !important; }
          .output-actions { flex-direction: column !important; }
          .output-actions button { width: 100% !important; }
        }
      `}</style>

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(0,26,43,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '0 14px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate('/feed')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 4px',
            color: C.textMuted,
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'inherit',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>
            <EX size={12} />perience
          </span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.textDim,
            background: 'rgba(192,214,234,0.05)',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '2px 8px',
          }}>
            ✏️ Modo Edição
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.accent,
            background: C.accentSoft,
            border: `1px solid rgba(221,255,85,0.2)`,
            borderRadius: 6,
            padding: '2px 8px',
          }}>
            eX StudyLabs
          </span>
        </div>
      </div>

      <div class="page-padding" style={{ maxWidth: 800, margin: '0 auto', padding: '20px 14px 80px' }}>

        {/* Page header — compact mobile */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, rgba(126,203,255,0.15), rgba(126,203,255,0.05))',
              border: '1px solid rgba(126,203,255,0.25)',
              borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#7ecbff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
              <EX size={18} /> StudyLab
            </h1>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, background: 'rgba(192,214,234,0.05)', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 7px' }}>
              Beta
            </span>
          </div>
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
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
            style={{
              ...inputStyle,
              minHeight: 64,
              resize: 'vertical',
            }}
          />
          <p style={{ color: C.textDim, fontSize: 11, marginTop: 5 }}>
            Ctrl+Enter pra gerar rápido
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
            <div class="template-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {[
                { value: 'script', label: '📝 Script', desc: 'Aula completa', color: C.blue, glow: C.blueGlow },
                { value: 'slides', label: '📊 Slides', desc: '6-12 slides', color: C.blue, glow: C.blueGlow },
                { value: 'mapa_mental', label: '🧠 Mapa', desc: 'Hierarquia visual', color: '#b388ff', glow: 'rgba(179,136,255,0.12)' },
                { value: 'tabela', label: '📋 Tabela', desc: 'Comparação', color: '#ffd166', glow: 'rgba(255,209,102,0.12)' },
                { value: 'questoes', label: '❓ Questões', desc: '5 questões MC', color: C.green, glow: C.greenGlow },
                { value: 'caso_clinico', label: '🔬 Caso', desc: 'Caso clínico', color: '#ff6b6b', glow: 'rgba(255,107,107,0.12)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTemplate(opt.value)}
                  style={{
                    background: template === opt.value ? opt.glow : 'transparent',
                    border: `1px solid ${template === opt.value ? opt.color : C.border}`,
                    borderRadius: 10,
                    padding: '10px 8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ color: template === opt.value ? opt.color : C.textSoft, fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                    {opt.label}
                  </div>
                  <div style={{ color: C.textDim, fontSize: 10 }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Specialty and Level */}
            <div class="specialty-row" style={{ marginTop: 14, display: 'flex', flexDirection: 'row', gap: 10 }}>
              <div style={{ flex: 1 }}>
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
              marginTop: 14,
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
              padding: '12px 20px',
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
              <div class="output-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Copy button */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(editedContent).then(() => {
                      setCopyConfirm(true)
                      setTimeout(() => setCopyConfirm(false), 2000)
                    })
                  }}
                  style={{
                    background: 'rgba(126,203,255,0.08)',
                    border: `1px solid rgba(126,203,255,0.25)`,
                    borderRadius: 8,
                    padding: '7px 12px',
                    cursor: 'pointer',
                    color: copyConfirm ? '#5ef0b0' : '#7ecbff',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.2s',
                    flex: '1 1 auto',
                  }}
                >
                  {copyConfirm ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copiado!</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar</>
                  )}
                </button>
                {/* Export button */}
                <button
                  onClick={() => {
                    const blob = new Blob([editedContent], { type: 'text/markdown' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${(topic || 'projeto').replace(/[^a-zA-Z0-9]/g, '_')}.md`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{
                    background: 'rgba(221,255,85,0.08)',
                    border: `1px solid rgba(221,255,85,0.25)`,
                    borderRadius: 8,
                    padding: '7px 12px',
                    cursor: 'pointer',
                    color: C.accent,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Exportar .md
                </button>
                <button
                  onClick={handleSaveProject}
                  disabled={!generatedContent || savingProject}
                  style={{
                    background: 'rgba(179,136,255,0.08)',
                    border: `1px solid rgba(179,136,255,0.25)`,
                    borderRadius: 8,
                    padding: '7px 14px',
                    cursor: (!generatedContent || savingProject) ? 'not-allowed' : 'pointer',
                    color: '#b388ff',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    opacity: (!generatedContent || savingProject) ? 0.5 : 1,
                    flex: '1 1 auto',
                  }}
                >
                  {savingProject ? 'Salvando...' : '💾 Salvar Projeto'}
                </button>
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
            ) : template === 'mapa_mental' ? (
              <div>
                <MindMapRenderer markdown={editedContent} />
                <textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  rows={10}
                  style={{
                    ...inputStyle,
                    minHeight: 220,
                    fontSize: 12,
                    lineHeight: 1.55,
                    fontFamily: "'Courier New', monospace",
                  }}
                />
                <p style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>
                  Edite o markdown do mapa mental e a visualização atualiza automaticamente.
                </p>
              </div>
            ) : ['slides', 'tabela', 'caso_clinico'].includes(template) ? (
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
