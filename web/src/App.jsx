import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { supabase } from "./lib/supabase";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ProfileSetup from "./pages/ProfileSetup";
import Vagas from "./pages/Vagas";
import AdminUpload from "./pages/AdminUpload";
import ArticleUpload from "./pages/ArticleUpload";
import Feed from "./pages/Feed";
import NewPost from "./pages/NewPost";
import PostView from "./pages/PostView";
import AuthCallback from "./pages/AuthCallback";
import AriaPage from "./pages/AriaPage";
import Create from "./pages/Create";
import UserProfile from "./pages/UserProfile";
import Teams from "./pages/Teams";
import ChallengePage from "./pages/ChallengePage";

const C = {
bg: "#001a2b", bgDeep: "#002233",
glass: "rgba(192,214,234,0.07)", glassHover: "rgba(192,214,234,0.13)",
glassBorder: "rgba(192,214,234,0.15)", border: "rgba(192,214,234,0.1)",
text: "#F6F2E8", textSoft: "#C0D6EA", textMuted: "#8ba8c4", textDim: "#5a7d9a",
accent: "#DDFF55", accentGlow: "rgba(221,255,85,0.15)", accentSoft: "rgba(221,255,85,0.08)",
pAria: "#DDFF55", pStudy: "#7ecbff", pAcademy: "#C5C0C9", pTeams: "#5ef0b0",
pAnalytics: "#ffb347", pCalc: "#ff7eb3", pChallenge: "#ff6b6b",
pEmbaixador: "#ffd700",
};

function EX({ color = C.accent, size = 16 }) {
return (
<span style={{ color, fontWeight: 800, fontStyle: "italic" }}>
<span style={{ fontSize: size * 0.85 }}>e</span>
<span style={{ fontSize: size * 1.12, fontWeight: 900 }}>X</span>
</span>
);
}
function PillarName({ name, color, size = 18 }) {
if (name.startsWith("eX ")) {
return (<span style={{ fontSize: size, fontWeight: 700 }}><EX color={color} size={size} /><span style={{ color: C.text }}>{" "}{name.substring(3)}</span></span>);
}
return <span style={{ fontSize: size, fontWeight: 700, color: C.text }}>{name}</span>;
}
function Logo({ size = 20, showIcon = true }) {
return (
<Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textDecoration: "none" }}>
{showIcon && (<div style={{ width: size * 1.8, height: size * 1.8, borderRadius: size * 0.5, background: `linear-gradient(135deg, ${C.accent}, #b8ff33)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${C.accentGlow}` }}><span style={{ fontWeight: 900, fontSize: size * 0.65, color: C.bgDeep, fontStyle: "italic", letterSpacing: "-0.06em" }}><span style={{ fontSize: size * 0.55 }}>e</span><span style={{ fontSize: size * 0.75 }}>X</span></span></div>)}
<span style={{ fontFamily: "'Inter',sans-serif", fontSize: size, fontWeight: 700, letterSpacing: "-0.03em", color: C.text }}>Radio<EX color={C.accent} size={size} />perience</span>
</Link>
);
}

// ═══════════════════════════════════════════════════
// Simple CSS background (no canvas)
function NeuralBackground() { return null; }
// Floating gradient orbs
function FloatingOrbs() {
return (
<div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
{/* Hero orbs */}
<div style={{
position: "absolute", top: "5%", left: "15%", width: 500, height: 500,
borderRadius: "50%", background: "radial-gradient(circle, rgba(221,255,85,0.06) 0%, transparent 60%)",
filter: "blur(60px)", animation: "float1 20s ease-in-out infinite",
}} />
<div style={{
position: "absolute", top: "8%", right: "10%", width: 400, height: 400,
borderRadius: "50%", background: "radial-gradient(circle, rgba(17,66,93,0.5) 0%, transparent 70%)",
filter: "blur(80px)", animation: "float2 25s ease-in-out infinite",
}} />
<div style={{
position: "absolute", top: "25%", left: "60%", width: 300, height: 300,
borderRadius: "50%", background: "radial-gradient(circle, rgba(126,203,255,0.05) 0%, transparent 70%)",
filter: "blur(50px)", animation: "float3 18s ease-in-out infinite",
}} />
{/* Mid-page orbs */}
<div style={{
position: "absolute", top: "45%", left: "5%", width: 600, height: 400,
borderRadius: "50%", background: "radial-gradient(ellipse, rgba(221,255,85,0.04) 0%, transparent 60%)",
filter: "blur(70px)", animation: "float2 22s ease-in-out infinite",
}} />
<div style={{
position: "absolute", top: "55%", right: "5%", width: 500, height: 500,
borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.03) 0%, transparent 70%)",
filter: "blur(60px)", animation: "float1 28s ease-in-out infinite",
}} />
{/* Bottom orbs */}
<div style={{
position: "absolute", top: "75%", left: "30%", width: 500, height: 500,
borderRadius: "50%", background: "radial-gradient(circle, rgba(255,215,0,0.04) 0%, transparent 60%)",
filter: "blur(80px)", animation: "float3 24s ease-in-out infinite",
}} />
</div>
);
}

// Noise texture overlay
function NoiseOverlay() {
return (
<div style={{
position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
backgroundSize: "256px 256px",
}} />
);
}

