import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = pdfWorker;

const C = {
  bg: "#001a2b",
  bgDeep: "#002233",
  glass: "rgba(192,214,234,0.07)",
  glassHover: "rgba(192,214,234,0.13)",
  glassBorder: "rgba(192,214,234,0.15)",
  border: "rgba(192,214,234,0.1)",
  text: "#F6F2E8",
  textSoft: "#C0D6EA",
  textMuted: "#8ba8c4",
  textDim: "#5a7d9a",
  accent: "#DDFF55",
  accentGlow: "rgba(221,255,85,0.15)",
  accentSoft: "rgba(221,255,85,0.08)",
  green: "#5ef0b0",
  red: "#ff6b6b",
};

const API_BASE = "https://aria-backend-production-176b.up.railway.app";

export default function AdminUpload() {
  const { userRole, loading: authLoading } = useAuth();
  const isStaff = userRole === "staff" || userRole === "admin";
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const inputRef = useRef(null);

  if (authLoading) {
    return <div style={{ minHeight: '100vh', background: C.bg }} />;
  }

  if (!isStaff) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg}}
        `}</style>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "120px 20px" }}>
          <div style={{ borderRadius: 20, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 28 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: C.textDim, marginBottom: 10 }}>
              Acesso restrito
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 8 }}>Acesso negado</h1>
            <p style={{ color: C.textMuted, fontSize: 14 }}>Esta área é exclusiva para equipe staff e administradores.</p>
          </div>
        </div>
      </div>
    );
  }

  const onSelect = (f) => {
    setFile(f);
    setResult(null);
    setError("");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onSelect(f);
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    setStatusText("Preparando imagem...");
    try {
      const images = [];
      let pageCount = 1;

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
        setStatusText("Convertendo PDF em imagens...");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const maxPages = Math.min(pdf.numPages, 2);
        pageCount = maxPages;

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context indisponível no navegador");
          await page.render({ canvasContext: ctx, viewport }).promise;
          const base64 = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
          images.push(base64);
        }
      } else if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Não foi possível ler a imagem"));
          reader.readAsDataURL(file);
        });
        const base64 = String(dataUrl).split(",")[1];
        if (!base64) throw new Error("Imagem inválida para upload");
        images.push(base64);
      } else {
        throw new Error("Envie um PDF ou uma imagem da escala");
      }

      setStatusText("Enviando imagem para o servidor...");
      const res = await fetch(`${API_BASE}/upload-shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, source_file: file.name, pageCount }),
      });

      const submitBody = await res.json().catch(() => null);
      if (!res.ok) {
        const backendDetail = submitBody?.detail || submitBody?.error;
        throw new Error(
          backendDetail
            ? `Backend ${res.status}: ${typeof backendDetail === 'object' ? JSON.stringify(backendDetail) : backendDetail}`
            : `Backend ${res.status}: falha ao iniciar processamento`
        );
      }

      const jobId = submitBody?.job_id;
      let finalResult;

      if (jobId) {
        setStatusText("Processando com IA... isso pode levar alguns minutos");
        const finalJob = await new Promise((resolve, reject) => {
          let done = false;
          const poll = setInterval(async () => {
            if (done) return;
            try {
              const statusRes = await fetch(`${API_BASE}/upload-shifts/status/${jobId}`);
              const job = await statusRes.json().catch(() => null);
              if (!statusRes.ok) { done = true; clearInterval(poll); reject(new Error(`Erro ao consultar status (${statusRes.status})`)); return; }
              if (job?.status === "pending") { setStatusText("Aguardando fila de processamento..."); }
              else if (job?.status === "processing") { setStatusText("Processando com IA... isso pode levar alguns minutos"); }
              else if (job?.status === "completed") { done = true; clearInterval(poll); resolve(job); }
              else if (job?.status === "failed") { done = true; clearInterval(poll); reject(new Error(job?.error || "Erro no processamento")); }
            } catch (pollErr) { done = true; clearInterval(poll); reject(pollErr); }
          }, 3000);
          setTimeout(() => { if (!done) { done = true; clearInterval(poll); reject(new Error("Tempo limite excedido")); } }, 20 * 60 * 1000);
        });
        finalResult = finalJob.result;
      } else {
        setStatusText("Processando...");
        const avail = submitBody?.available || 0;
        const tot = submitBody?.total || 0;
        finalResult = {
          ...submitBody,
          message: submitBody?.message || `${tot} vagas processadas`,
          total: tot,
          summary: submitBody?.summary || { created: avail, updated: 0, deactivated: 0, unchanged: tot - avail },
        };
      }

      setResult(finalResult);
      setStatusText("");
    } catch (e) {
      console.error('[AdminUpload] upload error:', e);
      setError(e?.message || "Não foi possível processar o PDF agora.");
      setStatusText("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:${C.bg}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "100px 20px 60px" }}>
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
            borderRadius: 20,
            padding: "36px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => onSelect(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textSoft }}>Arraste o PDF ou uma imagem aqui, ou clique para selecionar</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>PDF, foto ou screenshot da escala</div>
          {file && (
            <div style={{ marginTop: 14, fontSize: 13, color: C.accent }}>{file.name}</div>
          )}
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={upload}
            disabled={!file || loading}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              cursor: !file || loading ? "not-allowed" : "pointer",
              fontWeight: 700,
              color: C.bgDeep,
              background: C.accent,
              boxShadow: `0 0 20px ${C.accentGlow}`,
              opacity: !file || loading ? 0.6 : 1,
            }}
          >
            {loading ? "Processando..." : "Enviar PDF"}
          </button>
          {file && !loading && (
            <button
              onClick={() => onSelect(null)}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: `1px solid ${C.glassBorder}`,
                background: "transparent",
                color: C.textSoft,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {loading && statusText && (
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 20, height: 20,
              border: `2px solid ${C.glassBorder}`,
              borderTop: `2px solid ${C.accent}`,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ color: C.accent, fontSize: 14, fontWeight: 600, animation: "pulse 1.5s ease-in-out infinite" }}>{statusText}</span>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 20, borderRadius: 14, border: `1px solid ${C.red}33`, background: "rgba(255,107,107,0.08)", padding: 16 }}>
            <div style={{ color: C.red, fontWeight: 700, marginBottom: 6 }}>❌ Erro no upload</div>
            <div style={{ color: C.textSoft, fontSize: 13, marginBottom: 12, wordBreak: "break-word" }}>{error}</div>
            <button
              onClick={upload}
              style={{
                padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.red}44`,
                background: "transparent", color: C.red, cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24, background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18, padding: 18 }}>
            <div style={{ fontWeight: 700, color: C.green }}>{result.message}</div>
            <div style={{ color: C.textMuted, marginTop: 8 }}>Total sincronizado: {result.total} | Disponíveis: {result.available}</div>

            {result.summary && (
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {[
                  ['Novas', result.summary.created, C.accent],
                  ['Atualizadas', result.summary.updated, C.green],
                  ['Desativadas', result.summary.deactivated, C.red],
                  ['Sem mudança', result.summary.unchanged, C.textSoft],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ borderRadius: 14, border: `1px solid ${C.glassBorder}`, background: 'rgba(255,255,255,0.02)', padding: 12 }}>
                    <div style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                    <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {result.identity_key && (
              <div style={{ marginTop: 12, color: C.textMuted, fontSize: 13 }}>
                <strong>Chave de sincronização:</strong> {result.identity_key}
              </div>
            )}

            {result.locations && result.locations.length > 0 && (
              <div style={{ marginTop: 12, color: C.textSoft }}>
                <strong>Locais:</strong> {result.locations.join(", ")}
              </div>
            )}

            {result.batch_id && (
              <div style={{ marginTop: 10, color: C.textDim, fontSize: 12 }}>
                Lote: {result.batch_id}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
