import { useState, useRef, useEffect, useCallback } from "react";

const DEFAULT_API = "https://aria-backend-production-176b.up.railway.app/chat";
const API_URL = (() => {
  if (typeof window !== "undefined") {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("api") || window.ARIA_API_URL || import.meta.env.VITE_ARIA_API || DEFAULT_API;
  }
  return import.meta.env.VITE_ARIA_API || DEFAULT_API;
})();

// ── Simple markdown renderer ──
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: "4px 0", paddingLeft: 18 }}>
          {listItems.map((li, i) => <li key={i} style={{ marginBottom: 2 }}>{inlineFormat(li)}</li>)}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const inlineFormat = (str) => {
    const parts = [];
    let remaining = str;
    let key = 0;
    // Bold **text**
    const boldRe = /\*\*(.+?)\*\*/g;
    let lastIdx = 0;
    let match;
    while ((match = boldRe.exec(remaining)) !== null) {
      if (match.index > lastIdx) parts.push(remaining.slice(lastIdx, match.index));
      parts.push(<strong key={key++} style={{ color: "#F6F2E8" }}>{match[1]}</strong>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < remaining.length) parts.push(remaining.slice(lastIdx));
    return parts.length > 0 ? parts : str;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    // Bullet list item
    if (/^[-•]\s/.test(trimmed)) {
      inList = true;
      listItems.push(trimmed.replace(/^[-•]\s/, ""));
      continue;
    }
    // Numbered list item
    if (/^\d+\.\s/.test(trimmed)) {
      inList = true;
      listItems.push(trimmed.replace(/^\d+\.\s/, ""));
      continue;
    }
    if (inList) flushList();
    // Empty line
    if (trimmed === "") {
      elements.push(<div key={`br-${elements.length}`} style={{ height: 6 }} />);
      continue;
    }
    // Regular paragraph
    elements.push(
      <p key={`p-${elements.length}`} style={{ margin: "2px 0", lineHeight: 1.65 }}>
        {inlineFormat(trimmed)}
      </p>
    );
  }
  flushList();
  return elements;
}

// ── Clean source title ──
function cleanTitle(raw) {
  let t = raw
    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia|Fisica)_(Livro|Artigo|Guideline)_/i, "")
    .replace(/_Semautor_SemAno.*$/i, "")
    .replace(/_DUP\d+$/i, "")
    .replace(/_Revisar/gi, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Truncate long titles
  if (t.length > 65) t = t.slice(0, 62) + "...";
  return t;
}

function getSpecialty(raw) {
  const map = {
    Mama: "Mama", Neurorradiologia: "Neuro", Abdome: "Abdome",
    Torax: "Torax", Pediatria: "Pediatria", Geral: "Geral",
    Cabeca_Pescoco: "Cabeca/Pescoco", Obstetricia: "Obstetricia",
    Ms: "Musc. Esqueletico", intervencao: "Intervencionista",
    Vascular: "Vascular", Fisica: "Fisica Medica",
    Urgencia: "Urgencia", radioprotecao: "Radioprotecao",
  };
  for (const [key, label] of Object.entries(map)) {
    if (raw.startsWith(key + "_")) return label;
  }
  return null;
}

// ── Source badge color ──
const specColors = {
  Mama: "#e8a0bf", Neuro: "#a0c4e8", Abdome: "#a0e8b8",
  Torax: "#e8cda0", Pediatria: "#c4a0e8", Geral: "#a0d4e8",
  "Cabeca/Pescoco": "#e8b0a0", Obstetricia: "#d4e8a0",
  "Musc. Esqueletico": "#b8e8a0", Intervencionista: "#e8a0d4",
  Vascular: "#a0e8d8", "Fisica Medica": "#dae8a0",
  Urgencia: "#e8b8a0", Radioprotecao: "#c0c0e8",
};