// Scan line effect (radiology feel)
function ScanLines() {
return (
<div style={{
position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.015,
backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(192,214,234,0.5) 2px, rgba(192,214,234,0.5) 3px)`,
backgroundSize: "100% 4px",
}} />
);
}

// ─── Data ───
const PILLARS = [
{ id: "aria", name: "ARIA", tagline: "Assistente de Radiologia por IA", description: "Assistente inteligente para dúvidas clínicas, protocolos e literatura. RAG com +520 documentos científicos.", icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.pAria} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M9 14h6"/><path d="M12 14v4"/><circle cx="12" cy="21" r="1"/><path d="M3 10a9 9 0 0 0 18 0"/></svg>), color: C.pAria, features: ["Busca semântica em literatura", "Protocolos por especialidade", "Análise de imagens"] },
{ id: "challenge", name: "ARIA Challenge", tagline: "Disputa com a ARIA", description: "Desafie a ARIA em batalhas de conhecimento! Dispute rankings e prove que você é melhor que a IA.", icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.pChallenge} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>), color: C.pChallenge, features: ["Batalhas Humano vs IA", "Ranking por especialidade", "Casos cronometrados"] },
{ id: "studylab", name: "eX StudyLab", tagline: "O Duolingo da Radiologia", description: "Repetição espaçada e casos gamificados. Publique com avatares exclusivos.", icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.pStudy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6l3 7H6L9 2z"/><circle cx="12" cy="15" r="5"/><path d="M12 12v3l2 1"/></svg>), color: C.pStudy, features: ["Spaced repetition", "Avatares anônimos", "Casos interativos"] },
{ id: "academy", name: "eX Academy", tagline: "Microlessons com Avatar IA", description: "Aulas curtas por avatar HeyGen. Aprenda onde e quando quiser.", icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.pAcademy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/></svg>), color: C.pAcademy, features: ["Avatar IA professor", "5-10 min por aula", "Certificados"] },
{ id: "teams", name: "eX Teams", tagline: "Gestão de Equipes", description: "Escalas, alocações e coordenação de equipes entre unidades.", icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.pTeams} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>), color: C.pTeams, features: ["Escalas inteligentes", "Multi-unidade", "Comunicação centralizada"] },
{ id: "calculator", name: "eX Calculator", tagline: "Calculadoras Radiológicas", description: "TI-RADS, O-RADS, PI-RADS, Greulich & Pyle e dezenas mais.", icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.pCalc} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><circle cx="8" cy="10.5" r="0.8" fill={C.pCalc}/><circle cx="12" cy="10.5" r="0.8" fill={C.pCalc}/><circle cx="16" cy="10.5" r="0.8" fill={C.pCalc}/><line x1="8" y1="18" x2="16" y2="18"/></svg>), color: C.pCalc, features: ["TI-RADS, O-RADS, PI-RADS", "Greulich & Pyle", "Scores radiológicos"] },
];
const PLANS = [
{ name: "eX Free", price: "Grátis", period: "", description: "Sua porta de entrada", color: C.textMuted, features: ["Comunidade eX", "Perfil profissional", "Calculadoras essenciais", "3 perguntas ARIA/mês"], cta: "Entrar na Comunidade", popular: false },
{ name: "eX Pro", price: "R$297", period: "/mês", description: "O plano completo", color: C.accent, features: ["Tudo do Free +", "ARIA ilimitada", "ARIA Challenge", "StudyLab + Academy", "eX Calculator completo", "Participação nos lucros1"], cta: "Teste 7 Dias Grátis", popular: true },
{ name: "eX Squad", price: "R$227", period: "/mês por médico", description: "Para equipes (mín. 5)", color: C.pTeams, features: ["Tudo do Pro +", "eX Analytics", "Dashboard coordenador", "Relatórios consolidados", "Participação nos lucros1", "Onboarding dedicado"], cta: "Montar meu Squad", popular: false },
{ name: "eX Command", price: "Consulte", period: "", description: "Solução B2B", color: C.pAnalytics, features: ["Tudo do Squad +", "API dedicada", "Integrações custom", "SLA garantido", "Treinamento presencial", "Account manager"], cta: "Agendar Demo", popular: false },
];

// ─── Hooks ───
function useCounter(end, dur = 2000, trigger = true) {
const [v, setV] = useState(0);
useEffect(() => { if (!trigger) return; let t0 = null; const step = (ts) => { if (!t0) t0 = ts; const p = Math.min((ts - t0) / dur, 1); setV(Math.floor(end * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, [trigger, end, dur]); return v;
}
function useInView(th = 0.12) {
const ref = useRef(null); const [vis, setVis] = useState(false);
useEffect(() => { const el = ref.current; if (!el) return; const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: th }); obs.observe(el); return () => obs.disconnect(); }, [th]); return [ref, vis];
}

// ─── Navbar ───
function Navbar({ section }) {
const { user } = useAuth();
const [scrolled, setScrolled] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [profile, setProfile] = useState(null);
useEffect(() => { const h = () => setScrolled(window.scrollY > 50); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
useEffect(() => {
  const loadProfile = async () => {
    if (!user?.id) return setProfile(null);
    const { data } = await supabase.from('profiles').select('full_name,avatar_url,specialty').eq('id', user.id).maybeSingle();
    setProfile(data || null);
  };
  loadProfile();
}, [user?.id]);
const links = [{ id: "hero", l: "Início" }, { id: "pillars", l: "Plataforma" }, { id: "community", l: "Comunidade" }, { id: "pricing", l: "Planos" }, { id: "embaixadores", l: "Embaixadores" }];
const firstName = (profile?.full_name || user?.email || 'Membro').split(' ')[0];
const avatar = profile?.avatar_url;
const initials = firstName?.[0]?.toUpperCase() || 'M';
return (
<nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, background: scrolled ? "rgba(0,26,43,0.92)" : "rgba(0,26,43,0.85)", backdropFilter: scrolled ? "blur(24px) saturate(1.4)" : "blur(16px)", WebkitBackdropFilter: scrolled ? "blur(24px) saturate(1.4)" : "blur(16px)", borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent", transition: "all 0.5s cubic-bezier(.4,0,.2,1)" }}>
<div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, padding: "0 20px" }}>
<Logo size={17} />
<div style={{ display: "flex", alignItems: "center", gap: 3 }} className="desktop-nav">
{links.map(l => (<a key={l.id} href={`#${l.id}`} style={{ padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, color: section === l.id ? C.accent : C.textMuted, background: section === l.id ? C.accentSoft : "transparent", textDecoration: "none", transition: "all 0.25s" }}>{l.l}</a>))}
<Link to="/teams" style={{ padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: C.textSoft, textDecoration: "none", background: "transparent", transition: "all 0.25s" }}>eX Teams</Link>
<div style={{ width: 1, height: 20, background: C.border, margin: "0 8px" }} />
{user ? (
  <>
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:12, border:`1px solid ${C.glassBorder}`, background:C.glass }}>
      {avatar ? <img src={avatar} alt="Avatar" style={{ width:28, height:28, borderRadius:9, objectFit:'cover' }} /> : <div style={{ width:28, height:28, borderRadius:9, background:C.accentSoft, color:C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12 }}>{initials}</div>}
      <div style={{ lineHeight:1.2 }}><div style={{ fontSize:10, color:C.textDim }}>Bem-vindo</div><div style={{ fontSize:12, color:C.textSoft, fontWeight:700 }}>{firstName}</div></div>
    </div>
    <Link to="/dashboard" style={{ textDecoration: "none" }}><button style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: C.textSoft, background: "transparent", border: `1px solid ${C.glassBorder}`, cursor: "pointer" }}>Dashboard</button></Link>
    <Link to="/feed" style={{ textDecoration: "none" }}><button style={{ padding: "7px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: C.bgDeep, background: C.accent, border: "none", cursor: "pointer", marginLeft: 2, boxShadow: `0 0 16px ${C.accentGlow}` }}>Abrir Feed</button></Link>
  </>
) : (
  <>
    <Link to="/login" style={{ textDecoration: "none" }}><button style={{ padding: "7px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, color: C.textSoft, background: "transparent", border: `1px solid ${C.glassBorder}`, cursor: "pointer" }}>Entrar</button></Link>
    <Link to="/signup" style={{ textDecoration: "none" }}><button style={{ padding: "7px 20px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: C.bgDeep, background: C.accent, border: "none", cursor: "pointer", marginLeft: 6, boxShadow: `0 0 16px ${C.accentGlow}` }}>Começar</button></Link>
  </>
)}
</div>
<div className="hamburger" onClick={() => setMenuOpen(!menuOpen)} style={{ display: "none", flexDirection: "column", gap: 5, cursor: "pointer", padding: 8 }}>
<span style={{ display: "block", width: 22, height: 2, background: C.textSoft, borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
<span style={{ display: "block", width: 22, height: 2, background: C.textSoft, borderRadius: 2, transition: "all 0.3s", opacity: menuOpen ? 0 : 1 }} />
<span style={{ display: "block", width: 22, height: 2, background: C.textSoft, borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
</div>
</div>
{menuOpen && (
<div className="mobile-menu" style={{ display: "none", flexDirection: "column", padding: "12px 16px 20px", borderTop: `1px solid ${C.border}`, background: "rgba(0,26,43,0.95)" }}>
{links.map(l => (<a key={l.id} href={`#${l.id}`} onClick={() => setMenuOpen(false)} style={{ padding: "14px 0", borderRadius: 8, fontSize: 15, fontWeight: 500, color: section === l.id ? C.accent : C.textSoft, textDecoration: "none", borderBottom: `1px solid ${C.border}` }}>{l.l}</a>))}
<Link to="/teams" onClick={() => setMenuOpen(false)} style={{ padding: "14px 0", borderRadius: 8, fontSize: 15, fontWeight: 600, color: C.textSoft, textDecoration: "none", borderBottom: `1px solid ${C.border}` }}>eX Teams</Link>
<div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap:'wrap' }}>
{user ? <>
  <Link to="/dashboard" style={{ textDecoration: "none", flex: 1 }}><button onClick={() => setMenuOpen(false)} style={{ width: "100%", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: C.textSoft, background: "transparent", border: `1px solid ${C.glassBorder}`, cursor: "pointer" }}>Dashboard</button></Link>
  <Link to="/feed" style={{ textDecoration: "none", flex: 1 }}><button onClick={() => setMenuOpen(false)} style={{ width: "100%", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 700, color: C.bgDeep, background: C.accent, border: "none", cursor: "pointer" }}>Feed</button></Link>
</> : <>
<Link to="/login" style={{ textDecoration: "none", flex: 1 }}><button onClick={() => setMenuOpen(false)} style={{ width: "100%", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 500, color: C.textSoft, background: "transparent", border: `1px solid ${C.glassBorder}`, cursor: "pointer" }}>Entrar</button></Link>
<Link to="/signup" style={{ textDecoration: "none", flex: 1 }}><button onClick={() => setMenuOpen(false)} style={{ width: "100%", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 700, color: C.bgDeep, background: C.accent, border: "none", cursor: "pointer" }}>Começar</button></Link>
</>}
</div>
</div>
)}
<style>{`
@media(max-width:768px) {
  .desktop-nav { display: none !important; }
  .hamburger { display: flex !important; }
  .mobile-menu { display: flex !important; }
}
`}</style>
</nav>
);
}

// ─── Hero ───
function Hero({ onFeed, user }) {
const [ref, inView] = useInView(0.1);
const docs = useCounter(520, 2200, inView); const specs = useCounter(9, 1400, inView); const users = useCounter(150, 1800, inView);
const a = (d) => ({ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(28px)", transition: `all 0.8s cubic-bezier(.4,0,.2,1) ${d}s` });

return (
<section id="hero" className="hero-section" ref={ref} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "130px 24px 80px", position: "relative" }}>
<div className="hero-badge" style={{ ...a(0), display: "inline-flex", alignItems: "center", gap: 10, padding: "5px 18px 5px 6px", borderRadius: 100, background: C.accentSoft, border: "1px solid rgba(221,255,85,0.2)", marginBottom: 36, position: "relative", zIndex: 1 }}>
<span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 10, fontWeight: 800, background: C.accent, color: C.bgDeep, textTransform: "uppercase", letterSpacing: "0.08em" }}>Beta</span>
<span style={{ fontSize: 13, color: C.accent, fontWeight: 500 }}>A única plataforma que divide os lucros com você</span>
</div>

  <div className="hero-title-wrap" style={{ ...a(0.1), marginBottom: 28, position: "relative", zIndex: 1 }}>
    <h1 className="hero-title" style={{ fontSize: "clamp(38px, 5.5vw, 72px)", fontWeight: 800, lineHeight: 1.05, color: C.text, maxWidth: 900, letterSpacing: "-0.04em" }}>
      A <EX color={C.accent} size={72} />periência que vai<br />
      <span style={{ background: `linear-gradient(135deg, ${C.accent}, #b8ff33, ${C.accent})`, backgroundSize: "200% 200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "gradientShift 4s ease infinite" }}>revolucionar</span>{" "}sua radiologia
    </h1>
  </div>

  <p className="hero-copy" style={{ fontSize: "clamp(16px, 2vw, 20px)", color: C.textMuted, maxWidth: 640, lineHeight: 1.65, margin: "0 0 16px", ...a(0.2), position: "relative", zIndex: 1 }}>
    7 pilares. IA clínica. Educação gamificada. Uma comunidade que cresce junto.
    <br /><strong style={{ color: C.textSoft }}>E parte dos lucros devolvida para quem faz acontecer.</strong>
  </p>
  <p className="hero-welcome" style={{ fontSize: 15, color: C.accent, fontWeight: 600, marginBottom: 44, ...a(0.25), position: "relative", zIndex: 1 }}>Bem-vindo à comunidade <EX color={C.accent} size={15} />.</p>

  <div className="hero-cta-row" style={{ display: "flex", gap: 14, marginBottom: 72, flexWrap: "wrap", justifyContent: "center", ...a(0.3), position: "relative", zIndex: 1 }}>
    <button style={{ padding: "15px 36px", borderRadius: 12, fontSize: 16, fontWeight: 700, color: C.bgDeep, border: "none", cursor: "pointer", background: C.accent, boxShadow: `0 0 40px ${C.accentGlow}, 0 4px 24px rgba(0,0,0,0.4)` }}>Teste 7 Dias Grátis →</button>
    <button style={{ padding: "15px 36px", borderRadius: 12, fontSize: 16, fontWeight: 600, color: C.textSoft, cursor: "pointer", background: C.glass, border: `1px solid ${C.glassBorder}`, backdropFilter: "blur(12px)" }}>Ver Demonstração</button>
    <button onClick={onFeed} style={{ padding: "15px 28px", borderRadius: 12, fontSize: 15, fontWeight: 700, color: user ? C.bgDeep : C.textSoft, border: user ? "none" : `1px solid ${C.glassBorder}`, cursor: "pointer", background: user ? C.accent : C.glass, boxShadow: user ? `0 0 24px ${C.accentGlow}` : "none" }}>
      {user ? "Ver Feed" : "Feed (faça login)"}
    </button>
  </div>

  <div className="hero-stats" style={{ display: "flex", gap: 2, borderRadius: 18, overflow: "hidden", background: C.glass, border: `1px solid ${C.glassBorder}`, backdropFilter: "blur(16px)", ...a(0.4), position: "relative", zIndex: 1 }}>
    {[{ v: `${docs}+`, l: "Docs científicos" }, { v: specs, l: "Especialidades" }, { v: `${users}+`, l: "Na waitlist" }].map((s, i) => (
      <div key={i} style={{ textAlign: "center", padding: "20px 40px", borderRight: i < 2 ? `1px solid ${C.glassBorder}` : "none" }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: C.accent, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
        <div style={{ fontSize: 12, color: C.textDim, fontWeight: 500, marginTop: 4 }}>{s.l}</div>
      </div>
    ))}
  </div>
</section>

);
}

// ─── Liquid Glass Card ───
function LiquidGlassCard({ pillar, index, inView }) {
const [hov, setHov] = useState(false);
const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
const ref = useRef(null);
const navigate = useNavigate();
const handleMouse = (e) => { if (!ref.current) return; const r = ref.current.getBoundingClientRect(); setMouse({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); };
const handleClick = () => { if (pillar.id === 'challenge') navigate('/challenge'); };

return (
<div ref={ref} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setMouse({ x: 0.5, y: 0.5 }); }} onMouseMove={handleMouse} onClick={handleClick} style={{
position: "relative", overflow: "hidden", cursor: "pointer", borderRadius: 24, padding: 2,
background: hov ? `linear-gradient(${135 + (mouse.x - 0.5) * 60}deg, ${pillar.color}50, rgba(255,255,255,0.15) ${30 + mouse.x * 40}%, ${pillar.color}30 ${60 + mouse.y * 20}%, rgba(255,255,255,0.08))` : `linear-gradient(135deg, ${pillar.color}20, rgba(255,255,255,0.06), ${pillar.color}10)`,
transition: "all 0.5s cubic-bezier(.4,0,.2,1)", transform: hov ? `translateY(-6px) perspective(800px) rotateX(${(mouse.y - 0.5) * -3}deg) rotateY(${(mouse.x - 0.5) * 3}deg)` : "translateY(0)",
boxShadow: hov ? `0 30px 80px rgba(0,0,0,0.4), 0 0 60px ${pillar.color}12` : "0 4px 30px rgba(0,0,0,0.2)",
opacity: inView ? 1 : 0, animation: inView ? `fadeUp 0.6s ease ${index * 0.07}s forwards` : "none",
}}>
<div style={{ borderRadius: 22, padding: 28, position: "relative", overflow: "hidden", background: `rgba(0,26,43,0.5)`, backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)" }}>
<div style={{ position: "absolute", left: `${mouse.x * 100}%`, top: `${mouse.y * 100}%`, transform: "translate(-50%,-50%)", width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,255,255,${hov ? 0.07 : 0.02}) 0%, transparent 70%)`, filter: "blur(30px)", pointerEvents: "none", transition: hov ? "none" : "all 0.5s" }} />
<div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 5%, rgba(255,255,255,${hov ? 0.2 : 0.06}) ${20 + mouse.x * 60}%, transparent 95%)`, transition: hov ? "none" : "all 0.5s" }} />
{pillar.id === "challenge" && (<div style={{ position: "absolute", top: 14, right: 14, padding: "3px 10px", borderRadius: 100, background: `${pillar.color}20`, border: `1px solid ${pillar.color}35`, fontSize: 10, fontWeight: 800, color: pillar.color, textTransform: "uppercase", animation: "pulse 2s ease infinite" }}>🔥 Novo</div>)}
<div style={{ position: "relative" }}>
<div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
<div style={{ width: 48, height: 48, borderRadius: 14, background: `${pillar.color}12`, border: `1px solid ${pillar.color}22`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: hov ? `0 0 24px ${pillar.color}18` : "none" }}>{pillar.icon}</div>
<div>
<PillarName name={pillar.name} color={pillar.color} size={18} />
<div style={{ fontSize: 11, fontWeight: 600, color: pillar.color, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2, opacity: 0.85 }}>{pillar.tagline}</div>
</div>
</div>
<p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.7, margin: "0 0 18px" }}>{pillar.description}</p>
<div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
{pillar.features.map((f, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: pillar.color, boxShadow: `0 0 10px ${pillar.color}90`, flexShrink: 0 }} /><span style={{ fontSize: 12.5, color: C.textMuted, fontWeight: 500 }}>{f}</span></div>))}
</div>
<div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, color: pillar.color, fontSize: 13, fontWeight: 600, opacity: hov ? 1 : 0.5, transition: "all 0.3s", transform: hov ? "translateX(6px)" : "translateX(0)" }}>
{pillar.id === "challenge" ? "Aceitar Desafio →" : "Explorar em breve →"}
</div>
</div>
</div>
</div>
);
}

