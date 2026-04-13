import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { buildPostMetadata, readImagePreview, uploadPostImage, validateImageFile } from "../lib/postImages";

const C = {
  bg: "#001a2b",
  bgDeep: "#002233",
  glass: "rgba(192,214,234,0.07)",
  glassBorder: "rgba(192,214,234,0.15)",
  border: "rgba(192,214,234,0.1)",
  text: "#F6F2E8",
  textSoft: "#C0D6EA",
  textMuted: "#8ba8c4",
  textDim: "#5a7d9a",
  accent: "#DDFF55",
  accentGlow: "rgba(221,255,85,0.15)",
  accentSoft: "rgba(221,255,85,0.08)",
  red: "#ff6b6b",
  green: "#5ef0b0",
};

const TYPE_OPTIONS = [
  { value: "post", label: "Post" },
  { value: "article", label: "Artigo" },
  { value: "case", label: "Caso Clínico" },
  { value: "review", label: "Revisão" },
  { value: "news", label: "Notícia" },
  { value: "vaga", label: "Vaga" },
];

const ARTICLE_TYPES = ["article", "case", "review", "news"];

const inputStyle = {
  width: "100%",
  background: "rgba(0,26,43,0.6)",
  border: `1px solid ${C.glassBorder}`,
  borderRadius: 10,
  padding: "11px 14px",
  color: C.text,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.2s",
};

export default function NewPost() {
  const { user, isAdmin, isStaff } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("post");
  const [journal, setJournal] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState("public");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [error, setError] = useState("");

  const allowedTypes = TYPE_OPTIONS.filter((t) => {
    if (t.value === "vaga") return isStaff;
    if (ARTICLE_TYPES.includes(t.value)) return isAdmin;
    return true;
  });

  const isArticleType = ARTICLE_TYPES.includes(type);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError("Título e conteúdo são obrigatórios.");
      return;
    }
    if (isArticleType && !isAdmin) {
      setError("Apenas administradores podem publicar artigos.");
      return;
    }
    if (type === "vaga" && !isStaff) {
      setError("Apenas staff/admin pode publicar vagas.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadPostImage(imageFile, user?.id);
      }

      const { error: err } = await supabase.from("posts").insert({
        user_id: user?.id || null,
        title: title.trim(),
        content: content.trim(),
        type,
        journal: journal.trim() || null,
        source_url: sourceUrl.trim() || null,
        status: "published",
        is_agent: false,
        visibility,
        metadata: buildPostMetadata({}, imageUrl),
      });

      if (err) throw err;
      navigate("/feed");
    } catch (err) {
      console.error("Error creating post:", err);
      setError("Erro ao publicar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg}}
        textarea{resize:vertical}
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "80px 20px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button
            onClick={() => navigate("/feed")}
            style={{
              background: "transparent",
              border: `1px solid ${C.glassBorder}`,
              borderRadius: 8,
              padding: "6px 12px",
              color: C.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Feed
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Novo Conteúdo</h1>
        </div>

        {/* Form */}
        <div
          style={{
            borderRadius: 20,
            background: C.glass,
            border: `1px solid ${C.glassBorder}`,
            backdropFilter: "blur(12px)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Tipo
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {allowedTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 20,
                    border: `1px solid ${type === t.value ? "rgba(221,255,85,0.3)" : C.glassBorder}`,
                    background: type === t.value ? C.accentSoft : "transparent",
                    color: type === t.value ? C.accent : C.textMuted,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Título *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Achados de RM na esclerose múltipla"
              style={inputStyle}
            />
          </div>

          {/* Content */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Conteúdo *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva seu artigo, discussão ou compartilhe um caso clínico..."
              rows={12}
              style={{ ...inputStyle, minHeight: 200, lineHeight: 1.65 }}
            />
          </div>

          {isArticleType && (
            <>
              {/* Journal */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Journal / Fonte (opcional)
                </label>
                <input
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                  placeholder="Ex: Radiology, AJR, European Radiology"
                  style={inputStyle}
                />
              </div>

              {/* Source URL */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Link da fonte (opcional)
                </label>
                <input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://doi.org/..."
                  style={inputStyle}
                />
              </div>
            </>
          )}


          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Imagem (opcional)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={async (e) => {
                const file = e.target.files?.[0] || null;
                try {
                  setError("");
                  validateImageFile(file);
                  setImageFile(file);
                  setImagePreview(file ? await readImagePreview(file) : "");
                } catch (err) {
                  setImageFile(null);
                  setImagePreview("");
                  setError(err.message || "Imagem inválida.");
                }
              }}
              style={{ ...inputStyle, padding: "10px 12px" }}
            />
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>JPG, PNG, WEBP ou GIF.</div>
            {imagePreview && (
              <div style={{ marginTop: 12 }}>
                <img src={imagePreview} alt="Prévia" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 14, border: `1px solid ${C.glassBorder}` }} />
              </div>
            )}
          </div>

          {/* Visibilidade */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Visibilidade
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {[{ v: "public", l: "Público", icon: "\u{1F310}" }, { v: "private", l: "Somente eu", icon: "\u{1F512}" }].map((opt) => (
                <button key={opt.v} onClick={() => setVisibility(opt.v)} style={{
                  padding: "8px 16px", borderRadius: 10,
                  border: `1px solid ${visibility === opt.v ? "rgba(221,255,85,0.3)" : C.glassBorder}`,
                  background: visibility === opt.v ? C.accentSoft : "transparent",
                  color: visibility === opt.v ? C.accent : C.textMuted,
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>
                  {opt.icon} {opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "rgba(255,107,107,0.08)",
                border: "1px solid rgba(255,107,107,0.2)",
                color: C.red,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              onClick={() => navigate("/feed")}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: `1px solid ${C.glassBorder}`,
                background: "transparent",
                color: C.textMuted,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !title.trim() || !content.trim()}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                border: "none",
                background: saving || !title.trim() || !content.trim() ? "rgba(221,255,85,0.3)" : C.accent,
                color: C.bgDeep,
                fontSize: 13,
                fontWeight: 700,
                cursor: saving || !title.trim() || !content.trim() ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                boxShadow: `0 0 16px ${C.accentGlow}`,
                transition: "all 0.15s",
              }}
            >
              {saving ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
