import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getPostImageUrl } from "../lib/postImages";
import { useAuth } from "../contexts/AuthContext";
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
};

const TYPE_LABELS = {
  article: { label: "Artigo", color: "#7ecbff" },
  case: { label: "Caso Clínico", color: "#5ef0b0" },
  review: { label: "Revisão", color: "#ffb347" },
  news: { label: "Notícia", color: "#ff7eb3" },
  post: { label: "Post", color: "#c5c0c9" },
  vaga: { label: "Vaga", color: "#ffd166" },
};

export default function PostView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [authorName, setAuthorName] = useState("");
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Comments — per-post state, reset on id change
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState("");

  const fetchComments = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchCommentsWithProfiles({
        supabase,
        postId: id,
        fallbackUser: user,
      });
      setComments(data);
    } catch (e) {
      console.error("Error fetching comments:", e);
    }
  }, [id, user]);

  useEffect(() => {
    fetchPost();
    // Reset comment state on post change
    setComments([]);
    setCommentText("");
    setCommentError("");
    fetchComments();
  }, [id, fetchComments]);

  const fetchPost = async () => {
    setLoading(true);
    setAuthorName("");
    setAuthorAvatarUrl("");
    try {
      const { data, error: err } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (err) throw err;
      if (!data) {
        setError("Artigo não encontrado.");
        return;
      }
      if (data.visibility === "private" && data.user_id !== user?.id) {
        setError("Post privado");
        return;
      }
      setPost(data);

      if (data.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", data.user_id)
          .maybeSingle();
        if (profile) {
          setAuthorName(profile.full_name || "Anônimo");
          setAuthorAvatarUrl(profile.avatar_url || "");
        } else {
          setAuthorName("Anônimo");
          setAuthorAvatarUrl("");
        }
      }
    } catch (err) {
      console.error("Error fetching post:", err);
      setError("Erro ao carregar artigo.");
    } finally {
      setLoading(false);
    }
  };

  const postComment = async () => {
    const text = commentText.trim();
    if (!text || !user) return;
    setCommentLoading(true);
    setCommentError("");
    try {
      const { data, error: err } = await supabase
        .from("comments")
        .insert({ post_id: id, user_id: user.id, content: text })
        .select("*")
        .single();
      if (err) throw err;

      let profilesMap = {};
      try {
        profilesMap = await fetchProfilesMap(supabase, [data.user_id]);
      } catch (profileError) {
        console.warn("Comment profile fetch failed:", profileError);
      }

      setComments((prev) => [
        ...prev,
        attachCommentProfile(data, { profilesMap, fallbackUser: user }),
      ]);
      setCommentText("");
    } catch (e) {
      console.error("Comment insert error:", e);
      setCommentError(
        e?.message
          ? `Não consegui salvar seu comentário: ${e.message}`
          : "Não consegui salvar seu comentário. Tente novamente.",
      );
    } finally {
      setCommentLoading(false);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await supabase.from("comments").delete().eq("id", commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) { console.error(e); }
  };

  const formatCommentTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return "agora";
    if (diffH < 24) return diffH + "h";
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderContent = (text) => {
    if (!text) return null;
    const blocks = text.replace(/\r/g, "").split(/\n\n+/);
    return blocks.map((block, idx) => {
      const lines = block.split("\n").filter(Boolean);
      const isList = lines.every((line) => /^(-|•|\*|✅|⚠️|\d+\.)\s+/.test(line.trim()));
      const headingMatch = lines.length === 1 && (/^#{1,3}\s+/.test(lines[0]) || /^\*\*.+\*\*$/.test(lines[0]));
      const isCallout = /^⚠️|^✅/.test(lines[0]?.trim() || "");

      if (headingMatch) {
        const headingText = lines[0].replace(/^#{1,3}\s+/, "").replace(/^\*\*|\*\*$/g, "");
        return <h3 key={idx} style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "24px 0 10px" }}>{headingText}</h3>;
      }

      if (isList) {
        return <ul key={idx} style={{ paddingLeft: 20, margin: "12px 0", color: C.textSoft, lineHeight: 1.7 }}>{lines.map((line, i) => <li key={i} style={{ marginBottom: 6 }}>{line.replace(/^(-|•|\*|✅|⚠️|\d+\.)\s+/, "")}</li>)}</ul>;
      }

      if (isCallout) {
        return <div key={idx} style={{ margin: "0 0 14px", padding: "10px 12px", borderRadius: 10, background: "rgba(221,255,85,0.06)", border: "1px solid rgba(221,255,85,0.2)", color: C.textSoft, lineHeight: 1.7 }}>{block}</div>;
      }

      return <p key={idx} style={{ margin: "0 0 16px", color: C.textSoft, lineHeight: 1.8 }}>{block}</p>;
    });
  };

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter',sans-serif" }}>
        <div style={{ maxWidth: 520, width: "100%", borderRadius: 20, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 28, textAlign: "center", backdropFilter: "blur(18px)" }}>
          <div style={{ fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textDim, marginBottom: 10 }}>Acesso necessário</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Faça login para acessar o Feed</h1>
          <p style={{ color: C.textMuted, marginBottom: 20 }}>Entre na sua conta para ver os conteúdos da comunidade.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/login")} style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: C.accent, color: C.bgDeep, fontWeight: 800, cursor: "pointer" }}>Entrar</button>
            <button onClick={() => navigate("/signup")} style={{ padding: "12px 20px", borderRadius: 12, border: `1px solid ${C.glassBorder}`, background: "transparent", color: C.textSoft, fontWeight: 700, cursor: "pointer" }}>Criar conta</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: "spin 0.9s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 40 }}>📄</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{error || "Artigo não encontrado"}</p>
        <button onClick={() => navigate("/feed")} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: C.glass, color: C.textSoft, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Voltar ao Feed</button>
      </div>
    );
  }

  const typeInfo = TYPE_LABELS[post.type] || TYPE_LABELS.article;
  const imageUrl = getPostImageUrl(post)
  const displayAuthor = post.is_agent ? "ARIA" : authorName || "Anônimo";
  const displayAuthorAvatar = post?.is_agent ? "" : authorAvatarUrl;
  const displayAuthorInitials = getInitials(displayAuthor, "A");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg}}
        @media(max-width:640px){
          .pv-wrap{padding:70px 14px 120px!important}
          .pv-article{padding:18px!important;border-radius:14px!important}
          .pv-article h1{font-size:22px!important}
          .pv-comments{padding:14px!important;border-radius:14px!important}
        }
      `}</style>

      <div className="pv-wrap" style={{ maxWidth: 720, margin: "0 auto", padding: "80px 20px 120px" }}>
        {/* Back */}
        <button onClick={() => navigate("/feed")} style={{ background: "transparent", border: `1px solid ${C.glassBorder}`, borderRadius: 8, padding: "6px 12px", color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 28 }}>
          ← Feed
        </button>

        {/* Article card */}
        <article className="pv-article" style={{ borderRadius: 20, background: C.glass, border: `1px solid ${C.glassBorder}`, backdropFilter: "blur(12px)", padding: 32 }}>
          {/* Meta */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: post.is_agent ? C.accentSoft : "rgba(126,203,255,0.15)", border: `1px solid ${post.is_agent ? "rgba(221,255,85,0.3)" : "rgba(126,203,255,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: post.is_agent ? C.accent : "#7ecbff", flexShrink: 0, overflow: "hidden" }}>
              {post.is_agent ? "🤖" : displayAuthorAvatar ? (
                <img src={displayAuthorAvatar} alt={displayAuthor} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : displayAuthorInitials}
            </div>
            <div>
              <div onClick={() => !post.is_agent && post.user_id && navigate(`/profile/${post.user_id}`)} style={{ fontSize: 14, fontWeight: 700, color: C.textSoft, cursor: post.is_agent ? 'default' : 'pointer' }}>
                {displayAuthor}
                {post.is_agent && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 100, background: C.accentSoft, color: C.accent, fontWeight: 800, marginLeft: 8, textTransform: "uppercase" }}>IA</span>}
              </div>
              <div style={{ fontSize: 11, color: C.textDim }}>{formatDate(post.created_at)}</div>
            </div>
            <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 100, background: `${typeInfo.color}15`, color: typeInfo.color, fontWeight: 700, border: `1px solid ${typeInfo.color}30`, marginLeft: "auto" }}>
              {typeInfo.label}
            </span>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1.3, marginBottom: 8 }}>{post.title}</h1>

          {/* Journal */}
          {post.journal && <div style={{ fontSize: 13, color: C.textDim, marginBottom: 8, fontStyle: "italic" }}>📖 {post.journal}</div>}
          {post.metadata?.source_url && (
            <a href={post.metadata.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accent, marginBottom: 20, display: 'inline-block', textDecoration: 'none', fontWeight: 600 }}>
              🔗 Ver artigo original
            </a>
          )}

          {imageUrl && <img src={imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 16, marginBottom: 20, border: `1px solid ${C.glassBorder}` }} />}

          {post.type === "vaga" && (post.metadata?.location || post.metadata?.contact) && (
            <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 12, background: "rgba(255,209,102,0.08)", border: "1px solid rgba(255,209,102,0.25)", color: C.textSoft, fontSize: 13, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {post.metadata?.location && <span>📍 {post.metadata.location}</span>}
              {post.metadata?.contact && <span>✉️ {post.metadata.contact}</span>}
            </div>
          )}

          {post.is_agent && (
            <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 12, background: C.accentSoft, border: "1px solid rgba(221,255,85,0.25)", color: C.textSoft, fontSize: 13 }}>
              <strong style={{ color: C.accent }}>Resumo ARIA (modo explicativo)</strong>
              <div style={{ marginTop: 6, lineHeight: 1.65 }}>Este conteúdo prioriza contexto clínico, interpretação prática e referências. Use como apoio de estudo e confirme condutas com guideline institucional.</div>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: C.border, margin: "0 0 24px" }} />

          {/* Content */}
          <div style={{ fontSize: 15, color: C.textSoft, lineHeight: 1.8, wordWrap: "break-word" }}>
            {renderContent(post.content)}
          </div>

          {/* Source */}
          {post.source_url && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
              <a href={post.source_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: C.accentSoft, border: "1px solid rgba(221,255,85,0.2)", color: C.accent, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Fonte original ↗
              </a>
            </div>
          )}
        </article>

        {/* ── Comments Section ── */}
        <div className="pv-comments" style={{ marginTop: 20, borderRadius: 20, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 24, backdropFilter: "blur(12px)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 16 }}>
            💬 Comentários ({comments.length})
          </div>

          {commentError && (
            <div style={{ fontSize: 12, color: C.red, fontWeight: 600, padding: "8px 10px", borderRadius: 10, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", marginBottom: 14 }}>
              ⚠️ {commentError}
            </div>
          )}

          {/* Comment list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {comments.length === 0 && (
              <p style={{ fontSize: 13, color: C.textDim, textAlign: "center", padding: "16px 0" }}>
                Seja o primeiro a comentar 👋
              </p>
            )}
            {comments.map((comment) => (
              <div key={comment.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: C.accentSoft, color: C.accent,
                  display: "grid", placeItems: "center",
                  fontSize: 12, fontWeight: 800,
                  overflow: "hidden",
                  border: `1px solid ${C.glassBorder}`,
                }}>
                  {comment.profiles?.avatar_url ? (
                    <img src={comment.profiles.avatar_url} alt={comment.profiles?.full_name || "Usuário"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    getInitials(comment.profiles?.full_name, "U")
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span onClick={() => comment.user_id && navigate(`/profile/${comment.user_id}`)} style={{ fontSize: 13, fontWeight: 700, color: C.textSoft, cursor: "pointer" }}>
                      {comment.profiles?.full_name || "Usuário"}
                    </span>
                    <span style={{ fontSize: 11, color: C.textDim }}>{formatCommentTime(comment.created_at)}</span>
                    {user && comment.user_id === user.id && (
                      <button onClick={() => deleteComment(comment.id)} style={{ fontSize: 11, color: C.red, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>🗑️</button>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 13.5, color: C.textMuted, lineHeight: 1.6 }}>{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticky comment input bar ── */}
      {user && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "rgba(0,26,43,0.95)", backdropFilter: "blur(20px)",
          borderTop: `1px solid ${C.border}`, padding: "12px 20px",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escreva um comentário..."
              rows={1}
              style={{
                flex: 1, background: C.bgDeep, border: `1px solid ${C.glassBorder}`,
                borderRadius: 12, padding: "10px 14px", color: C.text, fontSize: 13.5,
                fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5,
                maxHeight: 100,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  postComment();
                }
              }}
            />
            <button
              onClick={postComment}
              disabled={commentLoading || !commentText.trim()}
              style={{
                padding: "10px 20px", borderRadius: 12, border: "none",
                background: commentLoading ? C.glassBorder : C.accent,
                color: C.bgDeep, fontWeight: 800, fontSize: 13,
                cursor: commentLoading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {commentLoading ? "..." : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
