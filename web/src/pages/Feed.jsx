import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { getPostImageUrl } from "../lib/postImages";
import {
  attachCommentProfile,
  fetchCommentsWithProfiles,
  fetchProfilesMap,
} from "../lib/comments";
import { getInitials } from "../lib/avatar";

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

const TYPE_LABELS = {
  article: { label: "Artigo", color: "#7ecbff" },
  case: { label: "Caso Clínico", color: "#5ef0b0" },
  review: { label: "Revisão", color: "#ffb347" },
  news: { label: "Notícia", color: "#ff7eb3" },
  post: { label: "Post", color: "#c5c0c9" },
};

const TYPE_OPTIONS = [
  { value: "post", label: "Post" },
  { value: "article", label: "Artigo" },
  { value: "case", label: "Caso Clínico" },
  { value: "review", label: "Revisão" },
  { value: "news", label: "Notícia" },
];

const API_BASE = "https://aria-backend-production-176b.up.railway.app";

// ── Inline Edit Modal ──────────────────────────────────────────────────────────
function EditPostModal({ post, onClose, onSaved }) {
  const [title, setTitle] = useState(post.title || "");
  const [content, setContent] = useState(post.content || "");
  const [type, setType] = useState(post.type || "post");
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState(post.visibility || "public");
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!title.trim()) { setError("Título é obrigatório."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), type, visibility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro ao salvar");
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", background: "rgba(0,26,43,0.6)", border: `1px solid ${C.glassBorder}`,
    borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13,
    fontFamily: "inherit", outline: "none",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,10,20,0.75)", backdropFilter: "blur(12px)", padding: 20,
    }} onClick={onClose}>
      <div style={{
        width: "100%", maxWidth: 640, background: "rgba(0,26,43,0.97)",
        border: `1px solid ${C.glassBorder}`, borderRadius: 20, overflow: "hidden",
        boxShadow: "0 0 60px rgba(0,0,0,0.5)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex",
          alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontWeight: 800, color: C.textSoft, fontSize: 15 }}>Editar Publicação</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>Título</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>Tipo</div>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>Conteúdo</div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>Visibilidade</div>
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
          {error && <div style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: "transparent", color: C.textSoft, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: C.accent, color: C.bgDeep, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontSize: 13 }}>{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
function DeletePostModal({ post, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/posts/${post.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro ao excluir");
      onDeleted();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center",
      justifyContent: "center", background: "rgba(0,10,20,0.75)", backdropFilter: "blur(12px)", padding: 20,
    }} onClick={onClose}>
      <div style={{
        width: "100%", maxWidth: 420, background: "rgba(0,26,43,0.97)",
        border: `1px solid rgba(255,107,107,0.3)`, borderRadius: 20, padding: 24,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🗑️</div>
        <h3 style={{ color: C.text, marginBottom: 8 }}>Excluir publicação?</h3>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
          A publicação <strong style={{ color: C.textSoft }}>"{post.title}"</strong> será removida permanentemente.
        </p>
        {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: "transparent", color: C.textSoft, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleDelete} disabled={deleting} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#ff6b6b", color: "#fff", fontWeight: 800, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1, fontSize: 13 }}>{deleting ? "Excluindo..." : "Excluir"}</button>
        </div>
      </div>
    </div>
  );
}

function getPreview(text, isAgent) {
  if (!text) return "";
  const normalized = text.replace(/\r/g, "").trim();
  if (!isAgent) {
    const firstBlock = normalized.split(/\n\n+/)[0] || normalized;
    return firstBlock.replace(/\s+/g, " ").slice(0, 240);
  }
  const lines = normalized.split("\n").filter(Boolean);
  const highlighted = lines.filter((l) => /^(\*\*|#|✅|⚠️|•|-)/.test(l.trim())).slice(0, 4);
  const content = highlighted.length ? highlighted.join(" ") : normalized.split(/\n\n+/)[0];
  return content.replace(/\*\*/g, "").replace(/#/g, "").replace(/\s+/g, " ").slice(0, 320);
}

export default function Feed() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const isStaff = userRole === "staff" || userRole === "admin";
  const [posts, setPosts] = useState([]);
  const [authors, setAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [editPost, setEditPost] = useState(null);
  const [deletePost, setDeletePost] = useState(null);
  const [comments, setComments] = useState({}); // { postId: [comment, ...] }
  const [openComments, setOpenComments] = useState(null); // postId or null
  const [commentTexts, setCommentTexts] = useState({}); // { postId: string }
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState('');

  const fetchCommentsForPosts = useCallback(async (postIds) => {
    if (!postIds.length) return;
    try {
      const data = await fetchCommentsWithProfiles({
        supabase,
        postIds,
        fallbackUser: user,
      });
      const grouped = {};
      data.forEach((comment) => {
        if (!grouped[comment.post_id]) grouped[comment.post_id] = [];
        grouped[comment.post_id].push(comment);
      });
      setComments(prev => ({ ...prev, ...grouped }));
    } catch (e) { console.error('Error fetching comments:', e); }
  }, [user]);

  const fetchComments = useCallback(async () => {
    if (!posts.length) return;
    const postIds = posts.map(p => p.id);
    await fetchCommentsForPosts(postIds);
  }, [posts, fetchCommentsForPosts]);

  useEffect(() => { if (posts.length) fetchComments(); }, [posts, fetchComments]);

  const toggleComments = (postId) => {
    setOpenComments(prev => prev === postId ? null : postId);
    setCommentError('');
  };

  const postComment = async (postId) => {
    const text = (commentTexts[postId] || '').trim();
    if (!text || !user) return;
    setCommentLoading(true);
    setCommentError('');
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: user.id, content: text })
        .select('*')
        .single();
      if (error) throw error;

      let profilesMap = {};
      try {
        profilesMap = await fetchProfilesMap(supabase, [data.user_id]);
      } catch (profileError) {
        console.warn('Comment profile fetch failed:', profileError);
      }

      const savedComment = attachCommentProfile(data, { profilesMap, fallbackUser: user });
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), savedComment],
      }));
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
    } catch (e) {
      console.error('Comment insert error:', e);
      setCommentError(
        e?.message
          ? `Não consegui salvar seu comentário: ${e.message}`
          : 'Não consegui salvar seu comentário. Tente novamente.'
      );
    } finally {
      setCommentLoading(false);
    }
  };

  const deleteComment = async (commentId, postId) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId),
      }));
    } catch (e) { console.error(e); }
  };

  const formatCommentTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return 'agora';
    if (diffH < 24) return diffH + 'h';
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      const postList = data || [];
      setPosts(postList);

      const userIds = [...new Set(postList.map((p) => p.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, specialty, institution, avatar_url, role")
          .in("id", userIds);
        if (profiles) {
          const map = {};
          profiles.forEach((p) => (map[p.id] = p));
          setAuthors(map);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar artigos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handlePostSaved = () => { fetchPosts(); };
  const handlePostDeleted = () => { fetchPosts(); };

  const filtered = (filter === "all" ? posts : posts.filter((p) => p.type === filter))
    .filter((p) => p.visibility !== "private" || p.user_id === user?.id);

  const stats = useMemo(() => {
    const ai = posts.filter((p) => p.is_agent).length;
    const espec = new Set(Object.values(authors).map((a) => a?.specialty).filter(Boolean)).size;
    return { total: posts.length, ai, espec };
  }, [posts, authors]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return "agora";
    if (diffH < 24) return `${diffH}h`;
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        body{margin:0;background:${C.bg}}
        .feed-filters::-webkit-scrollbar{display:none}
        .feed-filters{scrollbar-width:none;-webkit-overflow-scrolling:touch}
        @media(max-width:1024px){
          .feed-layout{grid-template-columns:1fr!important}
          .feed-side{display:none!important}
          .feed-mobile{display:flex!important}
        }
        @media(min-width:1025px){
          .feed-mobile{display:none!important}
        }
        @media(max-width:640px){
          .feed-main-wrap{padding:72px 12px 40px!important}
          .feed-topbar{padding:0 12px!important;height:50px!important}
          .feed-topbar strong{font-size:12px!important}
          .feed-topbar-actions button{padding:5px 8px!important;font-size:10px!important;border-radius:6px!important}
          .feed-title{font-size:20px!important;margin-bottom:2px!important}
          .feed-subtitle{display:none!important}
          .feed-header{margin-bottom:12px!important}
          .feed-filters{gap:5px!important;margin-bottom:12px!important;padding:0 2px!important}
          .feed-filters button{padding:5px 10px!important;font-size:10px!important;border-radius:999px!important;flex-shrink:0}
          .feed-card{padding:14px!important;border-radius:14px!important;margin:0!important}
          .feed-card h2{font-size:15px!important;line-height:1.3!important;margin-bottom:6px!important;-webkit-line-clamp:2!important}
          .feed-card p{font-size:12px!important;line-height:1.55!important;-webkit-line-clamp:3!important}
          .feed-card .meta-row{gap:6px!important;margin-top:10px!important;padding-top:8px!important;flex-wrap:wrap!important}
          .feed-card .meta-row .feed-meta{flex-direction:column!important;align-items:flex-start!important;gap:3px!important}
          .feed-card .meta-row .feed-meta span{margin-left:0!important}
          .feed-card .feed-actions{margin-left:0!important;flex-direction:column!important}
          .feed-card .feed-actions button{flex:none!important;width:100%!important}
          .feed-ov-comment{flex-direction:column!important;align-items:stretch!important}
          .feed-ov-comment button{align-self:flex-end}
          .feed-avatar{width:28px!important;height:28px!important;border-radius:8px!important;font-size:11px!important}
          .feed-type-badge{font-size:9px!important;padding:2px 7px!important;margin-left:0!important}
          .feed-date{font-size:10px!important}
        }
        @media(max-width:380px){
          .feed-card{padding:12px!important;border-radius:12px!important}
          .feed-card h2{font-size:14px!important}
          .feed-card p{font-size:11.5px!important}
          .feed-filters button{padding:4px 8px!important;font-size:9.5px!important}
        }
      `}</style>

      {/* Top bar */}
      <div className="feed-topbar" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(0,26,43,0.92)", backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, #b8ff33)`, display: "grid", placeItems: "center" }}>
            <strong style={{ fontSize: 11, color: C.bgDeep, fontStyle: "italic" }}>eX</strong>
          </div>
          <strong>RadioeXperience Feed</strong>
        </div>
        <div className="feed-topbar-actions" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate('/dashboard')} style={{ border: `1px solid ${C.glassBorder}`, borderRadius: 8, background: 'transparent', color: C.textMuted, padding: '6px 12px', fontWeight: 700, cursor: "pointer" }}>Dashboard</button>
          <button onClick={() => navigate('/novo-artigo')} style={{ border: 'none', borderRadius: 8, background: C.accent, color: C.bgDeep, padding: '6px 12px', fontWeight: 800, cursor: "pointer" }}>+ Publicar</button>
        </div>
      </div>

      {/* Main layout */}
      <div className="feed-main-wrap" style={{ maxWidth: 1440, margin: "0 auto", padding: "84px 20px 50px" }}>
        <div className="feed-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0,280px) 1fr minmax(0,300px)", gap: 24 }}>
          {/* Left sidebar */}
          <aside className="feed-side" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ borderRadius: 16, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Editorial</div>
              <h3 style={{ marginTop: 8, fontSize: 18 }}>Pulse Radiológico</h3>
              <p style={{ marginTop: 8, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>Feed com curadoria clínica: atualizações, casos, revisões e oportunidades de plantão.</p>
            </div>
            <div style={{ borderRadius: 16, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Indicadores</div>
              <div style={{ marginTop: 12, fontSize: 13, color: C.textSoft }}>📰 {stats.total} publicações</div>
              <div style={{ marginTop: 6, fontSize: 13, color: C.textSoft }}>🤖 {stats.ai} sínteses da ARIA</div>
              <div style={{ marginTop: 6, fontSize: 13, color: C.textSoft }}>🧭 {stats.espec} especialidades</div>
            </div>
          </aside>

          {/* Main feed */}
          <main>
            <div className="feed-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <h1 className="feed-title" style={{ fontSize: 28, marginBottom: 4 }}>Comunidade Radiológica</h1>
                <p className="feed-subtitle" style={{ fontSize: 13, color: C.textDim }}>Conhecimento aplicado e inteligência de mercado em radiologia.</p>
              </div>
            </div>

            {/* Mobile stats panel */}
            <div className="feed-mobile" style={{ display: "none", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div style={{ borderRadius: 16, background: `linear-gradient(135deg, ${C.glass}, rgba(221,255,85,0.08))`, border: `1px solid ${C.glassBorder}`, padding: 16 }}>
                <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Pulse Radiológico</div>
                <p style={{ marginTop: 8, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>Curadoria clínica com casos, revisões e oportunidades.</p>
              </div>
              <div style={{ borderRadius: 16, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {[{ label: "Publicações", val: stats.total }, { label: "IA / ARIA", val: stats.ai }, { label: "Especialidades", val: stats.espec }].map((m) => (
                    <div key={m.label} style={{ background: C.bgDeep, borderRadius: 12, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, color: C.textDim }}>{m.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.textSoft, marginTop: 2 }}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter pills */}
            <div className="feed-filters" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18, scrollbarWidth: "none" }}>
              {["all","post","article","case","review","news"].map((k) => (
                <button key={k} onClick={() => setFilter(k)} style={{
                  borderRadius: 999, border: `1px solid ${filter===k ? "rgba(221,255,85,0.3)" : C.glassBorder}`,
                  background: filter===k ? C.accentSoft : "transparent",
                  color: filter===k ? C.accent : C.textMuted,
                  padding: "7px 14px", whiteSpace: "nowrap", fontWeight: 700, cursor: "pointer",
                  fontSize: 12, flexShrink: 0,
                }}>{k === 'all' ? 'Todos' : TYPE_LABELS[k]?.label || k}</button>
              ))}
            </div>

            {error && <div style={{ marginBottom: 14, color: C.red }}>{error}</div>}

            {loading ? (
              <p style={{ color: C.textMuted, padding: "20px 0" }}>Carregando...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map((post) => {
                  const typeInfo = TYPE_LABELS[post.type] || TYPE_LABELS.article;
                  const author = post.is_agent ? null : (authors[post.user_id] || null);
                  const authorName = post.is_agent ? "ARIA" : (author?.full_name || "Comunidade eX");
                  const authorAvatar = post.is_agent ? "" : (author?.avatar_url || "");
                  const authorInitials = getInitials(authorName, "C");
                  const specialty = author?.specialty || post?.metadata?.specialty || (post.is_agent ? "Curadoria IA" : null);
                  const location = post?.metadata?.location;
                  const source = post?.journal || post?.metadata?.source || null;
                  const role = author?.role || post?.metadata?.author_role || null;
                  const preview = getPreview(post.content, post.is_agent);
                  const imageUrl = getPostImageUrl(post);

                  return (
                    <article
                      key={post.id}
                      onClick={() => navigate(`/artigo/${post.id}`)}
                      className="feed-card"
                      style={{
                        borderRadius: 16, background: C.glass, border: `1px solid ${C.glassBorder}`,
                        padding: 18, cursor: "pointer", position: "relative",
                      }}
                    >
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                        <div className="feed-avatar" style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: post.is_agent ? C.accentSoft : "rgba(126,203,255,0.15)",
                          display: "grid", placeItems: "center",
                          color: post.is_agent ? C.accent : "#7ecbff", fontWeight: 800,
                          flexShrink: 0,
                          overflow: "hidden",
                          border: post.is_agent ? "none" : "1px solid rgba(126,203,255,0.2)",
                        }}>
                          {post.is_agent ? "IA" : authorAvatar ? (
                            <img src={authorAvatar} alt={authorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : authorInitials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            onClick={(e) => { e.stopPropagation(); if (!post.is_agent && post.user_id) navigate(`/profile/${post.user_id}`); }}
                            style={{ fontSize: 13, fontWeight: 700, color: C.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: post.is_agent ? 'default' : 'pointer' }}
                          >{authorName}</div>
                          <div style={{ fontSize: 11, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {specialty || "Radiologia"}{role ? ` · ${role}` : ""}
                          </div>
                        </div>
                        {/* Type badge */}
                        <span className="feed-type-badge" style={{
                          marginLeft: "auto", fontSize: 10, padding: "3px 10px", borderRadius: 999,
                          background: `${typeInfo.color}18`, border: `1px solid ${typeInfo.color}35`,
                          color: typeInfo.color, fontWeight: 700, flexShrink: 0,
                        }}>
                          {typeInfo.label}
                        </span>
                        <span className="feed-date" style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>{formatDate(post.created_at)}</span>
                      </div>

                      {/* Title */}
                      <h2 style={{ margin: "0 0 8px", fontSize: 20, lineHeight: 1.3, color: C.text, fontWeight: 800, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {post.title}
                      </h2>

                      {/* ARIA badge */}
                      {post.is_agent && (
                        <div style={{ marginBottom: 10, fontSize: 12, color: C.accent, background: C.accentSoft, border: `1px solid rgba(221,255,85,0.25)`, padding: "7px 10px", borderRadius: 10 }}>
                          Resumo da ARIA com foco em aplicabilidade clínica e referência de fonte.
                        </div>
                      )}

                      {imageUrl && (
                        <img src={imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 14, marginBottom: 12, border: `1px solid ${C.glassBorder}` }} />
                      )}

                      {/* Preview */}
                      <p style={{ margin: 0, color: C.textMuted, lineHeight: 1.7, fontSize: 13.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                        {preview}
                      </p>

                      {/* Footer row */}
                      <div className="meta-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, alignItems: "center" }}>
                        <div className="feed-meta" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          {source && <span style={{ fontSize: 11, color: C.textDim }}>📚 {source}</span>}
                          {location && <span style={{ fontSize: 11, color: C.textDim }}>📍 {location}</span>}
                          {post.source_url && (
                            <a href={post.source_url} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer"
                              style={{ fontSize: 11, color: C.accent, textDecoration: "none", fontWeight: 700 }}>
                              Fonte ↗
                            </a>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleComments(post.id); }}
                          style={{ marginLeft: 'auto', fontSize: 11, color: openComments === post.id ? C.accent : C.textDim, fontWeight: 700, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          💬 {comments[post.id]?.length || 0}
                        </button>
                        <span style={{ fontSize: 11, color: C.accent, fontWeight: 700, flexShrink: 0 }}>Ler editorial →</span>
                      </div>

                      {/* Admin controls — visible only to staff/admin */}
                      {isStaff && (
                        <div className="feed-actions" style={{
                          display: "flex", gap: 8, marginTop: 10, paddingTop: 10,
                          borderTop: `1px solid ${C.border}`,
                        }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditPost(post)}
                            style={{
                              flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                              border: `1px solid ${C.glassBorder}`, background: C.glass, color: C.textSoft, cursor: "pointer",
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => setDeletePost(post)}
                            style={{
                              flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                              border: "1px solid rgba(255,107,107,0.3)", background: "rgba(255,107,107,0.07)",
                              color: "#ff9999", cursor: "pointer",
                            }}
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      )}
                      {/* Comments section */}
                      {openComments === post.id && (
                        <div
                          style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Comment list */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                            {(comments[post.id] || []).map(comment => (
                              <div key={comment.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <div style={{
                                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                                  background: C.accentSoft, color: C.accent,
                                  display: 'grid', placeItems: 'center',
                                  fontSize: 10, fontWeight: 800,
                                  overflow: 'hidden',
                                  border: `1px solid ${C.glassBorder}`,
                                }}>
                                  {comment.profiles?.avatar_url ? (
                                    <img src={comment.profiles.avatar_url} alt={comment.profiles?.full_name || 'Usuário'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    getInitials(comment.profiles?.full_name, 'U')
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span
                                      onClick={() => comment.user_id && navigate(`/profile/${comment.user_id}`)}
                                      style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, cursor: 'pointer' }}
                                    >
                                      {comment.profiles?.full_name || 'Usuário'}
                                    </span>
                                    <span style={{ fontSize: 10, color: C.textDim }}>
                                      {formatCommentTime(comment.created_at)}
                                    </span>
                                    {user && comment.user_id === user.id && (
                                      <button
                                        onClick={() => deleteComment(comment.id, post.id)}
                                        style={{ fontSize: 10, color: C.red, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {(comments[post.id] || []).length === 0 && (
                              <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: '8px 0' }}>
                                Seja o primeiro a comentar 👋
                              </p>
                            )}
                          </div>
                          {/* Comment input */}
                          {user ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {commentError && openComments === post.id && (
                                <div style={{ fontSize: 11, color: '#ff6b6b', fontWeight: 600, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
                                  ⚠️ {commentError}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                              <textarea
                                value={commentTexts[post.id] || ''}
                                onChange={(e) => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder='Escreva um comentário...'
                                rows={2}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  flex: 1, background: C.bgDeep, border: `1px solid ${C.glassBorder}`,
                                  borderRadius: 10, padding: '8px 10px', color: C.text, fontSize: 12.5,
                                  fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5,
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    postComment(post.id);
                                  }
                                }}
                              />
                              <button
                                onClick={() => postComment(post.id)}
                                disabled={commentLoading || !(commentTexts[post.id] || '').trim()}
                                style={{
                                  padding: '7px 14px', borderRadius: 10, border: 'none',
                                  background: commentLoading ? C.glassBorder : C.accent,
                                  color: C.bgDeep, fontWeight: 800, fontSize: 12,
                                  cursor: commentLoading ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {commentLoading ? '...' : 'Enviar'}
                              </button>
                              </div>
                            </div>
                          ) : (
                            <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center' }}>
                              Faça login para comentar
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </main>

          {/* Right sidebar */}
          <aside className="feed-side" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ borderRadius: 16, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Agenda comunitária</div>
              <div style={{ marginTop: 10, color: C.textSoft, fontSize: 13 }}>• Discussões de casos de urgência</div>
              <div style={{ marginTop: 6, color: C.textSoft, fontSize: 13 }}>• Protocolos por subespecialidade</div>
            </div>
            <div style={{ borderRadius: 16, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Boas práticas</div>
              <div style={{ marginTop: 10, color: C.textSoft, fontSize: 13 }}>✅ Informe contexto clínico e modalidade</div>
              <div style={{ marginTop: 6, color: C.textSoft, fontSize: 13 }}>✅ Cite guideline/journal quando possível</div>
              <div style={{ marginTop: 6, color: C.textSoft, fontSize: 13 }}>✅ Seja objetivo e respeitoso</div>
            </div>
          </aside>
        </div>
      </div>

      {/* Modals */}
      {editPost && (
        <EditPostModal
          post={editPost}
          onClose={() => setEditPost(null)}
          onSaved={handlePostSaved}
        />
      )}
      {deletePost && (
        <DeletePostModal
          post={deletePost}
          onClose={() => setDeletePost(null)}
          onDeleted={handlePostDeleted}
        />
      )}
    </div>
  );
}