function Pillars() {
const [ref, inView] = useInView(0.08);
return (
<section id="pillars" ref={ref} style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
<div style={{ maxWidth: 1440, margin: "0 auto" }}>
<div style={{ textAlign: "center", marginBottom: 60 }}>
<div style={{ display: "inline-block", padding: "5px 16px", borderRadius: 100, background: C.accentSoft, border: "1px solid rgba(221,255,85,0.15)", fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>7 Pilares</div>
<h2 style={{ fontSize: "clamp(28px, 4vw, 50px)", fontWeight: 800, color: C.text, letterSpacing: "-0.035em", margin: "0 0 16px" }}>Um ecossistema <span style={{ color: C.accent }}>completo</span></h2>
<p style={{ fontSize: 16, color: C.textMuted, maxWidth: 560, margin: "0 auto", lineHeight: 1.65 }}>Cada pilar resolve uma dor real do radiologista. Juntos, transformam sua prática clínica.</p>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18, marginBottom: 18 }}>
{PILLARS.slice(0, 2).map((p, i) => <LiquidGlassCard key={p.id} pillar={p} index={i} inView={inView} />)}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 18 }}>
{PILLARS.slice(2, 5).map((p, i) => <LiquidGlassCard key={p.id} pillar={p} index={i + 2} inView={inView} />)}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
{PILLARS.slice(5).map((p, i) => <LiquidGlassCard key={p.id} pillar={p} index={i + 5} inView={inView} />)}
</div>
</div>
</section>
);
}

