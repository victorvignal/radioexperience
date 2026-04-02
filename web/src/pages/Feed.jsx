/*
  Feed da comunidade RadioeXperience
  - Artigos (postados pelo agente ou manualmente)
  - Vagas de radiologia
  - Discussões gerais
  - Interações (likes, comentários)

  Tabela Supabase necessária (ver SQL no final do arquivo):
  - posts (id, author_id, type, title, content, image_url, metadata, likes_count, comments_count, created_at)
  - post_likes (post_id, user_id)
  - post_comments (id, post_id, user_id, content, created_at)
  - post_bookmarks (post_id, user_id)
*/

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// ═══ Color constants (matching App.jsx) ═══
const C = {
  bg: "#001a2b", bgDeep: "#002233",
  glass: "rgba(192,214,234,0.07)", glassHover: "rgba(192,214,234,0.13)",
  glassBorder: "rgba(192,214,234,0.15)", border: "rgba(192,214,234,0.1)",
  text: "#F6F2E8", textSoft: "#C0D6EA", textMuted: "#8ba8c4", textDim: "#5a7d9a",
  accent: "#DDFF55", accentGlow: "rgba(221,255,85,0.15)", accentSoft: "rgba(221,255,85,0.08)",
  pAria: "#DDFF55", pStudy: "#7ecbff", pTeams: "#5ef0b0",
  pAnalytics: "#ffb347", pCalc: "#ff7eb3", pChallenge: "#ff6b6b",
  pEmbaixador: "#ffd700",
};

// ═══ Post type config ═══
const POST_TYPES = {
  article: { label: "Artigo", icon: "📄", color: C.pStudy, tag: "Ciência" },
  vaga: { label: "Vaga", icon: "💼", color: C.pTeams, tag: "Carreira" },
  discussion: { label: "Discussão", icon: "💬", color: C.pAria, tag: "Comunidade" },
  case: { label: "Caso Clínico", icon: "🩻", color: C.pChallenge, tag: "Clínica" },
};

// ═══ Relative time ═══
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

// ═══ Navbar (compacta) ═══
function FeedNavbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      background: scrolled ? "rgba(0,26,43,0.95)" : "rgba(0,26,43,0.85)",
      backdropFilter: "blur(20px) saturate(1.4)",
      borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      transition: "all 0.4s",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, padding: "0 16px" }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, #b8ff33)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontWeight: 900, fontSize: 10, color: C.bgDeep, fontStyle: "italic" }}>eX</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: "-0.02em" }}>Feed</span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/vagas" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none", fontWeight: 500 }}>Vagas</a>
          <a href="/dashboard" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none", fontWeight: 500 }}>Dashboard</a>
        </div>
      </div>
    </nav>
  );
}

