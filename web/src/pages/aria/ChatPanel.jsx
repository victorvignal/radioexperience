import { useState, useRef, useEffect } from 'react'
import { C, AriaIcon } from './Icons'
import { renderMarkdown, cleanTitle } from './mardown'
import { SUGGESTIONS } from './constants'

// ─── Loading dots ─────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '10px 0', alignSelf: 'flex-start' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, background: C.textDim, borderRadius: '50%',
          animation: 'chatblink 1.4s infinite both',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

// ─── Image preview pill ───────────────────────────────────────────────────────

function ImagePreview({ image, onRemove }) {
  return (
    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={image.preview}
          alt="preview"
          style={{
            height: 72, maxWidth: 180, borderRadius: 10, objectFit: 'cover',
            border: `1px solid rgba(221,255,85,0.3)`,
          }}
        />
        <button
          onClick={onRemove}
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
  )
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function Sources({ sources }) {
  if (!sources || sources.length === 0) return null
  return (
    <div style={{
      marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`,
      fontSize: 11, color: C.textDim,
    }}>
      <strong style={{ color: C.textMuted }}>📚 Fontes:</strong>
      {sources.slice(0, 3).map((s, j) => {
        const title = cleanTitle(s.title || '')
        const pg = s.page_start
          ? ` (p. ${s.page_start}${s.page_end && s.page_end !== s.page_start ? `-${s.page_end}` : ''})`
          : ''
        return <div key={j}>• {title}{pg}</div>
      })}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
    }}>
      <div className="aria-bubble" style={{
        maxWidth: '78%',
      }}>
        {message.image && (
          <img
            src={message.image}
            alt="anexo"
            style={{
              display: 'block', maxWidth: '100%', maxHeight: 260,
              borderRadius: 10, marginBottom: message.text ? 8 : 0,
              border: `1px solid rgba(0,26,43,0.3)`,
            }}
          />
        )}
        {message.role === 'user' ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.text}</span>
        ) : (
          <div
            className="aria-md"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }}
          />
        )}
        {message.sources && <Sources sources={message.sources} />}
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onSend }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', gap: 16, padding: '40px 20px',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: C.accentSoft, border: `1px solid rgba(221,255,85,0.25)`,
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
            onClick={() => onSend(s)}
            style={{
              background: C.accentSoft, border: '1px solid rgba(221,255,85,0.2)',
              color: C.accent, padding: '8px 14px',
              borderRadius: 20, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{s}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Input bar ────────────────────────────────────────────────────────────────

function InputBar({ input, setInput, image, setImage, busy, onSend, onFileChange }) {
  const fileInputRef = useRef(null)

  return (
    <div className="aria-input-bar" style={{
      padding: '14px 20px',
      borderTop: `1px solid ${C.border}`,
      background: 'rgba(0,26,43,0.7)',
      backdropFilter: 'blur(16px)',
      flexShrink: 0,
    }}>
      {image && <ImagePreview image={image} onRemove={() => setImage(null)} />}

      <div className="aria-input-row" style={{
        display: 'flex', gap: 8, alignItems: 'flex-end',
        background: 'rgba(192,214,234,0.05)',
        border: `1px solid ${image ? 'rgba(221,255,85,0.25)' : C.glassBorder}`,
        borderRadius: 14, padding: '8px 8px 8px 12px',
        transition: 'border-color 0.2s',
      }}>
        {/* image attach button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onFileChange}
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

        {/* textarea */}
        <textarea
          className="aria-input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
          }}
          placeholder={image ? 'Adicione uma pergunta sobre a imagem... (opcional)' : 'Digite sua pergunta...'}
          rows={1}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: C.text, fontSize: 13.5, fontFamily: 'inherit',
            resize: 'none', lineHeight: 1.5, minHeight: 22, maxHeight: 120,
            paddingTop: 4,
          }}
        />

        {/* send button */}
        <button
          onClick={onSend}
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
  )
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

export function ChatPanel({ session, onFirstMessage, apiUrl }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [image, setImage] = useState(null) // { file, preview }
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef(null)
  const chatRef = useRef(null)

  // Sync when switching sessions
  useEffect(() => {
    const visible = (session.messages || []).filter(m => m.role !== '__aria_meta__')
    setMessages(visible)
    setInput('')
    setBusy(false)
    setImage(null)
  }, [session.id])

  // Auto-scroll on new messages
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
      const body = {
        question: q || 'Analise esta imagem e descreva os achados radiológicos.',
        top_k: 5,
      }
      if (sentImage?.preview) {
        const base64Pure = sentImage.preview.includes(',')
          ? sentImage.preview.split(',')[1]
          : sentImage.preview
        body.image_base64 = base64Pure
      }

      const res = await fetch(apiUrl, {
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* messages area */}
      <div
        ref={chatRef}
        className="aria-messages"
        style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
          display: 'flex', flexDirection: 'column', gap: 12,
          scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent`,
        }}
      >
        {messages.length === 0 && <EmptyState onSend={send} />}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {busy && <LoadingDots />}
      </div>

      {/* input bar */}
      <InputBar
        input={input}
        setInput={setInput}
        image={image}
        setImage={setImage}
        busy={busy}
        onSend={() => send()}
        onFileChange={handleFileChange}
      />
    </div>
  )
}