// ─── Community ───
function Community() {
const [ref, inView] = useInView(0.1);
const a = (d) => ({ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(28px)", transition: `all 0.8s cubic-bezier(.4,0,.2,1) ${d}s` });
const members = useCounter(150, 2000, inView);
const values = [
{ icon: "🧬", title: "Evolução Contínua", desc: "Cada dia é uma chance de saber mais. A comunidade eX respira crescimento." },
{ icon: "🤝", title: "Colaboração Real", desc: "Sem egos. Residentes e especialistas lado a lado, construindo juntos." },
{ icon: "🔥", title: "Meritocracia Radical", desc: "Quem mais contribui, mais ganha. Reconhecimento, visibilidade, resultados." },
{ icon: "🛡️", title: "Ética e Transparência", desc: "LGPD. Conteúdo verificado. Confiança não é slogan - é regra." },
{ icon: "💡", title: "Inovação sem Medo", desc: "IA potencializa radiologista. Aqui você abraça o futuro." },
{ icon: "🏆", title: "Pertencimento", desc: "Ser eX é uma identidade. Um movimento que redesenha a radiologia." },
];
return (
<section id="community" ref={ref} style={{ padding: "120px 24px", position: "relative", zIndex: 1 }}>
<div style={{ maxWidth: 1440, margin: "0 auto" }}>
<div style={{ textAlign: "center", marginBottom: 56 }}>
<div style={{ ...a(0), display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 18px", borderRadius: 100, background: "rgba(221,255,85,0.08)", border: "1px solid rgba(221,255,85,0.2)", marginBottom: 24 }}><span style={{ fontSize: 14 }}>⚡</span><span style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>Mais que uma plataforma</span></div>
<h2 style={{ ...a(0.1), fontSize: "clamp(30px, 4.5vw, 56px)", fontWeight: 800, color: C.text, letterSpacing: "-0.04em", margin: "0 0 20px" }}>A cultura <EX color={C.accent} size={56} /></h2>
<p style={{ ...a(0.15), fontSize: 18, color: C.textMuted, maxWidth: 680, margin: "0 auto 16px", lineHeight: 1.7 }}>
Radio<EX color={C.accent} size={18} />perience não é um software. É um <strong style={{ color: C.text }}>movimento.</strong>
</p>
</div>

    <div style={{ ...a(0.25), textAlign: "center", padding: "40px 48px", borderRadius: 24, marginBottom: 48, background: "linear-gradient(135deg, rgba(221,255,85,0.04), rgba(192,214,234,0.03))", border: "1px solid rgba(221,255,85,0.15)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(30px) saturate(1.5)", WebkitBackdropFilter: "blur(30px) saturate(1.5)" }} />
      <div style={{ position: "relative" }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16 }}>Manifesto <EX color={C.accent} size={13} /></p>
        <p style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1.5, maxWidth: 650, margin: "0 auto 16px" }}>
          "Nós acreditamos que o radiologista brasileiro merece mais do que pagar para aprender.
          <br /><span style={{ color: C.accent }}>Merece ser sócio do que constrói.</span>"
        </p>
      </div>
    </div>

    <div style={{ ...a(0.3), textAlign: "center", marginBottom: 48 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 36px", borderRadius: 100, background: C.glass, border: `1px solid ${C.glassBorder}`, backdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex" }}>{["#DDFF55", "#7ecbff", "#5ef0b0", "#ff7eb3", "#ffb347"].map((c, i) => (<div key={i} style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${c}40, ${c}20)`, border: `2px solid ${C.bgDeep}`, marginLeft: i > 0 ? -10 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: c, position: "relative", zIndex: 5 - i }}>{["R", "F", "M", "A", "J"][i]}</div>))}</div>
        <div style={{ textAlign: "left" }}><div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{members}+ radiologistas</div><div style={{ fontSize: 12, color: C.textDim }}>já pediram acesso à comunidade <EX color={C.textDim} size={12} /></div></div>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, ...a(0.35) }}>
      {values.map((v, i) => (<div key={i} style={{ borderRadius: 20, padding: 24, background: C.glass, backdropFilter: "blur(20px) saturate(1.4)", border: `1px solid ${C.glassBorder}` }}><div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} /><div style={{ fontSize: 28, marginBottom: 10 }}>{v.icon}</div><div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>{v.title}</div><p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65, margin: 0 }}>{v.desc}</p></div>))}
    </div>
  </div>
</section>

);
}

// ─── Pricing ───
function PriceCard({ plan, index, inView }) {
const [hov, setHov] = useState(false);
return (
<div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: plan.popular ? "2px" : 0, background: plan.popular ? `linear-gradient(160deg, ${C.accent}50, transparent 50%, ${C.accent}20)` : "transparent", opacity: inView ? 1 : 0, animation: inView ? `fadeUp 0.6s ease ${index * 0.1}s forwards` : "none" }}>
<div style={{ borderRadius: plan.popular ? 18 : 20, padding: 28, background: plan.popular ? "rgba(0,26,43,0.95)" : C.glass, backdropFilter: plan.popular ? "blur(20px)" : "blur(16px) saturate(1.2)", border: plan.popular ? "none" : `1px solid ${C.glassBorder}`, transition: "all 0.4s", transform: hov ? "translateY(-4px)" : "translateY(0)", boxShadow: plan.popular ? `0 20px 60px rgba(221,255,85,0.1)` : hov ? "0 16px 48px rgba(0,0,0,0.3)" : "none", height: "100%", display: "flex", flexDirection: "column" }}>
{plan.popular && (<div style={{ position: "absolute", top: 18, right: 18, padding: "4px 12px", borderRadius: 100, background: C.accent, color: C.bgDeep, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Popular</div>)}
<div style={{ marginBottom: 10 }}><PillarName name={plan.name} color={plan.color} size={15} /></div>
<div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 6 }}><span style={{ fontSize: 38, fontWeight: 800, color: C.text, letterSpacing: "-0.04em" }}>{plan.price}</span>{plan.period && <span style={{ fontSize: 13, color: C.textDim }}>{plan.period}</span>}</div>
<p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 22px" }}>{plan.description}</p>
<div style={{ width: "100%", height: 1, background: C.glassBorder, margin: "0 0 22px" }} />
<div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 28, flex: 1 }}>
{plan.features.map((f, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke={f.includes("lucros") ? C.pEmbaixador : plan.popular ? C.accent : C.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><span style={{ fontSize: 13, color: f.includes("lucros") ? C.pEmbaixador : C.textMuted, fontWeight: f.includes("lucros") ? 600 : 400 }}>{f}</span></div>))}
</div>
<button style={{ width: "100%", padding: "13px 24px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", color: plan.popular ? C.bgDeep : C.textSoft, background: plan.popular ? C.accent : "transparent", border: plan.popular ? "none" : `1px solid ${C.glassBorder}`, boxShadow: plan.popular ? `0 0 24px ${C.accentGlow}` : "none" }}>{plan.cta}</button>
</div>
</div>
);
}
function Pricing() {
const [ref, inView] = useInView(0.08);
return (
<section id="pricing" ref={ref} style={{ padding: "100px 24px 60px", position: "relative", zIndex: 1 }}>
<div style={{ maxWidth: 1440, margin: "0 auto" }}>
<div style={{ textAlign: "center", marginBottom: 60 }}>
<div style={{ display: "inline-block", padding: "5px 16px", borderRadius: 100, background: `${C.pAnalytics}15`, border: `1px solid ${C.pAnalytics}25`, fontSize: 11, fontWeight: 700, color: C.pAnalytics, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>Planos</div>
<h2 style={{ fontSize: "clamp(28px, 4vw, 50px)", fontWeight: 800, color: C.text, letterSpacing: "-0.035em", margin: "0 0 16px" }}>Escolha seu nível <EX color={C.accent} size={50} /></h2>
<p style={{ fontSize: 16, color: C.textMuted, maxWidth: 520, margin: "0 auto", lineHeight: 1.65 }}>Comece gratuitamente. <strong style={{ color: C.accent }}>Assinantes engajados participam dos lucros.</strong></p>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "stretch" }}>
{PLANS.map((p, i) => <PriceCard key={p.name} plan={p} index={i} inView={inView} />)}
</div>
</div>
</section>
);
}

// ─── Embaixadores ───
function Embaixadores() {
const [ref, inView] = useInView(0.1);
const a = (d) => ({ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(28px)", transition: `all 0.8s cubic-bezier(.4,0,.2,1) ${d}s` });
const benefits = [
{ icon: "🚀", title: "Renda Recorrente", desc: "Indicações geram comissão recorrente. Sem teto." },
{ icon: "🎯", title: "Kit Exclusivo", desc: "Materiais, link personalizado e dashboard em tempo real." },
{ icon: "👑", title: "Status de Embaixador", desc: "Selo verificado, acesso antecipado e eventos exclusivos." },
{ icon: "🌐", title: "Rede de Influência", desc: "Conecte-se aos mais engajados do país." },
];
return (
<section id="embaixadores" ref={ref} style={{ padding: "120px 24px", position: "relative", zIndex: 1 }}>
<div style={{ maxWidth: 1440, margin: "0 auto" }}>
<div style={{ textAlign: "center", marginBottom: 56 }}>
<div style={{ ...a(0), display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 18px", borderRadius: 100, background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)", marginBottom: 24 }}><span style={{ fontSize: 16 }}>⭐</span><span style={{ fontSize: 12, fontWeight: 700, color: C.pEmbaixador, textTransform: "uppercase", letterSpacing: "0.1em" }}>Programa Embaixador</span></div>
<h2 style={{ ...a(0.1), fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 800, color: C.text, letterSpacing: "-0.04em", margin: "0 0 20px" }}><EX color={C.pEmbaixador} size={52} />{" "}<span style={{ background: `linear-gradient(135deg, ${C.pEmbaixador}, #ffed4a, ${C.pEmbaixador})`, backgroundSize: "200% 200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "gradientShift 5s ease infinite" }}>Embaixadores</span></h2>
<p style={{ ...a(0.15), fontSize: 18, color: C.textMuted, maxWidth: 600, margin: "0 auto", lineHeight: 1.7 }}>
Indique colegas. Eles evoluem. Você é recompensado.<br /><strong style={{ color: C.pEmbaixador }}>É simples assim.</strong>
</p>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18, marginBottom: 48, ...a(0.25) }}>
{benefits.map((b, i) => (<div key={i} style={{ borderRadius: 20, padding: 28, background: C.glass, backdropFilter: "blur(20px)", border: `1px solid ${C.glassBorder}` }}><div style={{ fontSize: 32, marginBottom: 12 }}>{b.icon}</div><div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>{b.title}</div><p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>{b.desc}</p></div>))}
</div>
<div style={{ ...a(0.35), textAlign: "center", padding: "32px 40px", borderRadius: 20, background: "linear-gradient(135deg, rgba(255,215,0,0.06), rgba(221,255,85,0.04))", border: "1px solid rgba(255,215,0,0.2)" }}>
<p style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 12px" }}>"Médicos não vendem. Médicos <span style={{ color: C.pEmbaixador }}>recomendam.</span>"</p>
<p style={{ fontSize: 13, color: C.textDim, fontStyle: "italic", marginTop: 12 }}>Vagas limitadas para a primeira turma de Embaixadores <EX color={C.textDim} size={13} />.</p>
</div>
<div style={{ ...a(0.45), textAlign: "center", marginTop: 40 }}>
<button style={{ padding: "16px 40px", borderRadius: 14, fontSize: 17, fontWeight: 700, color: C.bgDeep, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.pEmbaixador}, #ffed4a)`, boxShadow: "0 0 50px rgba(255,215,0,0.15), 0 4px 30px rgba(0,0,0,0.3)" }}>Quero Ser Embaixador →</button>
</div>
</div>
</section>
);
}

// ─── Footer ───
function Footer() {
return (
<footer style={{ borderTop: `1px solid ${C.border}`, padding: "44px 24px", marginTop: 20, position: "relative", zIndex: 1 }}>
<div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
<div><Logo size={14} /><p style={{ fontSize: 12, color: C.textDim, margin: "8px 0 0" }}>Feito por radiologistas, para radiologistas. Rio de Janeiro.</p></div>
<div style={{ display: "flex", gap: 28 }}>{["Termos", "Privacidade", "LGPD", "Contato"].map(l => (<a key={l} href="#" style={{ fontSize: 12, color: C.textDim, textDecoration: "none" }}>{l}</a>))}</div>
</div>
</footer>
);
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
function LandingPage() {
const [sec, setSec] = useState("hero");
const { user } = useAuth();
const navigate = useNavigate();
useEffect(() => {
const ids = ["hero", "pillars", "community", "pricing", "embaixadores"];
const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setSec(e.target.id); }), { threshold: 0.2 });
ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
return () => obs.disconnect();
}, []);

const handleFeed = () => {
  if (user) navigate('/feed')
  else navigate('/login')
}

return (
<div style={{ position: "relative", background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", overflowX: "hidden" }}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}body{background:${C.bg}} @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}} @keyframes gradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}} @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}} @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-40px)}} @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,30px)}} @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,25px)}} button:hover{filter:brightness(1.08)}a:hover{color:${C.accent}!important} ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px} @media(max-width:960px){ #pillars>div>div{grid-template-columns:repeat(2,1fr)!important;max-width:100%!important} #pricing>div>div:nth-of-type(2){grid-template-columns:repeat(2,1fr)!important} #community>div>div:last-child{grid-template-columns:repeat(2,1fr)!important} } @media(max-width:640px){ .hero-section{min-height:auto!important;padding:88px 18px 36px!important;justify-content:flex-start!important} .hero-badge{margin-bottom:22px!important;transform:scale(.96)} .hero-title-wrap{margin-bottom:18px!important} .hero-title{font-size:clamp(30px,12vw,52px)!important;line-height:1.02!important;max-width:340px!important} .hero-copy{font-size:15px!important;line-height:1.5!important;max-width:330px!important;margin:0 0 12px!important} .hero-welcome{margin-bottom:24px!important;font-size:14px!important} .hero-cta-row{gap:10px!important;margin-bottom:28px!important} .hero-cta-row button{width:100%;max-width:320px;padding:14px 20px!important;font-size:15px!important} .hero-stats{width:100%!important;max-width:340px!important;display:grid!important;grid-template-columns:1fr!important} .hero-stats>div{padding:14px 18px!important;border-right:none!important;border-bottom:1px solid ${C.glassBorder}!important} .hero-stats>div:last-child{border-bottom:none!important} #pillars>div>div{grid-template-columns:1fr!important} #pricing>div>div:nth-of-type(2){grid-template-columns:1fr!important} #community>div>div:last-child{grid-template-columns:1fr!important} }`}</style>

  {/* ═══ BACKGROUND LAYERS ═══ */}
  {/* Layer 1: Animated neural network */}
  <NeuralBackground />

  {/* Layer 2: Floating gradient orbs with animation */}
  <FloatingOrbs />

  {/* Layer 3: Noise texture for depth */}
  <NoiseOverlay />

  {/* Layer 4: Subtle scan lines (radiology feel) */}
  <ScanLines />

  {/* Layer 5: Gradient overlay for section depth */}
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    background: `linear-gradient(180deg,
      rgba(0,26,43,0.3) 0%,
      rgba(0,34,51,0.5) 15%,
      rgba(0,26,43,0.4) 30%,
      rgba(0,34,51,0.6) 50%,
      rgba(0,26,43,0.3) 65%,
      rgba(0,34,51,0.5) 80%,
      rgba(0,26,43,0.4) 100%
    )`,
  }} />

  {/* ═══ CONTENT ═══ */}
  <div style={{ position: "relative", zIndex: 1 }}>
    <Navbar section={sec} />
    <Hero onFeed={handleFeed} user={user} />
    <Pillars />
    <Community />
    <Pricing />
    <Embaixadores />
    <Footer />
  </div>
</div>

);
}

function ProfileGate({ children }) {
  const { profileComplete, loading } = useAuth();
  if (loading) return null;
  if (!profileComplete) return <Navigate to="/profile-setup" replace />;
  return children;
}

function ProfileSetupGate() {
  const { profileComplete, loading } = useAuth();
  if (loading) return null;
  if (profileComplete) return <Navigate to="/dashboard" replace />;
  return <ProfileSetup />;
}

function FeedGate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter',sans-serif" }}>
        <div style={{ maxWidth: 520, width: '100%', borderRadius: 20, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 28, textAlign: 'center', backdropFilter: 'blur(18px)' }}>
          <div style={{ fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10 }}>Acesso necessário</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Faça login para acessar o Feed</h1>
          <p style={{ color: C.textMuted, marginBottom: 20 }}>Entre na sua conta para ver e publicar artigos da comunidade.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/login')} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: C.accent, color: C.bgDeep, fontWeight: 800, cursor: 'pointer' }}>Entrar</button>
            <button onClick={() => navigate('/signup')} style={{ padding: '12px 20px', borderRadius: 12, border: `1px solid ${C.glassBorder}`, background: 'transparent', color: C.textSoft, fontWeight: 700, cursor: 'pointer' }}>Criar conta</button>
          </div>
        </div>
      </div>
    );
  }

  return <Feed />;
}