export default function AriaChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chatRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: q, ts: Date.now() }]);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 5 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages(prev => [...prev, { role: "bot", text: `Erro: ${err.detail || "Falha na conexao"}`, ts: Date.now() }]);
      } else {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "bot", text: data.answer, sources: data.sources, tokens: data.tokens_used, ts: Date.now() }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "Nao foi possivel conectar ao servidor ARIA.", ts: Date.now() }]);
    }
    setBusy(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const suggestions = [
    { icon: "🩻", text: "O que e BI-RADS?" },
    { icon: "🧠", text: "AVC isquemico na TC" },
    { icon: "🦴", text: "Fratura por estresse na RM" },
    { icon: "🫁", text: "Sinais de pneumotorax" },
    { icon: "🫀", text: "Cardiomegalia no raio-X" },
    { icon: "🔬", text: "Criterios TI-RADS" },
  ];

  return (
    <div style={s.wrapper}>
      <style>{`
        @keyframes chatblink{0%,80%,100%{opacity:.3}40%{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .aria-sug:hover{background:rgba(221,255,85,0.16)!important;border-color:rgba(221,255,85,0.4)!important}
        .aria-send:hover:not(:disabled){filter:brightness(1.1)}
        .aria-send:active:not(:disabled){transform:scale(0.96)}
        .aria-msg{animation:fadeIn .25s ease}
        .aria-scroll::-webkit-scrollbar{width:5px}
        .aria-scroll::-webkit-scrollbar-track{background:transparent}
        .aria-scroll::-webkit-scrollbar-thumb{background:rgba(192,214,234,0.15);border-radius:10px}
        .aria-src-tag:hover{filter:brightness(1.2)}
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.avatar}>🩻</div>
          <div>
            <div style={s.headerTitle}>ARIA</div>
            <div style={s.headerSub}>Assistente de Radiologia por IA</div>
          </div>
        </div>
        <div style={s.headerBadge}>RAG</div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="aria-scroll" style={s.messages}>
        {messages.length === 0 && (
          <div className="aria-msg" style={s.welcome}>
            <p style={{ fontSize: 16, color: "#8ba8c4", marginBottom: 16, lineHeight: 1.6 }}>
              Olar! Sou a <strong style={{ color: "#DDFF55" }}>ARIA</strong>.<br />
              Pergunte sobre anatomia, tecnicas, patologias ou diagnostico por imagem.
            </p>
            <div style={s.sugGrid}>
              {suggestions.map((sug, i) => (
                <button key={i} className="aria-sug" style={s.sugBtn}
                  onClick={() => setInput(sug.text)}>
                  <span style={{ fontSize: 16 }}>{sug.icon}</span>
                  <span>{sug.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="aria-msg" style={s.msgWrap(m.role)}>
            {m.role === "bot" && <div style={s.botAvatar}>🩻</div>}
            <div style={s.msgBubble(m.role)}>
              {m.role === "user" ? (
                <span>{m.text}</span>
              ) : (
                <>{renderMarkdown(m.text)}</>
              )}

              {/* Sources */}
              {m.sources && m.sources.length > 0 && (
                <div style={s.sourcesBox}>
                  <div style={s.sourcesTitle}>📚 Fontes consultadas</div>
                  <div style={s.sourcesList}>
                    {m.sources.slice(0, 3).map((src, j) => {
                      const spec = getSpecialty(src.title);
                      const title = cleanTitle(src.title);
                      const pg = src.page_start ? `p. ${src.page_start}${src.page_end && src.page_end !== src.page_start ? `-${src.page_end}` : ""}` : "";
                      return (
                        <div key={j} style={s.sourceCard}>
                          <div style={s.sourceHeader}>
                            {spec && (
                              <span className="aria-src-tag" style={{ ...s.specTag, background: specColors[spec] || "#a0c4e8" }}>
                                {spec}
                              </span>
                            )}
                            <span style={s.sourcePage}>{pg}</span>
                          </div>
                          <div style={s.sourceTitle}>{title}</div>
                          <div style={s.scoreBar}>
                            <div style={{ ...s.scoreFill, width: `${Math.round(src.score * 100)}%` }} />
                            <span style={s.scoreText}>{Math.round(src.score * 100)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {m.tokens > 0 && <div style={s.tokenInfo}>{m.tokens} tokens</div>}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="aria-msg" style={s.msgWrap("bot")}>
            <div style={s.botAvatar}>🩻</div>
            <div style={{ ...s.msgBubble("bot"), padding: "12px 16px" }}>
              <div style={s.typing}>
                {[0, 1, 2].map(i => <span key={i} style={s.dot(i)} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={s.inputRow}>
        <textarea
          style={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Digite sua pergunta sobre radiologia..."
          rows={1}
        />
        <button className="aria-send" style={s.sendBtn} onClick={send} disabled={busy || !input.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Styles ──
const s = {
  wrapper: {
    background: "rgba(0,26,43,0.55)",
    border: "1px solid rgba(192,214,234,0.12)",
    borderRadius: 24,
    overflow: "hidden",
    maxWidth: 720,
    margin: "24px auto 0",
    backdropFilter: "blur(24px)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
  },
  // Header
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid rgba(192,214,234,0.1)",
    background: "rgba(0,34,51,0.4)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 10,
    background: "rgba(221,255,85,0.1)", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: 18,
  },
  headerTitle: { fontWeight: 700, fontSize: 15, color: "#F6F2E8", letterSpacing: 0.5 },
  headerSub: { fontSize: 11, color: "#5a7d9a", marginTop: 1 },
  headerBadge: {
    fontSize: 10, fontWeight: 700, color: "#DDFF55", letterSpacing: 1,
    background: "rgba(221,255,85,0.1)", border: "1px solid rgba(221,255,85,0.2)",
    padding: "3px 10px", borderRadius: 20,
  },
  // Messages area
  messages: {
    height: 380, overflowY: "auto", padding: 16,
    display: "flex", flexDirection: "column", gap: 8,
  },
  welcome: { textAlign: "center", padding: "20px 12px" },
  sugGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 8, marginTop: 4,
  },
  sugBtn: {
    background: "rgba(221,255,85,0.06)", border: "1px solid rgba(221,255,85,0.15)",
    color: "#DDFF55", padding: "10px 14px", borderRadius: 12,
    fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center",
    gap: 8, transition: "all 0.2s", fontFamily: "inherit", textAlign: "left",
  },
  // Messages
  msgWrap: (role) => ({
    display: "flex", gap: 8, alignItems: "flex-end",
    justifyContent: role === "user" ? "flex-end" : "flex-start",
    maxWidth: "100%",
  }),
  botAvatar: {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    background: "rgba(192,214,234,0.08)", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: 13,
    border: "1px solid rgba(192,214,234,0.1)",
  },
  msgBubble: (role) => ({
    maxWidth: role === "user" ? "78%" : "88%",
    padding: "10px 14px",
    borderRadius: role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
    fontSize: 13.5, lineHeight: 1.55,
    wordWrap: "break-word",
    background: role === "user" ? "#DDFF55" : "rgba(192,214,234,0.06)",
    color: role === "user" ? "#001a2b" : "#d8e4f0",
    border: role === "user" ? "none" : "1px solid rgba(192,214,234,0.08)",
  }),
  // Sources
  sourcesBox: {
    marginTop: 10, paddingTop: 10,
    borderTop: "1px solid rgba(192,214,234,0.08)",
  },
  sourcesTitle: {
    fontSize: 11, fontWeight: 600, color: "#5a7d9a",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6,
  },
  sourcesList: { display: "flex", flexDirection: "column", gap: 5 },
  sourceCard: {
    background: "rgba(0,26,43,0.4)", borderRadius: 8,
    padding: "7px 10px", border: "1px solid rgba(192,214,234,0.06)",
  },
  sourceHeader: { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 },
  specTag: {
    fontSize: 9.5, fontWeight: 700, color: "#001a2b",
    padding: "1px 7px", borderRadius: 10, letterSpacing: 0.3,
  },
  sourcePage: { fontSize: 10, color: "#5a7d9a" },
  sourceTitle: { fontSize: 11.5, color: "#8ba8c4", lineHeight: 1.3 },
  scoreBar: {
    marginTop: 4, height: 3, borderRadius: 2,
    background: "rgba(192,214,234,0.08)", position: "relative", overflow: "hidden",
  },
  scoreFill: {
    height: "100%", borderRadius: 2, background: "rgba(221,255,85,0.35)",
    transition: "width 0.5s ease",
  },
  scoreText: {
    position: "absolute", right: 0, top: -12,
    fontSize: 9, color: "#5a7d9a",
  },
  tokenInfo: { fontSize: 9, color: "#3d5a73", marginTop: 4, textAlign: "right" },
  // Typing
  typing: { display: "flex", gap: 5, alignItems: "center" },
  dot: (i) => ({
    width: 6, height: 6, background: "#5a7d9a", borderRadius: "50%",
    animation: "chatblink 1.4s infinite both", animationDelay: `${i * 0.2}s`,
  }),
  // Input
  inputRow: {
    display: "flex", gap: 8, padding: "12px 14px",
    borderTop: "1px solid rgba(192,214,234,0.1)",
    background: "rgba(0,34,51,0.4)",
  },
  input: {
    flex: 1, background: "rgba(0,26,43,0.5)",
    border: "1px solid rgba(192,214,234,0.12)", borderRadius: 12,
    padding: "10px 14px", color: "#F6F2E8", fontSize: 13.5,
    fontFamily: "inherit", resize: "none", outline: "none",
    minHeight: 42, maxHeight: 100, transition: "border-color 0.2s",
  },
  sendBtn: {
    background: "#DDFF55", border: "none", borderRadius: 12,
    width: 42, height: 42, display: "flex", alignItems: "center",
    justifyContent: "center", color: "#001a2b", cursor: "pointer",
    transition: "all 0.15s", flexShrink: 0,
  },
};
