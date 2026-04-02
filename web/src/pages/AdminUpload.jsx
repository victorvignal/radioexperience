import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const C = {
  bg: "#001a2b", bgDeep: "#002233",
  glass: "rgba(192,214,234,0.07)", glassHover: "rgba(192,214,234,0.13)",
  glassBorder: "rgba(192,214,234,0.15)", border: "rgba(192,214,234,0.1)",
  text: "#F6F2E8", textSoft: "#C0D6EA", textMuted: "#8ba8c4", textDim: "#5a7d9a",
  accent: "#DDFF55", accentGlow: "rgba(221,255,85,0.15)", accentSoft: "rgba(221,255,85,0.08)",
  green: "#5ef0b0", red: "#ff6b6b",
};

const API_BASE = "https://aria-backend-production-176b.up.railway.app";

async function getPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

async function pdfToImages(file) {
  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];
  const maxPages = Math.min(pdf.numPages, 4);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
  }
  return images;
}

export default function AdminUpload() {
  const { user, userRole } = useAuth();
  const isStaff = userRole === "staff" || userRole === "admin";
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const [statusMsg, setStatusMsg] = useState("");

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8 }}>Login necessário</h2>
          <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 20 }}>Faça login para acessar o upload de escalas.</p>
          <a href="/login" style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 12,
            background: C.accent, color: C.bgDeep, fontWeight: 700, fontSize: 14,
            textDecoration: "none", boxShadow: `0 0 20px ${C.accentGlow}`,
          }}>Fazer Login</a>
        </div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,sans-serif" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "120px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8 }}>Acesso restrito</h2>
          <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 8 }}>Esta área é exclusiva para equipe staff e administradores.</p>
          <p style={{ color: C.textDim, fontSize: 13, marginBottom: 24 }}>Seu perfil: <strong style={{ color: C.textSoft }}>{userRole || "user"}</strong></p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/dashboard" style={{
              padding: "12px 24px", borderRadius: 12, border: `1px solid ${C.glassBorder}`,
              background: C.glass, color: C.textSoft, fontWeight: 600, fontSize: 14, textDecoration: "none",
            }}>← Voltar ao Dashboard</a>
            <a href="/feed" style={{
              padding: "12px 24px", borderRadius: 12, background: C.accent, color: C.bgDeep,
              fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: `0 0 20px ${C.accentGlow}`,
            }}>Ir para o Feed</a>
          </div>
        </div>
      </div>
    );
  }

  const onSelect = (f) => { setFile(f); setResult(null); setError(""); };
  const onDrop = (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) onSelect(f); };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setStatusMsg("Convertendo PDF em imagens...");
      const images = await pdfToImages(file);

      setStatusMsg("Enviando para IA processar (pode levar até 1 minuto)...");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`${API_BASE}/upload-shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Falha ao processar");
      }
      const data = await res.json();
      setResult(data);
      setStatusMsg("");
    } catch (e) {
      setError(e.name === "AbortError" ? "Tempo esgotado. Tente novamente." : (e.message || "Não foi possível processar o PDF."));
      setStatusMsg("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:${C.bg}}`}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(0,26,43,0.9)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 20px" }}>
          <a href="/dashboard" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none", fontWeight: 500 }}>← Dashboard</a>
          <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>📤 Upload de Escala</span>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "80px 20px 60px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: C.text }}>Upload de Escala</h1>
          <p style={{ color: C.textMuted, marginTop: 8 }}>Envie o PDF da escala para atualizar as vagas no sistema.</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? C.accent : C.glassBorder}`,
            background: dragging ? C.glassHover : C.glass,
            borderRadius: 20, padding: "36px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.2s",
          }}
        >
          <input ref={inputRef} type="file" accept="application/pdf" onChange={(e) => onSelect(e.target.files?.[0] || null)} style={{ display: "none" }} />
          <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textSoft }}>Arraste o PDF aqui ou clique para selecionar</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>Somente PDF</div>
          {file && <div style={{ marginTop: 14, fontSize: 13, color: C.accent }}>{file.name}</div>}
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={upload} disabled={!file || loading} style={{
            padding: "12px 24px", borderRadius: 12, border: "none",
            cursor: !file || loading ? "not-allowed" : "pointer",
            fontWeight: 700, color: C.bgDeep, background: C.accent,
            boxShadow: `0 0 20px ${C.accentGlow}`, opacity: !file || loading ? 0.6 : 1,
          }}>
            {loading ? (statusMsg || "Processando...") : "Enviar PDF"}
          </button>
          {file && !loading && (
            <button onClick={() => onSelect(null)} style={{
              padding: "12px 20px", borderRadius: 12, border: `1px solid ${C.glassBorder}`,
              background: "transparent", color: C.textSoft, cursor: "pointer", fontWeight: 600,
            }}>Limpar</button>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 12, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: C.red, fontWeight: 600 }}>{error}</div>
        )}

        {result && (
          <div style={{ marginTop: 24, background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18, padding: 18 }}>
            <div style={{ fontWeight: 700, color: C.green }}>{result.message}</div>
            <div style={{ color: C.textMuted, marginTop: 8 }}>Total: {result.total} | Disponíveis: {result.available}</div>
            {result.locations && result.locations.length > 0 && (
              <div style={{ marginTop: 12, color: C.textSoft }}><strong>Locais:</strong> {result.locations.join(", ")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
