import { useState, useRef, useEffect, useMemo } from "react";
import { marked } from "marked";

// Configure marked: no inline styles, clean output
marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(text) {
  if (!text) return "";
  // Clean up [Fonte: ...] references — make them smaller/cleaner
  let cleaned = text.replace(
    /\[Fonte:\s*([^\]]+)\]/gi,
    '<span class="aria-citation">📖 $1</span>'
  );
  return marked.parse(cleaned);
}

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
};

const DEFAULT_API = "https://aria-backend-production-176b.up.railway.app/chat";
const API_URL = (() => {
  if (typeof window !== "undefined") {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("api") || window.ARIA_API_URL || import.meta.env.VITE_ARIA_API || DEFAULT_API;
  }
  return import.meta.env.VITE_ARIA_API || DEFAULT_API;
})();

function cleanTitle(raw) {
  return raw
    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Livro_/i, '')
    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Artigo_/i, '')
    .replace(/_Semautor_SemAno.*$/i, '')
    .replace(/_DUP\d+$/i, '')
    .replace(/_Revisar/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ARIA_CHAT_STORAGE_KEY = 'aria_chat_messages';

function loadStoredMessages() {
  try {
    const stored = localStorage.getItem(ARIA_CHAT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

function saveStoredMessages(messages) {
  try {
    const toSave = messages.map(m => ({
      ...m,
      image: m.image ? '[image]' : null,
    }));
    localStorage.setItem(ARIA_CHAT_STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

function clearStoredMessages() {
  try { localStorage.removeItem(ARIA_CHAT_STORAGE_KEY); } catch {}
}

export default function AriaChat() {
  const [messages, setMessages] = useState(() => loadStoredMessages());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState(null); // { file, preview }
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);
  const [streamText, setStreamText] = useState('');
  const [streamSources, setStreamSources] = useState([]);
  const abortRef = useRef(null);

  // persist messages on change
  useEffect(() => {
    if (messages.length > 0) {
      saveStoredMessages(messages);
    }
  }, [messages]);

  const scrollToBottom = () => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy, streamText]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImage({ file, preview: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if ((!q && !image) || busy) return;
    setBusy(true);
    setInput("");
    const sentImage = image;
    setImage(null);

    const userMsg = { role: "user", text: q, image: sentImage?.preview || null };
    setMessages(prev => [...prev, userMsg]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    // Streaming placeholder message
    setMessages(prev => [...prev, { role: "bot", text: "", _streaming: true }]);

    try {
      const body = {
        question: q || "Analise esta imagem e descreva os achados radiológicos.",
        top_k: 5,
      };
      if (sentImage?.preview) {
        const base64Pure = sentImage.preview.includes(',')
          ? sentImage.preview.split(',')[1]
          : sentImage.preview;
        body.image_base64 = base64Pure;
      }

      const streamUrl = API_URL.replace('/chat', '/chat/stream') + (API_URL === DEFAULT_API ? '/stream' : '');
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages(prev => {
          const filtered = prev.filter(m => !m._streaming);
          return [...filtered, { role: "bot", text: `Erro: ${err.detail || "Falha na conexão"}` }];
        });
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalText = "";
        let finalSources = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim();
              if (eventType === 'done') {
                // Done event — set final text and sources
                setMessages(prev => prev.map(m =>
                  m._streaming ? { ...m, text: finalText, sources: finalSources, _streaming: false } : m
                ));
              }
            } else if (line.startsWith('data: ')) {
              const rawData = line.slice(6).trim();
              try {
                const data = JSON.parse(rawData);
                if (data.token !== undefined) {
                  finalText += data.token;
                  setMessages(prev => prev.map(m =>
                    m._streaming ? { ...m, text: finalText } : m
                  ));
                }
                if (data.sources !== undefined) {
                  finalSources = data.sources;
                }
              } catch {}
            }
          }
        }

        // Finalize — ensure the streaming message is complete
        setMessages(prev => prev.map(m =>
          m._streaming ? { ...m, text: finalText, sources: finalSources, _streaming: false } : m
        ));
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.filter(m => !m._streaming));
      } else {
        setMessages(prev => {
          const filtered = prev.filter(m => !m._streaming);
          return [...filtered, { role: "bot", text: "Não foi possível conectar ao servidor ARIA." }];
        });
      }
    }
    setBusy(false);
    abortRef.current = null;
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const suggestions = ["O que é BI-RADS?", "Anatomia da mama", "Técnica radiológica do tórax", "Categorias do BI-RADS"];

  return (
    <div style={{
      background: "rgba(0,26,43,0.6)",
      border: `1px solid ${C.glassBorder}`,
      borderRadius: 20,
      overflow: "hidden",
      maxWidth: 700,
      margin: "24px auto 0",
      backdropFilter: "blur(20px)",
    }}>
      <style>{`@keyframes chatblink{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>

      <style>{`.aria-chat-msgs{height:340px}@media(max-height:600px){.aria-chat-msgs{height:50vh}}@media(max-width:480px){.aria-chat-msgs{height:45vh}}`}</style>
      <style>{`
        .aria-md { font-size: 13.5px; line-height: 1.6; }
        .aria-md h1, .aria-md h2, .aria-md h3 {
          color: ${C.accent};
          margin: 10px 0 6px;
          font-weight: 700;
        }
        .aria-md h1 { font-size: 16px; }
        .aria-md h2 { font-size: 15px; }
        .aria-md h3 { font-size: 14px; }
        .aria-md h1:first-child, .aria-md h2:first-child, .aria-md h3:first-child {
          margin-top: 0;
        }
        .aria-md p { margin: 0 0 8px; }
        .aria-md p:last-child { margin-bottom: 0; }
        .aria-md strong { color: ${C.text}; font-weight: 700; }
        .aria-md em { font-style: italic; }
        .aria-md ul, .aria-md ol {
          margin: 6px 0;
          padding-left: 20px;
        }
        .aria-md li {
          margin: 3px 0;
          line-height: 1.5;
        }
        .aria-md ul li::marker { color: ${C.accent}; }
        .aria-md ol li::marker { color: ${C.accent}; font-weight: 600; }
        .aria-md code {
          background: rgba(192,214,234,0.1);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .aria-md pre {
          background: rgba(0,26,43,0.6);
          border: 1px solid ${C.border};
          border-radius: 8px;
          padding: 10px 12px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .aria-md pre code {
          background: none;
          padding: 0;
        }
        .aria-md blockquote {
          border-left: 3px solid ${C.accent};
          margin: 8px 0;
          padding: 4px 12px;
          color: ${C.textSoft};
        }
        .aria-md a {
          color: ${C.accent};
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .aria-md hr {
          border: none;
          border-top: 1px solid ${C.border};
          margin: 10px 0;
        }
        .aria-md table {
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 12px;
          width: 100%;
        }
        .aria-md th, .aria-md td {
          border: 1px solid ${C.border};
          padding: 5px 8px;
          text-align: left;
        }
        .aria-md th {
          background: rgba(192,214,234,0.08);
          font-weight: 600;
        }
        .aria-citation {
          display: inline-block;
          background: rgba(221,255,85,0.08);
          border: 1px solid rgba(221,255,85,0.15);
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 11px;
          color: ${C.textMuted};
          margin: 0 2px;
        }
      `}</style>

      {/* Messages */}
      <div
        ref={chatRef}
        className="aria-chat-msgs"
        style={{
          overflowY: "auto",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(192,214,234,0.15) transparent',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: C.textMuted, padding: "24px 12px", fontSize: 14 }}>
            <p style={{ fontSize: 24, marginBottom: 6 }}>🩻</p>
            <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>ARIA — Assistente de Radiologia por IA</p>
            <p>Pergunte sobre anatomia, técnicas, patologias ou envie uma imagem radiológica.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", padding: "14px 14px 0" }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  style={{
                    background: C.accentSoft,
                    border: "1px solid rgba(221,255,85,0.2)",
                    color: C.accent,
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                  onClick={() => send(s)}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              lineHeight: 1.6,
              whiteSpace: m.role === "user" ? "pre-wrap" : "normal",
              wordWrap: "break-word",
              background: m.role === "user" ? C.accent : "rgba(192,214,234,0.08)",
              color: m.role === "user" ? C.bgDeep : C.text,
              border: m.role === "user" ? "none" : `1px solid ${C.border}`,
            }}>
              {m.image && (
                <img
                  src={m.image}
                  alt="anexo"
                  style={{
                    display: "block", maxWidth: "100%", maxHeight: 200,
                    borderRadius: 10, marginBottom: m.text ? 8 : 0,
                    border: "1px solid rgba(0,26,43,0.3)",
                  }}
                />
              )}
              {m.role === "user" ? (
                m.text
              ) : (
                <div
                  className="aria-md"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
                />
              )}
              {m.sources && m.sources.length > 0 && (
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: `1px solid ${C.border}`,
                  fontSize: 11, color: C.textDim,
                }}>
                  <strong style={{ color: C.textMuted }}>📚 Fontes:</strong>
                  {m.sources.slice(0, 3).map((s, j) => {
                    const title = cleanTitle(s.title);
                    const pg = s.page_start ? ` (p. ${s.page_start}${s.page_end && s.page_end !== s.page_start ? `-${s.page_end}` : ""})` : "";
                    return <div key={j}>• {title}{pg}</div>;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div style={{ display: "flex", gap: 4, padding: "10px 14px", alignSelf: "flex-start" }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 7, height: 7, background: C.textDim, borderRadius: "50%",
                animation: "chatblink 1.4s infinite both",
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Image preview */}
      {image && (
        <div style={{
          padding: "8px 14px 0",
          borderTop: `1px solid ${C.border}`,
          background: "rgba(0,34,51,0.5)",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              src={image.preview}
              alt="preview"
              style={{
                height: 60, maxWidth: 140, borderRadius: 8,
                objectFit: "cover", border: "1px solid rgba(221,255,85,0.3)",
              }}
            />
            <button
              onClick={() => setImage(null)}
              style={{
                position: "absolute", top: -5, right: -5,
                width: 18, height: 18, borderRadius: "50%",
                background: "rgba(0,26,43,0.9)", border: `1px solid ${C.glassBorder}`,
                color: C.textMuted, fontSize: 10, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          </div>
          <span style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
            {image.file.name}<br />
            <span style={{ color: C.textDim }}>{(image.file.size / 1024).toFixed(0)} KB</span>
          </span>
        </div>
      )}

      {/* Input row */}
      <div style={{
        display: "flex", gap: 8, alignItems: "flex-end",
        padding: "12px 14px",
        borderTop: image ? "none" : `1px solid ${C.border}`,
        background: "rgba(0,34,51,0.5)",
      }}>
        {/* Image button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Anexar imagem radiológica"
          style={{
            width: 34, height: 34, borderRadius: 9, border: "none",
            background: image ? C.accentSoft : "rgba(192,214,234,0.08)",
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke={image ? C.accent : C.textMuted} strokeWidth="1.6" />
            <circle cx="8.5" cy="8.5" r="1.5" fill={image ? C.accent : C.textMuted} />
            <path d="M3 16l5-5 4 4 3-3 6 6" stroke={image ? C.accent : C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <textarea
          style={{
            flex: 1,
            background: "rgba(0,26,43,0.6)",
            border: `1px solid ${image ? 'rgba(221,255,85,0.25)' : C.glassBorder}`,
            borderRadius: 10,
            padding: "10px 12px",
            color: C.text,
            fontSize: 13.5,
            fontFamily: "inherit",
            resize: "none",
            outline: "none",
            minHeight: 40,
            maxHeight: 100,
            lineHeight: 1.5,
            transition: "border-color 0.2s",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={image ? "Pergunta sobre a imagem... (opcional)" : "Digite sua pergunta..."}
          rows={1}
        />
        <button
          style={{
            background: (busy || (!input.trim() && !image)) ? "rgba(221,255,85,0.3)" : C.accent,
            border: "none",
            borderRadius: 10,
            padding: "10px 16px",
            color: C.bgDeep,
            fontSize: 15,
            fontWeight: 700,
            cursor: (busy || (!input.trim() && !image)) ? "not-allowed" : "pointer",
            alignSelf: "flex-end",
            boxShadow: (!busy && (input.trim() || image)) ? `0 0 14px ${C.accentGlow}` : "none",
            transition: "all 0.15s",
          }}
          onClick={() => send()}
          disabled={busy || (!input.trim() && !image)}
        >➤</button>
      </div>
    </div>
  );
}