function CanonicalHostGate({ children }) {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const pathname = window.location.pathname
    const isAuthCallback = pathname === '/auth/callback'
    const isOldDomain = host.includes('victorvignal.me')
    const isNewApex = host === 'radioexperience.com.br'
    const shouldRedirect = !isAuthCallback && (isOldDomain || isNewApex)

    if (shouldRedirect) {
      window.location.replace(`https://www.radioexperience.com.br${window.location.pathname}${window.location.search}${window.location.hash}`)
      return null
    }
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <CanonicalHostGate>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetupGate /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><ProfileGate><Dashboard /></ProfileGate></ProtectedRoute>} />
          <Route path="/vagas" element={<Vagas />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/admin/upload" element={<ProtectedRoute><AdminUpload /></ProtectedRoute>} />
          <Route path="/admin/article-upload" element={<ProtectedRoute><ArticleUpload /></ProtectedRoute>} />
          <Route path="/feed" element={<FeedGate />} />
          <Route path="/novo-artigo" element={<ProtectedRoute><NewPost /></ProtectedRoute>} />
          <Route path="/criar" element={<ProtectedRoute><Create /></ProtectedRoute>} />
          <Route path="/artigo/:id" element={<PostView />} />
          <Route path="/profile/:id" element={<UserProfile />} />
          <Route path="/aria" element={<ProtectedRoute><ProfileGate><AriaPage /></ProfileGate></ProtectedRoute>} />
          <Route path="/challenge" element={<ProtectedRoute><ProfileGate><ChallengePage /></ProfileGate></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
      </CanonicalHostGate>
    </BrowserRouter>
  );
}

export default App;
