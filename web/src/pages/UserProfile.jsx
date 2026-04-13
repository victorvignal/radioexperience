import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getPostImageUrl } from "../lib/postImages";
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

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [studyLabPosts, setStudyLabPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isOwnProfile = user?.id === id;

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    if (!id || id === "undefined" || id === "null") {
      setProfile(null);
      setPosts([]);
      setStudyLabPosts([]);
      setError("Perfil inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [profileRes, postsRes, studyRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", id)
          .in("type", ["aula", "questoes"])
          .order("created_at", { ascending: false }),
      ]);

      const { data: profileData, error: profileErr } = profileRes;
      const { data: postsData, error: postsErr } = postsRes;
      const { data: studyData, error: studyErr } = studyRes;

      if (profileErr) throw profileErr;
      if (postsErr) throw postsErr;
      if (studyErr) throw studyErr;

      if (!profileData) {
        setError("Perfil não encontrado.");
        setProfile(null);
        setPosts([]);
        setStudyLabPosts([]);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      const userId = user?.id;
      const isOwn = userId === id;
      setPosts((postsData || []).filter(p => isOwn || p.visibility !== "private"));
      setStudyLabPosts((studyData || []).filter(p => isOwn || p.visibility !== "private"));
    } catch (err) {
      console.error("Error fetching profile:", err);
      setProfile(null);
      setPosts([]);
      setStudyLabPosts([]);
      setError(err?.message ? `Erro ao carregar perfil: ${err.message}` : "Erro ao carregar perfil.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  };

  const formatPostDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return "agora";
    if (diffH < 24) return `${diffH}h`;
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: "spin 0.9s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 40 }}>👤</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{error || "Perfil não encontrado"}</p>
        <button onClick={() => navigate("/feed")} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: C.glass, color: C.textSoft, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Voltar ao Feed</button>
      </div>
    );
  }

  const displayName = profile.full_name || "Membro eX";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "RX";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:640px){
          .profile-header{flex-direction:column!important;text-align:center!important;align-items:center!important}
          .profile-stats{justify-content:center!important}
          .profile-edit-btn{width:100%!important;justify-content:center!important}
        }
      `}</style>

      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(0,26,43,0.92)", backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, #b8ff33)`, display: "grid", placeItems: "center" }}>
            <strong style={{ fontSize: 11, color: C.bgDeep, fontStyle: "italic" }}>eX</strong>
          </div>
          <strong style={{ fontSize: 14 }}>RadioeXperience</strong>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate("/dashboard")} style={{ border: `1px solid ${C.glassBorder}`, borderRadius: 8, background: "transparent", color: C.textMuted, padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Dashboard</button>
          <button onClick={() => navigate("/feed")} style={{ border: "none", borderRadius: 8, background: C.accent, color: C.bgDeep, padding: "6px 12px", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>Feed</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 20px 60px" }}>
        {/* Profile Header Card */}
        <div
          style={{
            animation: "fadeIn 0.4s ease",
            borderRadius: 20,
            background: `
              radial-gradient(circle at top left, rgba(221,255,85,0.08), transparent 42%),
              radial-gradient(circle at top right, rgba(126,203,255,0.08), transparent 48%),
              linear-gradient(180deg, rgba(192,214,234,0.08), rgba(192,214,234,0.045))
            `,
            border: `1px solid ${C.glassBorder}`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            padding: 28,
            marginBottom: 20,
            position: "relative",
            overflow: "hidden",
            backdropFilter: "blur(18px)",
          }}
        >
          <div className="profile-header" style={{ display: "flex", gap: 20, alignItems: "flex-start", position: "relative", zIndex: 1 }}>
            {/* Avatar */}
            <div style={{ flexShrink: 0 }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} style={{ width: 80, height: 80, borderRadius: 20, objectFit: "cover", border: `2px solid ${C.glassBorder}` }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, rgba(221,255,85,0.15), rgba(126,203,255,0.1))", border: `2px solid ${C.glassBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: C.accent }}>
                  {initials}
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", marginBottom: 4 }}>{displayName}</h1>
              {profile.specialty && (
                <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 2 }}>{profile.specialty}</div>
              )}
              {profile.institution && (
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>🏥 {profile.institution}</div>
              )}
              <div className="profile-stats" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ background: C.bgDeep, borderRadius: 10, padding: "8px 14px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>Publicações</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.textSoft }}>{posts.length}</div>
                </div>
                <div style={{ background: C.bgDeep, borderRadius: 10, padding: "8px 14px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>Membro desde</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textSoft, marginTop: 2 }}>{formatDate(profile.created_at)}</div>
                </div>
                {studyLabPosts.length > 0 && (
                  <div style={{ background: C.bgDeep, borderRadius: 10, padding: "8px 14px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>StudyLab</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#7ecbff" }}>{studyLabPosts.length}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Edit profile button */}
          {isOwnProfile && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => navigate("/dashboard")}
                className="profile-edit-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: C.glass, color: C.textSoft, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                ✏️ Editar perfil
              </button>
            </div>
          )}
        </div>

        {/* StudyLab Creations */}
        {studyLabPosts.length > 0 && (
          <div style={{ animation: "fadeIn 0.5s ease", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#7ecbff", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>📚 StudyLab</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {studyLabPosts.map((post) => {
                const typeInfo = TYPE_LABELS[post.type] || { label: post.type, color: "#7ecbff" };
                const imageUrl = getPostImageUrl(post);
                return (
                  <div
                    key={post.id}
                    onClick={() => navigate(`/artigo/${post.id}`)}
                    style={{ borderRadius: 14, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 14, cursor: "pointer", transition: "all 0.2s" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: `rgba(126,203,255,0.1)`, border: "1px solid rgba(126,203,255,0.2)", color: "#7ecbff", fontWeight: 700 }}>{post.type === "aula" ? "Aula" : "Questões"}</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>{formatPostDate(post.created_at)}</span>
                    </div>
                    {imageUrl && <img src={imageUrl} alt={post.title} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, marginBottom: 8, border: `1px solid ${C.glassBorder}` }} />}
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textSoft, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{post.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* User Posts */}
        <div style={{ animation: "fadeIn 0.6s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>📝 Publicações</div>
          </div>
          {posts.length === 0 ? (
            <div style={{ borderRadius: 16, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <p style={{ fontSize: 14, color: C.textMuted }}>Nenhuma publicação ainda.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {posts.map((post) => {
                const typeInfo = TYPE_LABELS[post.type] || TYPE_LABELS.article;
                const preview = getPreview(post.content, post.is_agent);
                const imageUrl = getPostImageUrl(post);
                return (
                  <article
                    key={post.id}
                    onClick={() => navigate(`/artigo/${post.id}`)}
                    style={{
                      borderRadius: 16, background: C.glass, border: `1px solid ${C.glassBorder}`, padding: 16, cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 10, padding: "3px 10px", borderRadius: 999,
                        background: `${typeInfo.color}18`, border: `1px solid ${typeInfo.color}35`,
                        color: typeInfo.color, fontWeight: 700,
                      }}>{typeInfo.label}</span>
                      <span style={{ fontSize: 11, color: C.textDim }}>{formatPostDate(post.created_at)}</span>
                    </div>
                    {imageUrl && <img src={imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 10, border: `1px solid ${C.glassBorder}` }} />}
                    <h2 style={{ margin: "0 0 6px", fontSize: 17, lineHeight: 1.3, color: C.text, fontWeight: 800, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{post.title}</h2>
                    <p style={{ margin: 0, color: C.textMuted, lineHeight: 1.6, fontSize: 13, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{preview}</p>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>Ler →</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