// ═══ Sidebar (trending + filtros) ═══
function Sidebar({ activeFilter, onFilterChange, topAuthors }) {
  const filters = [
    { key: "all", label: "Todos", icon: "🔥" },
    { key: "article", label: "Artigos", icon: "📄" },
    { key: "vaga", label: "Vagas", icon: "💼" },
    { key: "discussion", label: "Discussões", icon: "💬" },
    { key: "case", label: "Casos Clínicos", icon: "🩻" },
  ];

  return (
    <aside style={{ width: 280, flexShrink: 0, position: "sticky", top: 72, height: "fit-content" }}>
      {/* Filtros */}
      <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 16, padding: 16, marginBottom: 16, backdropFilter: "blur(16px)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Filtrar</div>
        {filters.map(f => (
          <button key={f.key} onClick={() => onFilterChange(f.key)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
            background: activeFilter === f.key ? C.accentSoft : "transparent",
            color: activeFilter === f.key ? C.accent : C.textMuted,
            fontSize: 13, fontWeight: activeFilter === f.key ? 600 : 400,
            transition: "all 0.2s", textAlign: "left", marginBottom: 2,
          }}>
            <span>{f.icon}</span>{f.label}
          </button>
        ))}
      </div>

      {/* Top contributors */}
      {topAuthors.length > 0 && (
        <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 16, padding: 16, backdropFilter: "blur(16px)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Top Contribuidores</div>
          {topAuthors.map((a, i) => (
            <div key={a.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < topAuthors.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: `linear-gradient(135deg, ${[C.accent, C.pStudy, C.pTeams, C.pChallenge, C.pAnalytics][i % 5]}40, ${[C.accent, C.pStudy, C.pTeams, C.pChallenge, C.pAnalytics][i % 5]}20)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: [C.accent, C.pStudy, C.pTeams, C.pChallenge, C.pAnalytics][i % 5],
              }}>
                {(a.display_name || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.display_name || "Anônimo"}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{a.post_count} posts</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

// ═══ Post Composer ═══
function PostComposer({ onPost }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("discussion");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .insert({
          author_id: user.id,
          type,
          title: title.trim() || null,
          content: content.trim(),
          metadata: {
            author_name: profile?.display_name || profile?.full_name || "Membro eX",
            author_crm: profile?.crm || null,
          },
        })
        .select()
        .single();

      if (error) throw error;
      setTitle("");
      setContent("");
      setOpen(false);
      if (onPost) onPost(data);
    } catch (err) {
      console.error("Post error:", err);
    }
    setSubmitting(false);
  };

  if (!user) return null;

  return (
    <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 16, padding: 16, marginBottom: 16, backdropFilter: "blur(16px)" }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", borderRadius: 12, border: `1px solid ${C.glassBorder}`,
          background: "transparent", cursor: "pointer", color: C.textDim, fontSize: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.accent}30, ${C.accent}10)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>✏️</div>
          <span>O que você quer compartilhar?</span>
        </button>
      ) : (
        <div>
          {/* Type selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {Object.entries(POST_TYPES).map(([key, val]) => (
              <button key={key} onClick={() => setType(key)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 100, border: "none", cursor: "pointer",
                background: type === key ? `${val.color}20` : "rgba(192,214,234,0.05)",
                color: type === key ? val.color : C.textDim,
                fontSize: 12, fontWeight: type === key ? 600 : 400,
                transition: "all 0.2s",
              }}>
                <span>{val.icon}</span>{val.label}
              </button>
            ))}
          </div>

          {/* Title (for articles) */}
          {(type === "article" || type === "case") && (
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={type === "article" ? "Título do artigo..." : "Título do caso clínico..."} style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: `1px solid ${C.glassBorder}`, background: "rgba(0,26,43,0.5)",
              color: C.text, fontSize: 15, fontWeight: 600, marginBottom: 10,
              outline: "none", fontFamily: "inherit",
            }} />
          )}

          {/* Content */}
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={
            type === "article" ? "Resumo, link, principais achados..." :
            type === "vaga" ? "Descreva a vaga: local, requisitos, contato..." :
            type === "case" ? "Apresente o caso clínico..." :
            "Escreva algo..."
          } rows={4} style={{
            width: "100%", padding: "12px 14px", borderRadius: 10,
            border: `1px solid ${C.glassBorder}`, background: "rgba(0,26,43,0.5)",
            color: C.text, fontSize: 14, lineHeight: 1.6, resize: "vertical",
            outline: "none", fontFamily: "inherit", marginBottom: 12,
          }} />

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => { setOpen(false); setTitle(""); setContent(""); }} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", background: "transparent",
              color: C.textDim, fontSize: 13, cursor: "pointer",
            }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={!content.trim() || submitting} style={{
              padding: "8px 24px", borderRadius: 10, border: "none", cursor: content.trim() ? "pointer" : "default",
              background: content.trim() ? C.accent : "rgba(221,255,85,0.15)",
              color: content.trim() ? C.bgDeep : C.textDim,
              fontSize: 13, fontWeight: 700, opacity: submitting ? 0.7 : 1,
              boxShadow: content.trim() ? `0 0 16px ${C.accentGlow}` : "none",
            }}>{submitting ? "Publicando..." : "Publicar"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Single Post Card ═══
function PostCard({ post, onLike, onBookmark }) {
  const { user, profile } = useAuth();
  const [hov, setHov] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const typeConfig = POST_TYPES[post.type] || POST_TYPES.discussion;
  const authorName = post.metadata?.author_name || "Membro eX";
  const isAgent = post.metadata?.source === "aria_agent";

  useEffect(() => {
    setCommentsCount(post.comments_count || 0);
  }, [post.comments_count]);

  const loadComments = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    if (data) setComments(data);
  };

  const handleComment = async () => {
    if (!newComment.trim() || !user) return;
    setCommenting(true);
    const { data } = await supabase
      .from("post_comments")
      .insert({
        post_id: post.id,
        user_id: user.id,
        content: newComment.trim(),
        metadata: {
          author_name: profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "Membro eX",
        },
      })
      .select()
      .single();
    if (data) {
      setComments([...comments, data]);
      setNewComment("");
      setCommentsCount((prev) => prev + 1);
      // Update count
      await supabase
        .from("posts")
        .update({ comments_count: (post.comments_count || 0) + 1 })
        .eq("id", post.id);
    }
    setCommenting(false);
  };

  return (
    <article
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.glassHover : C.glass,
        border: `1px solid ${C.glassBorder}`,
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        backdropFilter: "blur(16px)",
        transition: "all 0.3s",
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? "0 8px 32px rgba(0,0,0,0.2)" : "none",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: isAgent
              ? `linear-gradient(135deg, ${C.pAria}50, ${C.pAria}20)`
              : `linear-gradient(135deg, ${typeConfig.color}40, ${typeConfig.color}15)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
            border: isAgent ? `2px solid ${C.pAria}50` : "none",
          }}>
            {isAgent ? "🩻" : authorName[0].toUpperCase()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {isAgent ? "ARIA" : authorName}
              </span>
              {isAgent && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: `${C.pAria}15`, color: C.pAria, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agente</span>
              )}
              {post.metadata?.author_crm && !isAgent && (
                <span style={{ fontSize: 11, color: C.textDim }}>CRM {post.metadata.author_crm}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: typeConfig.color, fontWeight: 600, padding: "1px 8px", borderRadius: 100, background: `${typeConfig.color}12` }}>
                {typeConfig.icon} {typeConfig.tag}
              </span>
              <span style={{ fontSize: 11, color: C.textDim }}>{timeAgo(post.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      {post.title && (
        <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: "0 0 8px", lineHeight: 1.4 }}>
          {post.title}
        </h3>
      )}
      <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7, margin: "0 0 14px", whiteSpace: "pre-wrap" }}>
        {post.content}
      </p>

      {/* Image */}
      {post.image_url && (
        <div style={{ marginBottom: 14, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <img src={post.image_url} alt="" style={{ width: "100%", display: "block" }} />
        </div>
      )}

      {/* Metadata pills (for articles) */}
      {post.metadata?.source_url && (
        <a href={post.metadata.source_url} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 8, marginBottom: 14,
          background: `${C.pStudy}10`, border: `1px solid ${C.pStudy}20`,
          color: C.pStudy, fontSize: 12, fontWeight: 500, textDecoration: "none",
        }}>
          🔗 {post.metadata.journal || "Fonte original"}
        </a>
      )}

      {/* Actions bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => onLike(post.id)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          background: post.user_liked ? `${C.pChallenge}15` : "transparent",
          color: post.user_liked ? C.pChallenge : C.textDim,
          fontSize: 12, fontWeight: 500, transition: "all 0.2s",
        }}>
          {post.user_liked ? "❤️" : "🤍"} {post.likes_count || 0}
        </button>
        <button onClick={() => { setShowComments(!showComments); if (!showComments) loadComments(); }} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "transparent", color: C.textDim, fontSize: 12, fontWeight: 500,
        }}>
          💬 {commentsCount}
        </button>
        <button onClick={() => onBookmark(post.id)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          background: post.user_bookmarked ? `${C.pEmbaixador}15` : "transparent",
          color: post.user_bookmarked ? C.pEmbaixador : C.textDim,
          fontSize: 12, fontWeight: 500, transition: "all 0.2s",
        }}>
          {post.user_bookmarked ? "⭐" : "☆"} Salvar
        </button>
        <div style={{ flex: 1 }} />
        <button style={{
          padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "transparent", color: C.textDim, fontSize: 12,
        }}>
          ↗ Compartilhar
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${C.textDim}30, ${C.textDim}10)`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.textDim,
              }}>
                {(c.metadata?.author_name || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textSoft }}>{c.metadata?.author_name || "Membro"}</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{c.content}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{timeAgo(c.created_at)}</div>
              </div>
            </div>
          ))}
          {user && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && handleComment()} placeholder="Comentar..." style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${C.glassBorder}`, background: "rgba(0,26,43,0.5)",
                color: C.text, fontSize: 13, outline: "none",
              }} />
              <button onClick={handleComment} disabled={!newComment.trim() || commenting} style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: newComment.trim() ? C.accent : "rgba(221,255,85,0.1)",
                color: newComment.trim() ? C.bgDeep : C.textDim,
                fontSize: 12, fontWeight: 700, cursor: newComment.trim() ? "pointer" : "default",
              }}>Enviar</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ═══ Skeleton loader ═══
function PostSkeleton() {
  return (
    <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(192,214,234,0.08)" }} />
        <div>
          <div style={{ width: 120, height: 12, borderRadius: 6, background: "rgba(192,214,234,0.08)", marginBottom: 8 }} />
          <div style={{ width: 80, height: 10, borderRadius: 5, background: "rgba(192,214,234,0.05)" }} />
        </div>
      </div>
      <div style={{ width: "100%", height: 12, borderRadius: 6, background: "rgba(192,214,234,0.06)", marginBottom: 8 }} />
      <div style={{ width: "80%", height: 12, borderRadius: 6, background: "rgba(192,214,234,0.06)", marginBottom: 8 }} />
      <div style={{ width: "60%", height: 12, borderRadius: 6, background: "rgba(192,214,234,0.06)" }} />
    </div>
  );
}

// ═══ Main Feed Page ═══
export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [topAuthors, setTopAuthors] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const POSTS_PER_PAGE = 15;

  const fetchPosts = useCallback(async (pageNum = 0, typeFilter = filter) => {
    setLoading(true);
    try {
      let query = supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .range(pageNum * POSTS_PER_PAGE, (pageNum + 1) * POSTS_PER_PAGE - 1);

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Check user likes/bookmarks
      if (user && data?.length) {
        const postIds = data.map(p => p.id);
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
          supabase.from("post_bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds),
        ]);
        const likedSet = new Set((likesRes.data || []).map(l => l.post_id));
        const bookmarkedSet = new Set((bookmarksRes.data || []).map(b => b.post_id));

        data.forEach(p => {
          p.user_liked = likedSet.has(p.id);
          p.user_bookmarked = bookmarkedSet.has(p.id);
        });
      }

      if (pageNum === 0) {
        setPosts(data || []);
      } else {
        setPosts(prev => [...prev, ...(data || [])]);
      }
      setHasMore((data || []).length === POSTS_PER_PAGE);
    } catch (err) {
      console.error("Fetch posts error:", err);
    }
    setLoading(false);
  }, [filter, user]);

  const fetchTopAuthors = async () => {
    try {
      const { data } = await supabase
        .from("posts")
        .select("metadata")
        .not("metadata->author_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (data) {
        const counts = {};
        data.forEach(p => {
          const name = p.metadata?.author_name;
          if (name) counts[name] = (counts[name] || 0) + 1;
        });
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ display_name: name, post_count: count }));
        setTopAuthors(sorted);
      }
    } catch (err) {
      console.error("Top authors error:", err);
    }
  };

  useEffect(() => { fetchPosts(0); fetchTopAuthors(); }, [fetchPosts]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(0);
    fetchPosts(0, newFilter);
  };

  const handleLike = async (postId) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.user_liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      await supabase.from("posts").update({ likes_count: Math.max(0, (post.likes_count || 1) - 1) }).eq("id", postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_liked: false, likes_count: Math.max(0, (p.likes_count || 1) - 1) } : p));
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
      await supabase.from("posts").update({ likes_count: (post.likes_count || 0) + 1 }).eq("id", postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_liked: true, likes_count: (p.likes_count || 0) + 1 } : p));
    }
  };

  const handleBookmark = async (postId) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.user_bookmarked) {
      await supabase.from("post_bookmarks").delete().eq("post_id", postId).eq("user_id", user.id);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_bookmarked: false } : p));
    } else {
      await supabase.from("post_bookmarks").insert({ post_id: postId, user_id: user.id });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_bookmarked: true } : p));
    }
  };

  const handleNewPost = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next);
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <FeedNavbar />

      <div style={{
        maxWidth: 900, margin: "0 auto", padding: "72px 16px 40px",
        display: "flex", gap: 24,
      }}>
        {/* Main feed */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <PostComposer onPost={handleNewPost} />

          {loading && posts.length === 0 ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : posts.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 16,
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>Nenhum post ainda</div>
              <div style={{ fontSize: 13, color: C.textDim }}>Seja o primeiro a compartilhar algo!</div>
            </div>
          ) : (
            <>
              {posts.map(post => (
                <PostCard key={post.id} post={post} onLike={handleLike} onBookmark={handleBookmark} />
              ))}
              {hasMore && (
                <button onClick={loadMore} style={{
                  width: "100%", padding: "14px", borderRadius: 12,
                  border: `1px solid ${C.glassBorder}`, background: C.glass,
                  color: C.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer",
                  marginTop: 8,
                }}>
                  Carregar mais
                </button>
              )}
            </>
          )}
        </main>

        {/* Sidebar */}
        <Sidebar activeFilter={filter} onFilterChange={handleFilterChange} topAuthors={topAuthors} />
      </div>

      {/* Mobile: filter bar */}
      <style>{`
        @media(max-width: 768px) {
          aside { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}

/*
══════════════════════════════════════════════════
SQL PARA RODAR NO SUPABASE:

-- Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'discussion' CHECK (type IN ('article', 'vaga', 'discussion', 'case')),
  title text,
  content text NOT NULL,
  image_url text,
  metadata jsonb DEFAULT '{}',
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_posts_type ON public.posts(type);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX idx_posts_author ON public.posts(author_id);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posts" ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authors can update own posts" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own posts" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

-- Post likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON public.post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own likes" ON public.post_likes
  FOR ALL USING (auth.uid() = user_id);

-- Post comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_comments_post ON public.post_comments(post_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON public.post_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON public.post_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Post bookmarks
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks" ON public.post_bookmarks
  FOR ALL USING (auth.uid() = user_id);

══════════════════════════════════════════════════
*/
