/*
  ArticleAdmin — Gerenciar artigos postados no feed
  - Listar artigos publicados (do feed, tipo "article")
  - Criar novo artigo
  - Artigos do agente ARIA aparecem com badge
  - Editar/deletar próprios artigos
*/

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const C = {
  bg: "#001a2b", bgDeep: "#002233",
  glass: "rgba(192,214,234,0.07)", glassHover: "rgba(192,214,234,0.13)",
  glassBorder: "rgba(192,214,234,0.15)", border: "rgba(192,214,234,0.1)",
  text: "#F6F2E8", textSoft: "#C0D6EA", textMuted: "#8ba8c4", textDim: "#5a7d9a",
  accent: "#DDFF55", accentGlow: "rgba(221,255,85,0.15)", accentSoft: "rgba(221,255,85,0.08)",
  pStudy: "#7ecbff", pAria: "#DDFF55",
  green: "#5ef0b0", red: "#ff6b6b", yellow: "#ffd166",
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export default function ArticleAdmin() {
  const { user, userRole } = useAuth();
  const isStaff = userRole === "staff" || userRole === "admin";

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [journal, setJournal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchArticles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("type", "article")
      .order("created_at", { ascending: false })
      .limit(50);
    setArticles(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchArticles(); }, []);

  const resetForm = () => {
    setTitle(""); setContent(""); setSourceUrl(""); setJournal("");
    setFormError(""); setEditing(null); setShowCreate(false);
  };

  const openEdit = (article) => {
    setEditing(article);
    setTitle(article.title || "");
    setContent(article.content || "");
    setSourceUrl(article.metadata?.source_url || "");
    setJournal(article.metadata?.journal || "");
    setFormError("");
    setShowCreate(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !user) return;
    setSubmitting(true);
    setFormError("");

    const payload = {
      title: title.trim(),
      content: content.trim(),
      metadata: {
        source_url: sourceUrl.trim() || null,
        journal: journal.trim() || null,
        author_name: "Equipe RadioeXperience",
      },
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from("posts")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("posts")
          .insert({
            ...payload,
            author_id: user.id,
            type: "article",
          });
        if (error) throw error;
      }
      resetForm();
      fetchArticles();
    } catch (err) {
      setFormError(err.message || "Erro ao salvar artigo");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este artigo?")) return;
    await supabase.from("posts").delete().eq("id", id);
    setArticles(prev => prev.filter(a => a.id !== id));
  };

  // Not logged in
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Login necessário</h2>
          <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 20 }}>Faça login para gerenciar artigos.</p>
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:${C.bg}}
      `}</style>

      {/* Nav */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(0,26,43,0.9)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 20px" }}>
          <a href="/dashboard" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none", fontWeight: 500 }}>← Dashboard</a>
          <span style={{ fontSize: 12, color: C.pStudy, fontWeight: 600 }}>📄 Gerenciar Artigos</span>
          <a href="/feed" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none", fontWeight: 500 }}>Ver Feed →</a>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "80px 20px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text }}>Artigos</h1>
            <p style={{ color: C.textMuted, fontSize: 14, marginTop: 4 }}>{articles.length} artigos publicados no feed</p>
          </div>
          <button onClick={() => { resetForm(); setShowCreate(true); }} style={{
            padding: "10px 22px", borderRadius: 12, border: "none",
            background: C.accent, color: C.bgDeep, fontWeight: 700, fontSize: 14,
            cursor: "pointer", boxShadow: `0 0 16px ${C.accentGlow}`,
          }}>+ Novo Artigo</button>
        </div>

        {/* Create/Edit form */}
        {showCreate && (
          <div style={{
            background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 20,
            padding: 24, marginBottom: 24, backdropFilter: "blur(16px)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
                {editing ? "Editar Artigo" : "Novo Artigo"}
              </h3>
              <button onClick={resetForm} style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                background: "transparent", color: C.textDim, fontSize: 12, cursor: "pointer",
              }}>✕ Cancelar</button>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Título *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Novas diretrizes BI-RADS 2026" style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${C.glassBorder}`, background: "rgba(0,26,43,0.5)",
                  color: C.text, fontSize: 15, fontWeight: 600, outline: "none",
                }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Conteúdo *</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Resumo do artigo, principais achados, conclusões..." rows={6} style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${C.glassBorder}`, background: "rgba(0,26,43,0.5)",
                  color: C.text, fontSize: 14, lineHeight: 1.7, resize: "vertical",
                  outline: "none", fontFamily: "inherit",
                }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 6 }}>URL da Fonte</label>
                  <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: `1px solid ${C.glassBorder}`, background: "rgba(0,26,43,0.5)",
                    color: C.text, fontSize: 13, outline: "none",
                  }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Revista / Journal</label>
                  <input value={journal} onChange={e => setJournal(e.target.value)} placeholder="Ex: Radiology, AJR..." style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: `1px solid ${C.glassBorder}`, background: "rgba(0,26,43,0.5)",
                    color: C.text, fontSize: 13, outline: "none",
                  }} />
                </div>
              </div>

              {formError && <div style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>{formError}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button onClick={resetForm} style={{
                  padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.glassBorder}`,
                  background: "transparent", color: C.textSoft, fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}>Cancelar</button>
                <button onClick={handleSubmit} disabled={!title.trim() || !content.trim() || submitting} style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: title.trim() && content.trim() ? C.accent : "rgba(221,255,85,0.1)",
                  color: title.trim() && content.trim() ? C.bgDeep : C.textDim,
                  fontWeight: 700, fontSize: 13, cursor: title.trim() && content.trim() ? "pointer" : "default",
                  boxShadow: title.trim() ? `0 0 16px ${C.accentGlow}` : "none",
                  opacity: submitting ? 0.7 : 1,
                }}>{submitting ? "Salvando..." : editing ? "Atualizar" : "Publicar"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Articles list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Carregando...</div>
        ) : articles.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 16,
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum artigo ainda</div>
            <div style={{ fontSize: 13, color: C.textDim }}>Publique o primeiro artigo para aparecer no feed.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {articles.map(article => {
              const isAgent = article.metadata?.source === "aria_agent";
              const canEdit = user && (article.author_id === user.id || isStaff);

              return (
                <div key={article.id} style={{
                  background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 16,
                  padding: 20, backdropFilter: "blur(16px)",
                  transition: "all 0.2s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        {isAgent && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: `${C.pAria}15`, color: C.pAria, textTransform: "uppercase" }}>🩻 Agente</span>
                        )}
                        <span style={{ fontSize: 11, color: C.textDim }}>{timeAgo(article.created_at)}</span>
                        {article.metadata?.journal && (
                          <span style={{ fontSize: 11, color: C.pStudy, fontWeight: 500 }}>{article.metadata.journal}</span>
                        )}
                      </div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>{article.title}</h3>
                      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                        {article.content}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
                        <span style={{ fontSize: 12, color: C.textDim }}>❤️ {article.likes_count || 0}</span>
                        <span style={{ fontSize: 12, color: C.textDim }}>💬 {article.comments_count || 0}</span>
                        {article.metadata?.source_url && (
                          <a href={article.metadata.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.pStudy, textDecoration: "none" }}>🔗 Fonte</a>
                        )}
                      </div>
                    </div>

                    {canEdit && !isAgent && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => openEdit(article)} style={{
                          padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.glassBorder}`,
                          background: "transparent", color: C.textMuted, fontSize: 12, cursor: "pointer",
                        }}>✏️</button>
                        <button onClick={() => handleDelete(article.id)} style={{
                          padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,107,107,0.2)",
                          background: "rgba(255,107,107,0.05)", color: C.red, fontSize: 12, cursor: "pointer",
                        }}>🗑️</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
