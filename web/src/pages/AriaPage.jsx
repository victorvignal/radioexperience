import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { marked } from 'marked'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const C = {
  bg: '#001a2b',
  bgDeep: '#002233',
  glass: 'rgba(192,214,234,0.07)',
  glassBorder: 'rgba(192,214,234,0.15)',
  border: 'rgba(192,214,234,0.1)',
  text: '#F6F2E8',
  textSoft: '#C0D6EA',
  textMuted: '#8ba8c4',
  textDim: '#5a7d9a',
  accent: '#DDFF55',
  accentGlow: 'rgba(221,255,85,0.15)',
  accentSoft: 'rgba(221,255,85,0.08)',
}

const ARIA_SESSIONS_CACHE_KEY = 'aria_sessions_cache_v1'
const ARIA_ACTIVE_ID_CACHE_KEY = 'aria_active_id_cache_v1'

function saveSessionsToCache(sessions, activeId) {
  try {
    const serialized = JSON.stringify(sessions.map(s => ({
      ...s,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    })))
    sessionStorage.setItem(ARIA_SESSIONS_CACHE_KEY, serialized)
    if (activeId != null) sessionStorage.setItem(ARIA_ACTIVE_ID_CACHE_KEY, String(activeId))
  } catch {}
}

function loadSessionsFromCache() {
  try {
    const raw = sessionStorage.getItem(ARIA_SESSIONS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed.map(s => ({
      ...s,
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
    }))
  } catch { return null }
}

function loadActiveIdFromCache() {
  try {
    const raw = sessionStorage.getItem(ARIA_ACTIVE_ID_CACHE_KEY)
    if (!raw) return null
    const num = Number(raw)
    return isNaN(num) ? raw : num
  } catch { return null }
}

function clearSessionsCache() {
  try {
    sessionStorage.removeItem(ARIA_SESSIONS_CACHE_KEY)
    sessionStorage.removeItem(ARIA_ACTIVE_ID_CACHE_KEY)
  } catch {}
}

const DEFAULT_API = 'https://aria-backend-production-176b.up.railway.app/chat'
const API_URL = (() => {
  if (typeof window !== 'undefined') {
    const qs = new URLSearchParams(window.location.search)
    return qs.get('api') || window.ARIA_API_URL || import.meta.env.VITE_ARIA_API || DEFAULT_API
  }
  return import.meta.env.VITE_ARIA_API || DEFAULT_API
})()

function EX({ color = C.accent, size = 14 }) {
  return (
    <span style={{ color, fontWeight: 800, fontStyle: 'italic' }}>
      <span style={{ fontSize: size * 0.85 }}>e</span>
      <span style={{ fontSize: size * 1.12, fontWeight: 900 }}>X</span>
    </span>
  )
}

function AriaIcon({ size = 20, color = C.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
      <path d="M10 22 Q16 10 22 22" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="16" r="3" fill={color} fillOpacity="0.9" />
      <circle cx="10" cy="22" r="1.5" fill={color} fillOpacity="0.6" />
      <circle cx="22" cy="22" r="1.5" fill={color} fillOpacity="0.6" />
    </svg>
  )
}

function IconPlus({ size = 16, color = C.bgDeep }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconTrash({ size = 14, color = C.textDim }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V3h4v1M5 4l1 9h4l1-9" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconEdit({ size = 14, color = C.textDim }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M10.9 2.6a1.5 1.5 0 1 1 2.1 2.1L6 11.7l-2.8.7.7-2.8 7-7Z" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.8 3.7l2.5 2.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Configure marked: no inline styles, clean output
marked.setOptions({
  breaks: true,
  gfm: true,
})

function renderMarkdown(text) {
  if (!text) return ''
  // Strip [Fonte: ...] references entirely
  let cleaned = text.replace(/\[Fonte:[^\]]*\]/gi, '')
  // Collapse extra blank lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  return marked.parse(cleaned)
}

const SUGGESTIONS = [
  'O que é BI-RADS?',
  'Anatomia da mama',
  'Técnica radiológica do tórax',
  'Categorias do BI-RADS',
]

function cleanTitle(raw) {
  return raw
    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Livro_/i, '')
    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Artigo_/i, '')
    .replace(/_Semautor_SemAno.*$/i, '')
    .replace(/_DUP\d+$/i, '')
    .replace(/_Revisar/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CHAT_META_ROLE = '__aria_meta__'
const DEFAULT_CHAT_TITLE = 'Nova conversa'

function buildAutoTitle(text, fallback = DEFAULT_CHAT_TITLE) {
  const normalized = (text || '').trim()
  if (!normalized) return fallback
  return normalized.length > 36 ? normalized.slice(0, 36) + '…' : normalized
}

function getVisibleMessages(messages = []) {
  return (messages || []).filter(m => m?.role !== CHAT_META_ROLE)
}

function getStoredChatMeta(messages = []) {
  return (messages || []).find(m => m?.role === CHAT_META_ROLE && typeof m?.title === 'string') || null
}

function upsertChatMeta(messages = [], patch = {}) {
  const visible = getVisibleMessages(messages)
  const existingMeta = getStoredChatMeta(messages)
  const nextMeta = {
    role: CHAT_META_ROLE,
    ...(existingMeta || {}),
    ...patch,
  }

  if (!nextMeta.title?.trim()) return visible
  return [...visible, nextMeta]
}

function getSessionTitleFromData({ title, messages, fallback = DEFAULT_CHAT_TITLE }) {
  const trimmedTitle = title?.trim()
  if (trimmedTitle) return trimmedTitle

  const metaTitle = getStoredChatMeta(messages)?.title?.trim()
  if (metaTitle) return metaTitle

  const firstUserMsg = getVisibleMessages(messages).find(m => m.role === 'user' && m.text)
  if (firstUserMsg?.text) return buildAutoTitle(firstUserMsg.text, fallback)

  return fallback
}

function getSessionMessageCount(messages = []) {
  return getVisibleMessages(messages).length
}

// ─── Chat panel ─────────────────────────────────────────────────────────────
function ChatPanel({ session, onFirstMessage }) {
  const [messages, setMessages] = useState(getVisibleMessages(session.messages))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState(null)   // { file, preview }
  const fileInputRef = useRef(null)
  const chatRef = useRef(null)

  // sync quando trocar de sessão
  useEffect(() => {
    setMessages(getVisibleMessages(session.messages))
    setInput('')
    setBusy(false)
    setImage(null)
  }, [session.id])

  // scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, busy])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImage({ file, preview: ev.target.result })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const send = async (text) => {
    const q = (text || input).trim()
    if ((!q && !image) || busy) return
    setBusy(true)
    setInput('')
    const sentImage = image
    setImage(null)
    const userMsg = { role: 'user', text: q, image: sentImage?.preview || null }
    const next = [...messages, userMsg]
    setMessages(next)
    onFirstMessage(session.id, next, q || '🖼 Imagem')

    try {
      // sempre JSON — imagem vai como base64 puro no campo image_base64
      const body = { question: q || 'Analise esta imagem e descreva os achados radiológicos.', top_k: 5 }
      if (sentImage?.preview) {
        // preview é data URL: "data:image/jpeg;base64,XXXX" — extrair só o XXXX
        const base64Pure = sentImage.preview.includes(',')
          ? sentImage.preview.split(',')[1]
          : sentImage.preview
        body.image_base64 = base64Pure
      }
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const final = [...next, { role: 'bot', text: `Erro: ${err.detail || 'Falha na conexão'}` }]
        setMessages(final)
        onFirstMessage(session.id, final, null)
      } else {
        const data = await res.json()
        const final = [...next, { role: 'bot', text: data.answer, sources: data.sources }]
        setMessages(final)
        onFirstMessage(session.id, final, null)
      }
    } catch {
      const final = [...next, { role: 'bot', text: 'Não foi possível conectar ao servidor ARIA.' }]
      setMessages(final)
      onFirstMessage(session.id, final, null)
    }
    setBusy(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* messages */}
      <div
        ref={chatRef}
        className="aria-messages"
        style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
          display: 'flex', flexDirection: 'column', gap: 12,
          scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent`,
        }}
      >
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16, padding: '40px 20px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: C.accentSoft,
              border: `1px solid rgba(221,255,85,0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AriaIcon size={32} color={C.accent} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 6 }}>ARIA</div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, maxWidth: 380 }}>
                Assistente de Radiologia por IA · Radio<EX />perience<br />
                Pergunte sobre anatomia, técnicas, patologias ou diagnóstico por imagem.
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 500 }}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  style={{
                    background: C.accentSoft,
                    border: '1px solid rgba(221,255,85,0.2)',
                    color: C.accent, padding: '8px 14px',
                    borderRadius: 20, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div className="aria-bubble" style={{
              maxWidth: '78%',
              padding: '11px 15px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              fontSize: 13.5, lineHeight: 1.65,
              whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal', wordWrap: 'break-word',
              background: m.role === 'user' ? C.accent : 'rgba(192,214,234,0.08)',
              color: m.role === 'user' ? C.bgDeep : C.text,
              border: m.role === 'user' ? 'none' : `1px solid ${C.border}`,
            }}>
              {m.image && (
                <img
                  src={m.image}
                  alt="anexo"
                  style={{
                    display: 'block', maxWidth: '100%', maxHeight: 260,
                    borderRadius: 10, marginBottom: m.text ? 8 : 0,
                    border: `1px solid rgba(0,26,43,0.3)`,
                  }}
                />
              )}
              {m.role === 'user' ? (
                m.text
              ) : (
                <div
                  className="aria-md"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
                />
              )}
              {m.sources && m.sources.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textDim }}>
                  <strong style={{ color: C.textMuted }}>📚 Fontes:</strong>
                  {m.sources.slice(0, 3).map((s, j) => {
                    const title = cleanTitle(s.title)
                    const pg = s.page_start ? ` (p. ${s.page_start}${s.page_end && s.page_end !== s.page_start ? `-${s.page_end}` : ''})` : ''
                    return <div key={j}>• {title}{pg}</div>
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div style={{ display: 'flex', gap: 4, padding: '10px 0', alignSelf: 'flex-start' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 7, height: 7, background: C.textDim, borderRadius: '50%',
                animation: 'chatblink 1.4s infinite both',
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* input */}
      <div className="aria-input-bar" style={{
        padding: '14px 20px',
        borderTop: `1px solid ${C.border}`,
        background: 'rgba(0,26,43,0.7)',
        backdropFilter: 'blur(16px)',
        flexShrink: 0,
      }}>
        {/* preview imagem */}
        {image && (
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={image.preview}
                alt="preview"
                style={{ height: 72, maxWidth: 180, borderRadius: 10, objectFit: 'cover', border: `1px solid rgba(221,255,85,0.3)` }}
              />
              <button
                onClick={() => setImage(null)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,26,43,0.9)', border: `1px solid ${C.glassBorder}`,
                  color: C.textMuted, fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
            <span style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
              {image.file.name}<br />
              <span style={{ color: C.textDim }}>{(image.file.size / 1024).toFixed(0)} KB</span>
            </span>
          </div>
        )}

        <div className="aria-input-row" style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'rgba(192,214,234,0.05)',
          border: `1px solid ${image ? 'rgba(221,255,85,0.25)' : C.glassBorder}`,
          borderRadius: 14, padding: '8px 8px 8px 12px',
          transition: 'border-color 0.2s',
        }}>
          {/* botão imagem */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Anexar imagem"
            style={{
              width: 34, height: 34, borderRadius: 9, border: 'none',
              background: image ? C.accentSoft : 'rgba(192,214,234,0.08)',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke={image ? C.accent : C.textMuted} strokeWidth="1.6" />
              <circle cx="8.5" cy="8.5" r="1.5" fill={image ? C.accent : C.textMuted} />
              <path d="M3 16l5-5 4 4 3-3 6 6" stroke={image ? C.accent : C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <textarea
            className="aria-input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={image ? 'Adicione uma pergunta sobre a imagem... (opcional)' : 'Digite sua pergunta...'}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.text, fontSize: 13.5, fontFamily: 'inherit',
              resize: 'none', lineHeight: 1.5, minHeight: 22, maxHeight: 120,
              paddingTop: 4,
            }}
          />
          <button
            onClick={() => send()}
            disabled={busy || (!input.trim() && !image)}
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: (busy || (!input.trim() && !image)) ? 'rgba(221,255,85,0.3)' : C.accent,
              color: C.bgDeep, fontSize: 15, fontWeight: 700,
              cursor: (busy || (!input.trim() && !image)) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: (!busy && (input.trim() || image)) ? `0 0 14px ${C.accentGlow}` : 'none',
              transition: 'all 0.15s',
            }}
          >➤</button>
        </div>
        <div style={{ fontSize: 10, color: C.textDim, textAlign: 'center', marginTop: 8 }}>
          ARIA pode cometer erros. Sempre valide com literatura especializada.
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
let _sessionCounter = 1

function newSession(dbId = null, title = null, messages = []) {
  return {
    id: dbId ?? Date.now(),
    dbId,
    title: title ?? `${DEFAULT_CHAT_TITLE} ${_sessionCounter++}`,
    messages,
    createdAt: new Date(),
  }
}

export default function AriaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loadingChats, setLoadingChats] = useState(true)
  const [pendingDeleteSession, setPendingDeleteSession] = useState(null)
  const [renameState, setRenameState] = useState({ open: false, sessionId: null, value: '' })
  const [pendingNewSession, setPendingNewSession] = useState(null)
  const dbIdMapRef = useRef({}) // maps local session id → db row id
  const renameInputRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth > 700
    return true
  })

  const hydrateSession = useCallback((row, idx = 0) => ({
    id: row.id,
    dbId: row.id,
    title: getSessionTitleFromData({
      title: row.title,
      messages: row.messages,
      fallback: `${DEFAULT_CHAT_TITLE} ${idx + 1}`,
    }),
    messages: row.messages || [],
    createdAt: new Date(row.created_at),
  }), [])

  const buildChatPayload = useCallback((title, messages = []) => {
    const safeTitle = title?.trim()
    const safeMessages = titleColumnAvailable ? getVisibleMessages(messages) : upsertChatMeta(messages, { title: safeTitle })
    const payload = {
      messages: safeMessages,
      updated_at: new Date().toISOString(),
    }

    if (titleColumnAvailable) payload.title = safeTitle || null
    return payload
  }, [titleColumnAvailable])

  const loadChats = useCallback(async () => {
    if (!user) return

    setLoadingChats(true)
    try {
      const { data, error } = await supabase
        .from('aria_chat_sessions')
        .select('id, title, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (error) throw error

      if (!data || data.length === 0) {
        const fresh = newSession(null, `${DEFAULT_CHAT_TITLE} 1`, [])
        setSessions([fresh])
        setActiveId(fresh.id)
      } else {
        const loaded = await Promise.all(
          data.map(async (row, idx) => {
            const msgs = await supabase
              .from('aria_chat_messages')
              .select('role, text, image_b64, sources, tokens_used, created_at')
              .eq('session_id', row.id)
              .order('created_at', { ascending: true })
            const rawMessages = msgs.data || []
            const messages = rawMessages.map(m => ({
              role: m.role,
              text: m.text,
              image: m.image_b64 ? `data:image/jpeg;base64,${m.image_b64}` : null,
              sources: m.sources || [],
            }))
            return {
              id: row.id,
              dbId: row.id,
              title: getSessionTitleFromData({
                title: row.title,
                messages,
                fallback: `${DEFAULT_CHAT_TITLE} ${idx + 1}`,
              }),
              messages,
              createdAt: new Date(row.created_at),
            }
          })
        )
        loaded.forEach(s => { dbIdMapRef.current[s.id] = s.dbId })
        setSessions(loaded)
        const cachedActiveId = loadActiveIdFromCache()
        if (cachedActiveId != null && loaded.some(s => s.id === cachedActiveId)) {
          setActiveId(cachedActiveId)
        } else {
          setActiveId(loaded[0].id)
        }
      }
    } catch (err) {
      console.error('[AriaPage] Failed to load chats:', err)
      const fresh = newSession(null, `${DEFAULT_CHAT_TITLE} 1`, [])
      setSessions([fresh])
      setActiveId(fresh.id)
    } finally {
      setLoadingChats(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setSessions([])
      setLoadingChats(false)
      clearSessionsCache()
      return
    }

    // Try cache first for instant display
    const cached = loadSessionsFromCache()
    if (cached && cached.length > 0) {
      setSessions(cached)
      const cachedActiveId = loadActiveIdFromCache()
      if (cachedActiveId != null && cached.some(s => s.id === cachedActiveId)) {
        setActiveId(cachedActiveId)
      } else {
        setActiveId(cached[0].id)
      }
      setLoadingChats(false)
      // Still refresh from Supabase in background
      loadChats()
    } else {
      loadChats()
    }
  }, [loadChats, user])

  const updateSessionTitle = useCallback(async (sessionId, nextTitle) => {
    const normalizedTitle = nextTitle.trim()
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s
      return { ...s, title: normalizedTitle }
    }))

    if (!user) return

    try {
      await supabase
        .from('aria_chat_sessions')
        .update({ title: normalizedTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id)
    } catch (err) {
      console.error('[AriaPage] Failed to rename chat:', err)
    }
  }, [user])

  const createDbSession = useCallback(async (title = null, messages = []) => {
    if (!user) return newSession(null, title, messages)

    const normalizedTitle = (title || `${DEFAULT_CHAT_TITLE} ${_sessionCounter++}`).trim()
    try {
      const { data, error } = await supabase
        .from('aria_chat_sessions')
        .insert({ user_id: user.id, title: normalizedTitle })
        .select('id, created_at')
        .single()
      if (error) throw error
      return {
        id: data.id,
        dbId: data.id,
        title: normalizedTitle,
        messages,
        createdAt: new Date(data.created_at),
      }
    } catch (err) {
      console.error('[AriaPage] Failed to create DB session:', err)
      return newSession(null, normalizedTitle, messages)
    }
  }, [user])

  const deleteDbSession = useCallback(async (dbId) => {
    if (!dbId || !user) return
    await supabase.from('aria_chat_sessions').delete().eq('id', dbId).eq('user_id', user.id)
  }, [user])

  // persist to sessionStorage on change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessionsToCache(sessions, activeId)
    }
  }, [sessions, activeId])

  const activeSession = sessions.find(s => s.id === activeId) || sessions[0]
  const activeSessionTitle = useMemo(() => activeSession?.title || 'ARIA', [activeSession])

  // track mobile state reactively
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 700)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 700)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // close sidebar on mobile when a session is selected
  const selectSession = (id) => {
    setActiveId(id)
    if (mobile) setSidebarOpen(false)
  }

  const createSession = async () => {
    const s = await createDbSession()
    setSessions(prev => [s, ...prev])
    setActiveId(s.id)
    if (mobile) setSidebarOpen(false)
  }

  const openRenameModal = (session) => {
    setRenameState({
      open: true,
      sessionId: session.id,
      value: session.title || '',
    })
  }

  const closeRenameModal = () => {
    setRenameState({ open: false, sessionId: null, value: '' })
  }

  const deleteSession = async (id) => {
    const s = sessions.find(s => s.id === id)
    if (s?.dbId) await deleteDbSession(s.dbId)
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (next.length === 0) {
        // Create new session synchronously to avoid empty list flash
        const fresh = newSession(null, `${DEFAULT_CHAT_TITLE} ${_sessionCounter++}`, [])
        setActiveId(fresh.id)
        setPendingNewSession(fresh)
        return prev // parent will apply pendingNewSession via effect
      }
      if (id === activeId) selectSession(next[0].id)
      return next
    })
  }

  const requestDeleteSession = (session) => {
    setPendingDeleteSession(session)
  }

  const confirmDeleteSession = async () => {
    if (!pendingDeleteSession) return
    const sessionId = pendingDeleteSession.id
    setPendingDeleteSession(null)
    await deleteSession(sessionId)
  }

  const submitRename = async () => {
    const normalizedTitle = renameState.value.trim()
    if (!normalizedTitle || !renameState.sessionId) return
    await updateSessionTitle(renameState.sessionId, normalizedTitle)
    closeRenameModal()
  }

  useEffect(() => {
    if (!renameState.open) return
    const frame = requestAnimationFrame(() => renameInputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [renameState.open])

  // Apply pending new session after delete
  useEffect(() => {
    if (!pendingNewSession) return
    const { dbId } = pendingNewSession
    setSessions(prev => {
      if (prev.some(s => s.id === pendingNewSession.id)) return prev
      return [pendingNewSession, ...prev]
    })
    if (dbId) dbIdMapRef.current[pendingNewSession.id] = dbId
    // Persist to DB asynchronously
    if (!dbId) {
      createDbSession(pendingNewSession.title, pendingNewSession.messages).then(fresh => {
        if (fresh?.dbId) {
          dbIdMapRef.current[pendingNewSession.id] = fresh.dbId
          setSessions(prev => prev.map(s => s.id === pendingNewSession.id ? { ...s, dbId: fresh.dbId } : s))
        }
      })
    }
    setPendingNewSession(null)
  }, [pendingNewSession]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirstMessage = async (id, messages, firstText) => {
    const existingSession = sessions.find(s => s.id === id)
    const nextTitle = firstText ? buildAutoTitle(firstText, existingSession?.title || DEFAULT_CHAT_TITLE) : existingSession?.title || DEFAULT_CHAT_TITLE

    setSessions(prev => prev.map(s => {
      if (s.id !== id) return s
      return { ...s, messages, title: nextTitle }
    }))

    if (!user) return

    try {
      // Get or create session in DB
      let sessionDbId = dbIdMapRef.current[id] || existingSession?.dbId
      if (!sessionDbId) {
        const { data, error } = await supabase
          .from('aria_chat_sessions')
          .insert({ user_id: user.id, title: nextTitle })
          .select('id')
          .single()
        if (error) throw error
        sessionDbId = data.id
        dbIdMapRef.current[id] = sessionDbId
        setSessions(prev => prev.map(s => s.id === id ? { ...s, dbId: sessionDbId } : s))
      } else {
        // Update session title
        await supabase
          .from('aria_chat_sessions')
          .update({ title: nextTitle })
          .eq('id', sessionDbId)
          .eq('user_id', user.id)
      }

      // Save all messages to aria_chat_messages
      for (const msg of messages) {
        const imageB64 = msg.image
          ? (msg.image.includes(',') ? msg.image.split(',')[1] : msg.image)
          : null
        const { error: msgError } = await supabase
          .from('aria_chat_messages')
          .insert({
            session_id: sessionDbId,
            role: msg.role,
            text: msg.text || '',
            image_b64: imageB64,
            sources: msg.sources || null,
          })
        if (msgError) console.error('[AriaPage] Failed to save message:', msgError)
      }
    } catch (err) {
      console.error('[AriaPage] Failed to save messages:', err)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.bg, color: C.text,
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes chatblink{0%,80%,100%{opacity:.3}40%{opacity:1}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(192,214,234,0.15);border-radius:2px}
        textarea{overflow-y:hidden}
        .aria-md { font-size: 13.5px; line-height: 1.6; }
        .aria-md h1, .aria-md h2, .aria-md h3 { color: ${C.accent}; margin: 10px 0 6px; font-weight: 700; }
        .aria-md h1 { font-size: 16px; }
        .aria-md h2 { font-size: 15px; }
        .aria-md h3 { font-size: 14px; }
        .aria-md h1:first-child, .aria-md h2:first-child, .aria-md h3:first-child { margin-top: 0; }
        .aria-md p { margin: 0 0 8px; }
        .aria-md p:last-child { margin-bottom: 0; }
        .aria-md strong { color: ${C.text}; font-weight: 700; }
        .aria-md em { font-style: italic; }
        .aria-md ul, .aria-md ol { margin: 6px 0; padding-left: 20px; }
        .aria-md li { margin: 3px 0; line-height: 1.5; }
        .aria-md ul li::marker { color: ${C.accent}; }
        .aria-md ol li::marker { color: ${C.accent}; font-weight: 600; }
        .aria-md code { background: rgba(192,214,234,0.1); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: 'SF Mono', 'Fira Code', monospace; }
        .aria-md pre { background: rgba(0,26,43,0.6); border: 1px solid ${C.border}; border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 8px 0; }
        .aria-md pre code { background: none; padding: 0; }
        .aria-md blockquote { border-left: 3px solid ${C.accent}; margin: 8px 0; padding: 4px 12px; color: ${C.textSoft}; }
        .aria-md a { color: ${C.accent}; text-decoration: underline; text-underline-offset: 2px; }
        .aria-md hr { border: none; border-top: 1px solid ${C.border}; margin: 10px 0; }
        .aria-md table { border-collapse: collapse; margin: 8px 0; font-size: 12px; width: 100%; }
        .aria-md th, .aria-md td { border: 1px solid ${C.border}; padding: 5px 8px; text-align: left; }
        .aria-md th { background: rgba(192,214,234,0.08); font-weight: 600; }
        @media(max-width:700px){
          .aria-sidebar{ display: ${sidebarOpen ? 'flex' : 'none'} !important; position:fixed!important; top:54px!important; left:0!important; bottom:0!important; width:85%!important; max-width:320px!important; z-index:50!important; }
          .aria-sidebar-backdrop{ display: ${sidebarOpen ? 'block' : 'none'} !important; }
          .aria-chat-area{ min-height: 0 !important; }
          .aria-messages{ padding: 16px 12px !important; gap: 8px !important; }
          .aria-bubble{ max-width: 94% !important; font-size: 14px !important; line-height: 1.7 !important; padding: 10px 13px !important; }
          .aria-md{ font-size: 14px !important; line-height: 1.75 !important; }
          .aria-md h1 { font-size: 15px !important; margin: 8px 0 4px !important; }
          .aria-md h2 { font-size: 14px !important; margin: 7px 0 3px !important; }
          .aria-md h3 { font-size: 13.5px !important; margin: 6px 0 3px !important; }
          .aria-md p { margin: 0 0 6px !important; }
          .aria-md ul, .aria-md ol { margin: 4px 0 !important; padding-left: 18px !important; }
          .aria-md li { margin: 2px 0 !important; line-height: 1.6 !important; }
          .aria-md code { font-size: 11.5px !important; }
          .aria-md pre { padding: 8px 10px !important; }
          .aria-md table { font-size: 11.5px !important; }
          .aria-md th, .aria-md td { padding: 4px 6px !important; }
          .aria-input-bar{ padding: 10px 12px !important; }
          .aria-input-row{ align-items: center !important; padding: 6px 8px !important; }
          .aria-input-field{ font-size: 13.5px !important; padding-top: 2px !important; }
        }
      `}</style>

      {/* ── Top header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 54,
        borderBottom: `1px solid ${C.border}`,
        background: 'rgba(0,26,43,0.9)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* toggle sidebar */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            title="Histórico"
            style={{
              background: sidebarOpen ? C.accentSoft : 'transparent',
              border: `1px solid ${sidebarOpen ? 'rgba(221,255,85,0.25)' : C.glassBorder}`,
              borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="5" height="10" rx="1" stroke={sidebarOpen ? C.accent : C.textMuted} strokeWidth="1.4" />
              <path d="M9 5h5M9 8h5M9 11h3" stroke={sidebarOpen ? C.accent : C.textMuted} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'transparent', border: `1px solid ${C.glassBorder}`,
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              color: C.textMuted, fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            }}
          >← Dashboard</button>
        </div>

        {/* ARIA brand center */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: C.accentSoft, border: `1px solid rgba(221,255,85,0.25)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AriaIcon size={16} color={C.accent} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>ARIA</span>
            <span style={{ fontSize: 10, color: C.textDim, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeSessionTitle}</span>
          </div>
        </div>

        {/* status + new chat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 20,
            background: 'rgba(94,240,176,0.08)', border: '1px solid rgba(94,240,176,0.2)',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#5ef0b0', boxShadow: '0 0 5px #5ef0b0' }} />
            <span style={{ fontSize: 10, color: '#5ef0b0', fontWeight: 700 }}>Online</span>
          </div>
          <button
            onClick={createSession}
            style={{
              background: C.accent, border: 'none', borderRadius: 8,
              width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 12px ${C.accentGlow}`,
            }}
            title="Nova conversa"
          >
            <IconPlus size={14} color={C.bgDeep} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Mobile sidebar backdrop */}
        <div
          className="aria-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,10,20,0.6)', zIndex: 49 }}
        />

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <div
            className="aria-sidebar"
            style={{
              width: 240, flexShrink: 0,
              borderRight: `1px solid ${C.border}`,
              background: 'rgba(0,22,36,0.85)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '14px 14px 10px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {mobile && (
                  <button onClick={() => setSidebarOpen(false)} style={{ background: 'transparent', border: `1px solid ${C.glassBorder}`, borderRadius: 6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 12 }}>✕</button>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim }}>
                  Conversas
                </span>
              </div>
              <button
                onClick={createSession}
                style={{
                  background: C.accent, border: 'none', borderRadius: 6,
                  width: 24, height: 24, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconPlus size={12} color={C.bgDeep} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
              {loadingChats ? (
                <div style={{ padding: '20px 10px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                  <div style={{ marginBottom: 8, opacity: 0.5 }}>◌</div>
                  Carregando conversas...
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: '20px 10px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                  Nenhuma conversa ainda.
                </div>
              ) : sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 6, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                    marginBottom: 2,
                    background: s.id === activeId ? C.accentSoft : 'transparent',
                    border: `1px solid ${s.id === activeId ? 'rgba(221,255,85,0.2)' : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      fontSize: 12, fontWeight: s.id === activeId ? 700 : 500,
                      color: s.id === activeId ? C.accent : C.textSoft,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                      {getSessionMessageCount(s.messages)} {getSessionMessageCount(s.messages) === 1 ? 'mensagem' : 'mensagens'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openRenameModal(s) }}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: 4, borderRadius: 6, opacity: 0.65,
                        display: 'flex', alignItems: 'center',
                      }}
                      title="Renomear conversa"
                      aria-label={`Renomear conversa ${s.title}`}
                    >
                      <IconEdit size={12} color={s.id === activeId ? C.accent : C.textDim} />
                    </button>
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); requestDeleteSession(s) }}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          padding: 4, borderRadius: 6, opacity: 0.5, flexShrink: 0,
                          display: 'flex', alignItems: 'center',
                        }}
                        title="Excluir conversa"
                        aria-label={`Excluir conversa ${s.title}`}
                      >
                        <IconTrash size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              padding: '10px 12px',
              borderTop: `1px solid ${C.border}`,
              fontSize: 10, color: C.textDim, textAlign: 'center', lineHeight: 1.5,
            }}>
              Radio<EX color={C.textDim} size={10} />perience · ARIA v1
            </div>
          </div>
        )}

        {/* ── Chat ── */}
        <div
          className="aria-chat-area"
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', minHeight: 0, minWidth: 0,
            background: 'rgba(0,26,43,0.5)',
          }}
        >
          {!loadingChats && activeSession && (
            <ChatPanel
              session={activeSession}
              onFirstMessage={handleFirstMessage}
            />
          )}
          {loadingChats && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: 13 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 12, opacity: 0.5, fontSize: 24 }}>◌</div>
                Carregando suas conversas...
              </div>
            </div>
          )}
        </div>
      </div>

      {renameState.open && (
        <div
          onClick={closeRenameModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 121,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,10,20,0.62)', backdropFilter: 'blur(10px)', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360,
              background: 'rgba(0,26,43,0.97)',
              border: `1px solid ${C.glassBorder}`,
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 0 50px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ color: C.text, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              Renomear conversa
            </div>
            <input
              ref={renameInputRef}
              value={renameState.value}
              onChange={(e) => setRenameState(prev => ({ ...prev, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename()
                if (e.key === 'Escape') closeRenameModal()
              }}
              maxLength={80}
              placeholder="Digite o novo título"
              style={{
                width: '100%',
                background: 'rgba(192,214,234,0.06)',
                border: `1px solid ${C.glassBorder}`,
                borderRadius: 12,
                padding: '11px 12px',
                color: C.text,
                outline: 'none',
                fontSize: 13,
                fontFamily: 'inherit',
                marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={closeRenameModal}
                style={{
                  padding: '8px 14px', borderRadius: 10,
                  border: `1px solid ${C.glassBorder}`,
                  background: 'transparent', color: C.textSoft,
                  fontWeight: 600, cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={submitRename}
                disabled={!renameState.value.trim()}
                style={{
                  padding: '8px 14px', borderRadius: 10,
                  border: 'none',
                  background: renameState.value.trim() ? C.accent : 'rgba(221,255,85,0.3)',
                  color: C.bgDeep,
                  fontWeight: 800, cursor: renameState.value.trim() ? 'pointer' : 'not-allowed', fontSize: 13,
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteSession && (
        <div
          onClick={() => setPendingDeleteSession(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,10,20,0.75)', backdropFilter: 'blur(12px)', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420,
              background: 'rgba(0,26,43,0.97)',
              border: `1px solid rgba(255,107,107,0.3)`,
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 0 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 8 }}>🗑️</div>
            <h3 style={{ color: C.text, marginBottom: 8 }}>Excluir conversa?</h3>
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Tem certeza que deseja excluir esta conversa?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => setPendingDeleteSession(null)}
                style={{
                  padding: '8px 16px', borderRadius: 10,
                  border: `1px solid ${C.glassBorder}`,
                  background: 'transparent', color: C.textSoft,
                  fontWeight: 600, cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteSession}
                style={{
                  padding: '8px 16px', borderRadius: 10,
                  border: 'none', background: '#ff6b6b', color: '#fff',
                  fontWeight: 800, cursor: 'pointer', fontSize: 13,
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
