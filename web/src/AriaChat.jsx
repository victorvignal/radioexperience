import { useState, useRef } from "react";

const DEFAULT_API = "https://aria-backend-production-176b.up.railway.app/chat";
const API_URL = (() => {
  if (typeof window !== "undefined") {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("api") || window.ARIA_API_URL || import.meta.env.VITE_ARIA_API || DEFAULT_API;
  }
  return import.meta.env.VITE_ARIA_API || DEFAULT_API;
})();

export default function AriaChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const imageToSend = imagePreview;
    const imagePayload = imageBase64;
    setBusy(true);
    setInput("");
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessages(prev => [...prev, { role: "user", text: q, image: imageToSend }]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 5, image_base64: imagePayload || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages(prev => [...prev, { role: "bot", text: `Erro: ${err.detail || "Falha na conexão"}` }]);
      } else {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "bot", text: data.answer, sources: data.sources }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "Não foi possível conectar ao servidor ARIA." }]);
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
      borderRadius: 20,
      overflow: "hidden",
      maxWidth: 700,
      margin: "24px auto 0",
      backdropFilter: "blur(20px)",
    },
    messages: {
      height: 340,
      overflowY: "auto",
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    welcome: {
      textAlign: "center",
      color: "#8ba8c4",
      padding: "24px 12px",
      fontSize: 14,
    },
    msg: (role) => ({
      maxWidth: "85%",
      padding: "10px 14px",
      borderRadius: role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
      fontSize: 13.5,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      wordWrap: "break-word",
      alignSelf: role === "user" ? "flex-end" : "flex-start",
      background: role === "user" ? "#DDFF55" : "rgba(192,214,234,0.08)",
      color: role === "user" ? "#001a2b" : "#F6F2E8",
      border: role === "user" ? "none" : "1px solid rgba(192,214,234,0.12)",
    }),
    sources: {
      marginTop: 8,
      paddingTop: 8,
      borderTop: "1px solid rgba(192,214,234,0.1)",
      fontSize: 11,
      color: "#5a7d9a",
    },
    typing: {
      display: "flex",
      gap: 4,
      padding: "10px 14px",
      alignSelf: "flex-start",
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
      padding: "12px 14px",
      borderTop: "1px solid rgba(192,214,234,0.12)",
      background: "rgba(0,34,51,0.5)",
    },
    input: {
      flex: 1,
      background: "rgba(0,26,43,0.6)",
      border: "1px solid rgba(192,214,234,0.15)",
      borderRadius: 10,
      padding: "10px 12px",
      color: "#F6F2E8",
      fontSize: 13.5,
      fontFamily: "inherit",
      resize: "none",
      outline: "none",
      minHeight: 40,
      maxHeight: 100,
    },
    sendBtn: {
      background: "#DDFF55",
      border: "none",
      borderRadius: 10,
      padding: "10px 16px",
      color: "#001a2b",
      fontSize: 15,
      fontWeight: 700,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.5 : 1,
      alignSelf: "flex-end",
    },
    uploadBtn: {
      background: "#DDFF55",
      border: "none",
      borderRadius: 10,
      padding: "10px 12px",
      color: "#001a2b",
      fontSize: 16,
      fontWeight: 700,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.5 : 1,
      alignSelf: "flex-end",
    },
    previewRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px 0",
    },
    previewBox: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: 6,
      borderRadius: 12,
      background: "rgba(0,34,51,0.5)",
      border: "1px solid rgba(192,214,234,0.12)",
    },
    previewImg: {
      height: 80,
      width: "auto",
      borderRadius: 8,
      border: "1px solid rgba(192,214,234,0.2)",
    },
    previewRemove: {
      background: "rgba(221,255,85,0.2)",
      border: "none",
      borderRadius: 8,
      padding: "4px 8px",
      color: "#DDFF55",
      cursor: "pointer",
      fontWeight: 700,
    },
    msgImage: {
      display: "block",
      maxHeight: 140,
      borderRadius: 10,
      marginBottom: 6,
      border: "1px solid rgba(192,214,234,0.2)",
    },
    sugRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "center",
      padding: "0 14px 14px",
    },
    sug: {
      background: "rgba(221,255,85,0.08)",
      border: "1px solid rgba(221,255,85,0.2)",
      color: "#DDFF55",
      padding: "6px 12px",
      borderRadius: 20,
      fontSize: 12,
      cursor: "pointer",
    },
  };

  return (
    <div style={styles.wrapper}>
      <style>{`@keyframes chatblink{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
      <div ref={chatRef} style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <p style={{ fontSize: 24, marginBottom: 6 }}>🩻</p>
            <p style={{ fontWeight: 700, color: "#F6F2E8", marginBottom: 4 }}>ARIA — Assistente de Radiologia por IA</p>
            <p>Pergunte sobre anatomia, técnicas, patologias ou diagnóstico por imagem.</p>
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
            {m.text}
            {m.sources && m.sources.length > 0 && (
              <div style={styles.sources}>
                <strong>📚 Fontes:</strong>
                {m.sources.slice(0, 3).map((s, j) => {
                  // Clean up filename: remove prefixes, suffixes, replace underscores
                  let title = s.title
                    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Livro_/i, '')
                    .replace(/^(Mama|Neurorradiologia|Abdome|Torax|Pediatria|Geral|Ms|intervencao|Vascular|radioprotecao|Cabeca_Pescoco|Obstetricia|Urgencia)_Artigo_/i, '')
                    .replace(/_Semautor_SemAno.*$/i, '')
                    .replace(/_DUP\d+$/i, '')
                    .replace(/_Revisar/gi, '')
                    .replace(/_/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                  const pg = s.page_start ? ` (p. ${s.page_start}${s.page_end && s.page_end !== s.page_start ? `-${s.page_end}` : ""})` : "";
                  return <div key={j}>• {title}{pg}</div>;
                })}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div style={styles.typing}>
            {[0, 1, 2].map(i => <span key={i} style={styles.dot(i)} />)}
          </div>
        )}
      </div>
      {imagePreview && (
        <div style={styles.previewRow}>
          <div style={styles.previewBox}>
            <img src={imagePreview} alt="Prévia" style={styles.previewImg} />
            <button style={styles.previewRemove} onClick={clearImage}>X</button>
          </div>
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
