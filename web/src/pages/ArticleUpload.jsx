import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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

const SPECIALTIES = [
  "Abdome", "Cabeça e Pescoço", "Geral", "Mama", "Músculo Esquelético",
  "Neurorradiologia", "Obstetrícia", "Pediatria", "Radiologia Intervencionista",
  "Tórax", "Urgência", "Vascular",
];

const SOURCE_TIERS = [
  { value: "gold", label: "Ouro — Guideline/Textbook principal" },
  { value: "silver", label: "Prata — Revisão sistemática/Artigo forte" },
  { value: "bronze", label: "Bronze — Outros artigos/livros auxiliares" },
  { value: "reference", label: "Referência — Suplementar" },
];

const DOC_TYPES = [
  "Livro", "Artigo", "Guideline", "Protocolo", "Revisão", "Capítulo", "Nota técnica",
];

const inputStyle = {
  width: "100%", background: "rgba(0,26,43,0.6)", border: `1px solid ${C.glassBorder}`,
  borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13,
  fontFamily: "inherit", outline: "none", transition: "border-color 0.2s",
};

const labelStyle = { fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 };

export default function ArticleUpload() {
  const { userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isStaff = userRole === "staff" || userRole === "admin";
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    title: "", author: "", journal: "", specialty: "", modality: "",
    source_tier: "", published_at: "", document_type: "", chapter_title: "",
    confidence_weight: "1.0",
  });
  const [uploading, setUploading] = useState(false);
  const [docId, setDocId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  // Poll upload status
  useEffect(() => {
    if (!docId || completed) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/upload-status/${docId}`);
        if (!res.ok) return;
        const data = await res.json();
        setProgress(data);
        if (data.status === "done" || data.status === "error") {
          clearInterval(interval);
          setCompleted(true);
          if (data.status === "error") setError(data.error || "Erro desconhecido");
        }
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [docId, completed]);

  if (authLoading) return <div style={{ minHeight: "100vh", background: C.bg }} />;

  if (!isStaff) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "120px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Acesso restrito</h1>
          <p style={{ color: C.textMuted }}>Área exclusiva para staff e administradores.</p>
          <button onClick={() => navigate("/dashboard")} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, border: "none", background: C.accent, color: C.bgDeep, fontWeight: 800, cursor: "pointer" }}>Voltar ao Dashboard</button>
        </div>
      </div>
    );
  }

  const onDrop = (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f); };
  const pickFile = (f) => { setFile(f); setError(""); setDocId(null); setProgress(null); setCompleted(false); };

  const handleUpload = async () => {
    if (!file || !form.title.trim()) { setError("Arquivo e título são obrigatórios."); return; }
    setUploading(true); setError(""); setCompleted(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(form)) {
        if (v) fd.append(k, v);
      }
      const res = await fetch(`${API_BASE}/admin/upload-article`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro no upload");
      setDocId(data.document_id);
      setProgress({ status: "queued", progress: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => { setFile(null); setDocId(null); setProgress(null); setError(""); setCompleted(false); setForm({ title: "", author: "", journal: "", specialty: "", modality: "", source_tier: "", published_at: "", document_type: "", chapter_title: "", confidence_weight: "1.0" }); };

  const statusLabels = { queued: "Na fila", extracting: "Extraindo texto", chunking: "Dividindo em blocos", embedding: "Gerando embeddings", storing: "Salvando no Qdrant", done: "Concluído!", error: "Erro" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "90px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate("/dashboard")} style={{ background: "transparent", border: `1px solid ${C.glassBorder}`, borderRadius: 8, color: C.textMuted, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>← Dashboard</button>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Upload de Artigos / Livros</h1>
        </div>
        <p style={{ color: C.textMuted, marginBottom: 24, fontSize: 13 }}>Envie PDFs, TXT ou MD para indexar na base de conhecimento ARIA. O processamento é feito em segundo plano.</p>

        {/* File picker */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? C.accent : C.glassBorder}`,
            background: dragging ? C.glassHover : C.glass, borderRadius: 20,
            padding: "32px 24px", textAlign: "center", cursor: "pointer", marginBottom: 20, transition: "all 0.2s",
          }}
        >
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0] || null)} />
          <div style={{ fontSize: 28, marginBottom: 8 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textSoft }}>
            Arraste o arquivo aqui, ou clique para selecionar
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>PDF, TXT ou MD — até 50 MB</div>
          {file && <div style={{ marginTop: 12, fontSize: 13, color: C.accent, fontWeight: 700 }}>{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</div>}
        </div>

        {/* Metadata form */}
        <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Metadados</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ gridColumn: "span 2" }}>
              <div style={labelStyle}>Título *</div>
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Fundamentals of Diagnostic Radiology" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Autor</div>
              <input value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} placeholder="Ex: Brant & Helms" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Journal / Editora</div>
              <input value={form.journal} onChange={(e) => setForm((p) => ({ ...p, journal: e.target.value }))} placeholder="Ex: Lippincott" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Especialidade</div>
              <select value={form.specialty} onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Selecione</option>
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Modalidade</div>
              <input value={form.modality} onChange={(e) => setForm((p) => ({ ...p, modality: e.target.value }))} placeholder="Ex: TC, RM, RX, USG" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Tier da Fonte</div>
              <select value={form.source_tier} onChange={(e) => setForm((p) => ({ ...p, source_tier: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Selecione</option>
                {SOURCE_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Tipo de Documento</div>
              <select value={form.document_type} onChange={(e) => setForm((p) => ({ ...p, document_type: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Selecione</option>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Data de Publicação</div>
              <input type="date" value={form.published_at} onChange={(e) => setForm((p) => ({ ...p, published_at: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Capítulo</div>
              <input value={form.chapter_title} onChange={(e) => setForm((p) => ({ ...p, chapter_title: e.target.value }))} placeholder="Ex: Chest Imaging" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Peso de Confiança</div>
              <input type="number" step="0.1" min="0" max="2" value={form.confidence_weight} onChange={(e) => setForm((p) => ({ ...p, confidence_weight: e.target.value }))} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={handleUpload} disabled={!file || uploading || (progress && !completed)} style={{
            padding: "12px 24px", borderRadius: 12, border: "none", fontWeight: 800,
            color: C.bgDeep, background: C.accent, cursor: (!file || uploading || (progress && !completed)) ? "not-allowed" : "pointer",
            opacity: (!file || uploading || (progress && !completed)) ? 0.6 : 1,
            boxShadow: `0 0 20px ${C.accentGlow}`,
          }}>
            {uploading ? "Enviando..." : progress && !completed ? "Processando..." : "Enviar e Indexar"}
          </button>
          {(file || docId) && (
            <button onClick={reset} style={{ padding: "12px 20px", borderRadius: 12, border: `1px solid ${C.glassBorder}`, background: "transparent", color: C.textSoft, fontWeight: 600, cursor: "pointer" }}>
              Limpar
            </button>
          )}
        </div>

        {/* Progress bar */}
        {progress && (
          <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textSoft }}>
                {statusLabels[progress.status] || progress.status}
              </div>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 800 }}>{progress.progress}%</div>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(192,214,234,0.1)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3, transition: "width 0.5s ease",
                width: `${progress.progress}%`,
                background: progress.status === "error" ? C.red : progress.status === "done" ? C.green : C.accent,
              }} />
            </div>
            {progress.total_chunks && <div style={{ marginTop: 8, fontSize: 11, color: C.textDim }}>Chunks: {progress.chunks_done || 0} / {progress.total_chunks}</div>}
            {progress.chunks_indexed && <div style={{ marginTop: 4, fontSize: 11, color: C.green }}>✓ {progress.chunks_indexed} blocos indexados no Qdrant</div>}
          </div>
        )}

        {error && <div style={{ color: C.red, fontWeight: 600, marginBottom: 16 }}>{error}</div>}
        {completed && !error && (
          <div style={{ background: "rgba(94,240,176,0.08)", border: "1px solid rgba(94,240,176,0.25)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ color: C.green, fontWeight: 700 }}>✓ Documento indexado com sucesso!</div>
            <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>Os blocos já estão disponíveis para busca pela ARIA.</div>
          </div>
        )}
      </div>
    </div>
  );
}
