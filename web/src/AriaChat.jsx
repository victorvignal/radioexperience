import { useState, useRef, useEffect } from "react";

const DEFAULT_API = "https://aria-backend-production-176b.up.railway.app/chat";
const API_URL = (() => {
  if (typeof window !== "undefined") {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("api") || window.ARIA_API_URL || import.meta.env.VITE_ARIA_API || DEFAULT_API;
  }
  return import.meta.env.VITE_ARIA_API || DEFAULT_API;
})();

const formatTime = (date = new Date()) =>
  date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function AriaChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  const scrollToBottom = () => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const imageToSend = imagePreview;
    const imagePayload = imageBase64;
    const ts = formatTime();
    setBusy(true);
    setInput("");
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessages(prev => [...prev, { role: "user", text: q, image: imageToSend, ts }]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 5, image_base64: imagePayload || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages(prev => [...prev, { role: "bot", text: `Erro: ${err.detail || "Falha na conexão"}`, ts: formatTime() }]);
      } else {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "bot", text: data.answer, sources: data.sources, ts: formatTime() }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "Não foi possível conectar ao servidor ARIA.", ts: formatTime() }]);
    }
    setBusy(false);
    setTimeout(scrollToBottom, 50);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      const base64 = ev.target.result.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const suggestions = ["O que é BI-RADS?", "Anatomia da mama", "Técnica radiológica do tórax", "Categorias do BI-RADS"];

  const styles = {
    wrapper: {
      background: "rgba(0,26,43,0.6)",
      border: "1px solid rgba(192,214,234,0.15)",
      borderRadius: isMobile ? 0 : 20,
      overflow: "hidden",
      maxWidth: isMobile ? "100%" : 700,
      width: "100%",
      margin: isMobile ? 0 : "24px auto 0",
      backdropFilter: "blur(20px)",
      display: "flex",
      flexDirection: "column",
      height: isMobile ? "100vh" : "auto",
    },
    messages: {
      flex: 1,
      overflowY: "auto",
      padding: isMobile ? 16 : 18,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minHeight: isMobile ? "calc(100vh - 170px)" : 340,
    },
    welcome: {
      textAlign: "center",
      color: "#8ba8c4",
      padding: isMobile ? "32px 16px" : "24px 12px",
      fontSize: 14,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
    },
    welcomeAvatar: {
      width: 72,
      height: 72,
      borderRadius: "50%",
      background: "rgba(221,255,85,0.08)",
      border: "1px solid rgba(221,255,85,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#DDFF55",
      fontWeight: 800,
      fontSize: 18,
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    },
    welcomeTitle: {
      fontWeight: 800,
      color: "#F6F2E8",
      fontSize: 20,
      letterSpacing: 0.4,
    },
    welcomeSubtitle: {
      color: "#8ba8c4",
      fontSize: 14,
      marginTop: -2,
    },
    msg: (role) => ({
      maxWidth: "85%",
      padding: "12px 16px",
      borderRadius: 16,
      fontSize: isMobile ? 15 : 13.5,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      wordWrap: "break-word",
      alignSelf: role === "user" ? "flex-end" : "flex-start",
      background: role === "user" ? "#DDFF55" : "rgba(192,214,234,0.12)",
      color: role === "user" ? "#001a2b" : "#F6F2E8",
      border: role === "user" ? "none" : "1px solid rgba(192,214,234,0.18)",
      boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
    }),
    msgMeta: {
      marginTop: 6,
      fontSize: 11,
      color: "rgba(139,168,196,0.75)",
      textAlign: "right",
    },
    markdown: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
    },
    paragraph: {
      margin: 0,
      lineHeight: 1.6,
    },
    header: {
      fontSize: 16,
      fontWeight: 800,
      margin: 0,
      letterSpacing: 0.2,
    },
    bold: {
      fontWeight: 800,
    },
    list: {
      margin: "2px 0 0 18px",
      padding: 0,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    listItem: {
      margin: 0,
      lineHeight: 1.6,
    },
    citation: {
      fontSize: 12,
      color: "#8ba8c4",
      fontStyle: "italic",
    },
    sources: {
      marginTop: 8,
      paddingTop: 8,
      borderTop: "1px solid rgba(192,214,234,0.1)",
      fontSize: 11,
      color: "#5a7d9a",
    },
    typing: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "10px 14px",
      alignSelf: "flex-start",
    },
    typingDots: {
      display: "flex",
      gap: 4,
    },
    typingText: {
      fontSize: 12,
      color: "#8ba8c4",
      fontStyle: "italic",
    },
    dot: (i) => ({
      width: 7,
      height: 7,
      background: "#5a7d9a",
      borderRadius: "50%",
      animation: "chatblink 1.4s infinite both",
      animationDelay: `${i * 0.2}s`,
    }),
    inputRow: {
      display: "flex",
      gap: 8,
      padding: isMobile ? "12px 12px" : "12px 14px",
      borderTop: "1px solid rgba(192,214,234,0.12)",
      background: "rgba(0,34,51,0.7)",
      position: isMobile ? "sticky" : "relative",
      bottom: isMobile ? 0 : "auto",
      zIndex: 2,
    },
    input: {
      flex: 1,
      background: "rgba(0,26,43,0.6)",
      border: "1px solid rgba(192,214,234,0.15)",
      borderRadius: 12,
      padding: "12px 14px",
      color: "#F6F2E8",
      fontSize: isMobile ? 15 : 13.5,
      fontFamily: "inherit",
      resize: "none",
      outline: "none",
      minHeight: 48,
      maxHeight: 120,
    },
    sendBtn: {
      background: "#DDFF55",
      border: "none",
      borderRadius: 12,
      minWidth: 48,
      minHeight: 48,
      padding: "0 16px",
      color: "#001a2b",
      fontSize: 16,
      fontWeight: 800,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.5 : 1,
      alignSelf: "flex-end",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    uploadBtn: {
      background: "#DDFF55",
      border: "none",
      borderRadius: 12,
      minWidth: 48,
      minHeight: 48,
      padding: "0 12px",
      color: "#001a2b",
      fontSize: 18,
      fontWeight: 800,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.5 : 1,
      alignSelf: "flex-end",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    previewRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px 0",
      flexDirection: "column",
      alignItems: "flex-start",
    },
    previewBox: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: 6,
      borderRadius: 12,
      background: "rgba(0,34,51,0.5)",
      border: "1px solid rgba(192,214,234,0.12)",
      width: "100%",
    },
    previewImg: {
      height: 80,
      width: "auto",
      maxWidth: "100%",
      borderRadius: 8,
      border: "1px solid rgba(192,214,234,0.2)",
    },
    previewRemove: {
      background: "rgba(221,255,85,0.2)",
      border: "none",
      borderRadius: 8,
      padding: "6px 10px",
      color: "#DDFF55",
      cursor: "pointer",
      fontWeight: 800,
      minHeight: 36,
    },
    previewTip: {
      fontSize: 12,
      color: "#8ba8c4",
      fontStyle: "italic",
      paddingLeft: 4,
    },
    msgImage: {
      display: "block",
      maxHeight: 180,
      maxWidth: "100%",
      borderRadius: 10,
      marginBottom: 6,
      border: "1px solid rgba(192,214,234,0.2)",
    },
    sugRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
      padding: "8px 14px 0",
    },
    sug: {
      background: "rgba(221,255,85,0.08)",
      border: "1px solid rgba(221,255,85,0.2)",
      color: "#DDFF55",
      padding: "8px 14px",
      borderRadius: 999,
      fontSize: 12,
      cursor: "pointer",
    },
  };

  const renderInline = (text, baseKey) => {
    const parts = text.split(/(\[Fonte:[^\]]+\])/g);
    const nodes = [];
    parts.forEach((part, idx) => {
      if (!part) return;
      if (/^\[Fonte:[^\]]+\]$/.test(part)) {
        nodes.push(
          <span key={`${baseKey}-c-${idx}`} style={styles.citation}>{part}</span>
        );
        return;
      }
      const boldParts = part.split(/(\*\*.+?\*\*)/g);
      boldParts.forEach((bp, j) => {
        if (!bp) return;
        if (/^\*\*.+\*\*$/.test(bp)) {
          nodes.push(
            <strong key={`${baseKey}-b-${idx}-${j}`} style={styles.bold}>{bp.slice(2, -2)}</strong>
          );
        } else {
          nodes.push(<span key={`${baseKey}-t-${idx}-${j}`}>{bp}</span>);
        }
      });
    });
    return nodes;
  };

  const renderMarkdown = (text, keyBase) => {
    const lines = text.split(/\r?\n/);
    const blocks = [];
    let listItems = [];
    const flushList = () => {
      if (listItems.length > 0) {
        blocks.push(
          <ul key={`${keyBase}-ul-${blocks.length}`} style={styles.list}>
            {listItems}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, idx) => {
      if (!line.trim()) {
        flushList();
        return;
      }
      const headerMatch = line.match(/^###\s+(.*)/);
      const boldHeaderMatch = line.match(/^\*\*(.+)\*\*$/);
      if (headerMatch || boldHeaderMatch) {
        flushList();
        const content = headerMatch ? headerMatch[1] : boldHeaderMatch[1];
        blocks.push(
          <div key={`${keyBase}-h-${idx}`} style={styles.header}>
            {renderInline(content, `${keyBase}-h-${idx}`)}
          </div>
        );
        return;
      }
      const listMatch = line.match(/^[-*•]\s+(.*)/);
      if (listMatch) {
        listItems.push(
          <li key={`${keyBase}-li-${idx}`} style={styles.listItem}>
            {renderInline(listMatch[1], `${keyBase}-li-${idx}`)}
          </li>
        );
        return;
      }
      flushList();
      blocks.push(
        <p key={`${keyBase}-p-${idx}`} style={styles.paragraph}>
          {renderInline(line, `${keyBase}-p-${idx}`)}
        </p>
      );
    });
    flushList();
    return blocks;
  };

  return (
    <div style={styles.wrapper}>
      <style>{`@keyframes chatblink{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
      <div ref={chatRef} style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <div style={styles.welcomeAvatar}>ARIA</div>
            <div style={styles.welcomeTitle}>ARIA</div>
            <div style={styles.welcomeSubtitle}>Assistente de Radiologia por IA</div>
            <div style={{ color: "#8ba8c4", fontSize: 13 }}>
              Pergunte sobre anatomia, técnicas, patologias ou diagnóstico por imagem.
            </div>
            <div style={styles.sugRow}>
              {suggestions.map((s, i) => (
                <button key={i} style={styles.sug} onClick={() => { setInput(s); }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={styles.msg(m.role)}>
            {m.image && <img src={m.image} alt="Imagem enviada" style={styles.msgImage} />}
            <div style={styles.markdown}>{renderMarkdown(m.text, `msg-${i}`)}</div>
            {m.sources && m.sources.length > 0 && (
              <div style={styles.sources}>
                <strong>📚 Fontes:</strong>
                {m.sources.slice(0, 3).map((s, j) => {
                  // Clean up filename: remove prefixes, suffixes, replace underscores
                  let title = s.title
                    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Livro_/i, "")
                    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Artigo_/i, "")
                    .replace(/_Semautor_SemAno.*$/i, "")
                    .replace(/_DUP\d+$/i, "")
                    .replace(/_Revisar/gi, "")
                    .replace(/_/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                  const pg = s.page_start ? ` (p. ${s.page_start}${s.page_end && s.page_end !== s.page_start ? `-${s.page_end}` : ""})` : "";
                  return <div key={j}>• {title}{pg}</div>;
                })}
              </div>
            )}
            {m.ts && <div style={styles.msgMeta}>{m.ts}</div>}
          </div>
        ))}
        {busy && (
          <div style={styles.typing}>
            <div style={styles.typingDots}>
              {[0, 1, 2].map(i => <span key={i} style={styles.dot(i)} />)}
            </div>
            <div style={styles.typingText}>ARIA está pensando...</div>
          </div>
        )}
      </div>
      {imagePreview && (
        <div style={styles.previewRow}>
          <div style={styles.previewBox}>
            <img src={imagePreview} alt="Prévia" style={styles.previewImg} />
            <button style={styles.previewRemove} onClick={clearImage}>X</button>
          </div>
          <div style={styles.previewTip}>Adicione informações do caso para uma análise mais precisa</div>
        </div>
      )}
      <div style={styles.inputRow}>
        <button
          style={styles.uploadBtn}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          disabled={busy}
          aria-label="Enviar imagem"
        >📷</button>
        <textarea
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Digite sua pergunta..."
          rows={1}
        />
        <button style={styles.sendBtn} onClick={send} disabled={busy}>➤</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageSelect}
        />
      </div>
    </div>
  );
}
