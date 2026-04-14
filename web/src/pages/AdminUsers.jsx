import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const C = {
  bg: '#001a2b', bgDeep: '#002233',
  glass: 'rgba(192,214,234,0.07)', glassHover: 'rgba(192,214,234,0.13)',
  glassBorder: 'rgba(192,214,234,0.15)', border: 'rgba(192,214,234,0.1)',
  text: '#F6F2E8', textSoft: '#C0D6EA', textMuted: '#8ba8c4', textDim: '#5a7d9a',
  accent: '#DDFF55', accentGlow: 'rgba(221,255,85,0.15)', accentSoft: 'rgba(221,255,85,0.08)',
  green: '#5ef0b0', red: '#ff6b6b', blue: '#7ecbff', orange: '#ffb347',
  pink: '#ff7eb3',
}

const TYPE_LABELS = {
  article: { label: 'Artigo', color: '#7ecbff' },
  case: { label: 'Caso Clínico', color: '#5ef0b0' },
  review: { label: 'Revisão', color: '#ffb347' },
  news: { label: 'Notícia', color: '#ff7eb3' },
  post: { label: 'Post', color: '#c5c0c9' },
  vaga: { label: 'Vaga', color: '#ffd166' },
}

const ROLE_COLORS = {
  admin: '#ff6b6b',
  staff: '#ffb347',
  user: '#8ba8c4',
}

function StatCard({ label, value, sub, color = C.accent, icon }) {
  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${C.glassBorder}`,
      background: C.glass, backdropFilter: 'blur(20px)',
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ title, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14, flexWrap: 'wrap', gap: 8,
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.textSoft }}>{title}</h2>
      {action}
    </div>
  )
}

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || ROLE_COLORS.user
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
      padding: '2px 8px', borderRadius: 999,
      background: `${color}18`, border: `1px solid ${color}35`,
      color,
    }}>{role || 'user'}</span>
  )
}

function AvatarOrInitials({ url, name, size = 34 }) {
  const initials = (name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return url ? (
    <img src={url} alt={name} style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', border: `1px solid ${C.border}` }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: C.accentSoft, color: C.accent,
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.35, fontWeight: 800, flexShrink: 0,
      border: `1px solid ${C.glassBorder}`,
    }}>{initials}</div>
  )
}

function TypeBar({ type, count, max, total }) {
  const info = TYPE_LABELS[type] || { label: type, color: C.textDim }
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: info.color, fontWeight: 700 }}>{info.label}</span>
        <span style={{ fontSize: 11, color: C.textDim }}>{count} <span style={{ color: C.textDim, opacity: 0.6 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(192,214,234,0.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999, background: info.color,
          width: `${pct}%`, transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const { userRole, user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  // Data states
  const [profiles, setProfiles] = useState([])
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState([])
  const [shifts, setShifts] = useState([])

  // Filter/search states
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [activeTab, setActiveTab] = useState('overview') // overview | users | content | activity

  const isAdmin = userRole === 'admin'

  useEffect(() => {
    if (userRole && !isAdmin) return
    loadAll()
  }, [userRole])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [p, ps, c, s] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('posts').select('id, type, created_at, user_id, title'),
        supabase.from('comments').select('id, created_at, user_id'),
        supabase.from('shifts').select('id'),
      ])
      setProfiles(p.data || [])
      setPosts(ps.data || [])
      setComments(c.data || [])
      setShifts(s.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Computed analytics ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now - 7 * 86400000)
    const monthAgo = new Date(now - 30 * 86400000)
    const postsThisWeek = posts.filter(p => new Date(p.created_at) > weekAgo)
    const commentsThisMonth = comments.filter(c => new Date(c.created_at) > monthAgo)

    // Users who posted or commented this month
    const activeUserIds = new Set([
      ...postsThisWeek.map(p => p.user_id),
      ...comments.filter(c => new Date(c.created_at) > monthAgo).map(c => c.user_id),
    ])

    // New users this week
    const newUsers = profiles.filter(p => new Date(p.created_at) > weekAgo)

    // Posts by type
    const postsByType = {}
    posts.forEach(p => {
      postsByType[p.type || 'post'] = (postsByType[p.type || 'post'] || 0) + 1
    })

    // Post count per user
    const postCountByUser = {}
    posts.forEach(p => {
      if (p.user_id) postCountByUser[p.user_id] = (postCountByUser[p.user_id] || 0) + 1
    })

    // Comment count per user
    const commentCountByUser = {}
    comments.forEach(c => {
      if (c.user_id) commentCountByUser[c.user_id] = (commentCountByUser[c.user_id] || 0) + 1
    })

    // Top contributors
    const topPosters = Object.entries(postCountByUser)
      .map(([uid, count]) => {
        const profile = profiles.find(p => p.id === uid)
        return { uid, count, profile }
      })
      .filter(u => u.profile)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const topCommenters = Object.entries(commentCountByUser)
      .map(([uid, count]) => {
        const profile = profiles.find(p => p.id === uid)
        return { uid, count, profile }
      })
      .filter(u => u.profile)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Daily posts (last 30 days)
    const dailyPosts = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      dailyPosts[key] = 0
    }
    posts.forEach(p => {
      const d = new Date(p.created_at)
      const daysDiff = Math.floor((now - d) / 86400000)
      if (daysDiff < 30) {
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        if (dailyPosts[key] !== undefined) dailyPosts[key]++
      }
    })

    // Daily new users
    const dailyUsers = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      dailyUsers[key] = 0
    }
    profiles.forEach(p => {
      const d = new Date(p.created_at)
      const daysDiff = Math.floor((now - d) / 86400000)
      if (daysDiff < 30) {
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        if (dailyUsers[key] !== undefined) dailyUsers[key]++
      }
    })

    return {
      totalUsers: profiles.length,
      newUsersWeek: newUsers.length,
      newUsersWeekPct: profiles.length > 0 ? Math.round((newUsers.length / profiles.length) * 100) : 0,
      totalPosts: posts.length,
      postsThisWeek: postsThisWeek.length,
      totalComments: comments.length,
      commentsThisMonth: commentsThisMonth.length,
      activeUsers: activeUserIds.size,
      postsByType,
      topPosters,
      topCommenters,
      dailyPosts,
      dailyUsers,
      postCountByUser,
      commentCountByUser,
    }
  }, [profiles, posts, comments])

  // ── Filtered user list ──────────────────────────────────────────────────────
  const filteredProfiles = useMemo(() => {
    let list = [...profiles]
    if (roleFilter !== 'all') list = list.filter(p => (p.role || 'user') === roleFilter)
    if (search.trim()) {
      const term = search.toLowerCase()
      list = list.filter(p => {
        const name = p.full_name || ''
        const email = p.email || ''
        const specialty = p.specialty || ''
        return name.toLowerCase().includes(term) || email.toLowerCase().includes(term) || specialty.toLowerCase().includes(term)
      })
    }
    if (sortBy === 'recent') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    else if (sortBy === 'posts') list.sort((a, b) => (stats.postCountByUser[b.id] || 0) - (stats.postCountByUser[a.id] || 0))
    else if (sortBy === 'name') list.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
    return list
  }, [profiles, search, roleFilter, sortBy, stats])

  // ── Recent activity ─────────────────────────────────────────────────────────
  const recentActivity = useMemo(() => {
    const items = []
    profiles.slice(0, 8).forEach(p => items.push({ type: 'user', date: p.created_at, data: p }))
    posts.slice(0, 8).forEach(p => items.push({ type: 'post', date: p.created_at, data: p }))
    comments.slice(0, 8).forEach(c => items.push({ type: 'comment', date: c.created_at, data: c }))
    return items.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20)
  }, [profiles, posts, comments])

  const formatDate = (d) => {
    if (!d) return ''
    const date = new Date(d)
    const now = new Date()
    const diffH = Math.floor((now - date) / 3600000)
    if (diffH < 1) return 'agora'
    if (diffH < 24) return `${diffH}h atrás`
    if (diffH < 168) return `${Math.floor(diffH / 24)}d atrás`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const formatFullDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const maxDailyPosts = Math.max(...Object.values(stats.dailyPosts), 1)
  const maxDailyUsers = Math.max(...Object.values(stats.dailyUsers), 1)

  if (userRole && !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Acesso negado</h1>
          <p style={{ color: C.textMuted }}>Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .skeleton{background:linear-gradient(90deg, ${C.glass} 25%, ${C.glassHover} 50%, ${C.glass} 75%);background-size:800px 100%;animation:shimmer 1.5s infinite}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
        @media(max-width:768px){.admin-grid{grid-template-columns:1fr!important}.admin-tabs{flex-wrap:wrap!important}}
      `}</style>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(0,26,43,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`, padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <Link to='/dashboard' style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted, textDecoration: 'none', fontSize: 13 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L5 6.5L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </Link>
        <span style={{ color: C.textDim, fontSize: 12 }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>Admin · Usuários</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textDim }}>{loading ? '...' : `${profiles.length} usuários`}</span>
          <button
            onClick={loadAll}
            disabled={loading}
            style={{
              padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.glassBorder}`,
              background: 'transparent', color: C.textSoft, fontSize: 11, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >↻ Atualizar</button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="admin-tabs" style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
          {[
            { id: 'overview', label: 'Visão Geral', icon: '📊' },
            { id: 'users', label: 'Usuários', icon: '👥' },
            { id: 'content', label: 'Conteúdo', icon: '📝' },
            { id: 'activity', label: 'Atividade', icon: '⚡' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px', borderRadius: '10px 10px 0 0',
                border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent',
                background: activeTab === tab.id ? C.glass : 'transparent',
                color: activeTab === tab.id ? C.accent : C.textMuted,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.2s ease' }}>

            {/* Top stats */}
            <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="Total de Usuários" value={stats.totalUsers} sub={`+${stats.newUsersWeek} esta semana`} color={C.accent} icon="👥" />
              <StatCard label="Total de Posts" value={stats.totalPosts} sub={`${stats.postsThisWeek} esta semana`} color={C.blue} icon="📝" />
              <StatCard label="Comentários" value={stats.totalComments} sub={`${stats.commentsThisMonth} este mês`} color={C.green} icon="💬" />
            </div>
            <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="Usuários Ativos" value={stats.activeUsers} sub="postaram/comentaram recentemente" color={C.orange} icon="🔥" />
              <StatCard label="Escalas Cadastradas" value={shifts.length} sub="registros de escala" color={C.pink} icon="📅" />
              <StatCard label=" Novos (7 dias)" value={stats.newUsersWeek} sub={`${stats.newUsersWeekPct}% do total`} color={C.green} icon="🆕" />
            </div>

            {/* Content breakdown + role breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 20 }}>
                <SectionHeader title="Posts por Tipo" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(stats.postsByType).length === 0 && (
                    <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: '20px 0' }}>Sem dados ainda.</div>
                  )}
                  {Object.entries(stats.postsByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <TypeBar key={type} type={type} count={count} total={stats.totalPosts} />
                    ))}
                </div>
              </div>

              <div style={{ borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 20 }}>
                <SectionHeader title="Usuários por Função" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['admin', 'staff', 'user'].map(role => {
                    const count = profiles.filter(p => (p.role || 'user') === role).length
                    const total = profiles.length
                    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0
                    return (
                      <div key={role} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: ROLE_COLORS[role], fontWeight: 700 }}>{role === 'admin' ? 'Administrador' : role === 'staff' ? 'Staff' : 'Usuário'}</span>
                          <span style={{ fontSize: 11, color: C.textDim }}>{count} <span style={{ opacity: 0.6 }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'rgba(192,214,234,0.08)' }}>
                          <div style={{ height: '100%', borderRadius: 999, background: ROLE_COLORS[role], width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Top contributors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 20 }}>
                <SectionHeader title="Top Postadores" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.topPosters.length === 0 && <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: '20px 0' }}>Sem dados ainda.</div>}
                  {stats.topPosters.map((u, i) => (
                    <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: C.textDim, width: 16, textAlign: 'center', flexShrink: 0 }}>#{i + 1}</span>
                      <AvatarOrInitials url={u.profile?.avatar_url} name={u.profile?.full_name} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.profile?.full_name || '—'}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>{u.profile?.specialty || u.profile?.email?.split('@')[0]}</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.accent, flexShrink: 0 }}>{u.count} posts</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 20 }}>
                <SectionHeader title="Top Commentadores" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.topCommenters.length === 0 && <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: '20px 0' }}>Sem dados ainda.</div>}
                  {stats.topCommenters.map((u, i) => (
                    <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: C.textDim, width: 16, textAlign: 'center', flexShrink: 0 }}>#{i + 1}</span>
                      <AvatarOrInitials url={u.profile?.avatar_url} name={u.profile?.full_name} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.profile?.full_name || '—'}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>{u.profile?.specialty || u.profile?.email?.split('@')[0]}</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.green, flexShrink: 0 }}>{u.count} comentários</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: USERS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou especialidade..."
                style={{
                  flex: 1, minWidth: 200, borderRadius: 10, border: `1px solid ${C.glassBorder}`,
                  background: 'rgba(0,26,43,0.6)', color: C.text, padding: '9px 12px',
                  fontSize: 12, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{
                borderRadius: 10, border: `1px solid ${C.glassBorder}`,
                background: 'rgba(0,26,43,0.6)', color: C.text, padding: '9px 12px',
                fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <option value="all">Todas funções</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="user">Usuário</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                borderRadius: 10, border: `1px solid ${C.glassBorder}`,
                background: 'rgba(0,26,43,0.6)', color: C.text, padding: '9px 12px',
                fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <option value="recent">Mais recentes</option>
                <option value="posts">Mais posts</option>
                <option value="name">Nome A→Z</option>
              </select>
              <span style={{ fontSize: 11, color: C.textDim }}>
                {filteredProfiles.length} usuário{filteredProfiles.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* User table */}
            <div style={{
              borderRadius: 16, border: `1px solid ${C.glassBorder}`,
              background: C.glass, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr 1.5fr',
                padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
                gap: 8,
              }}>
                {['Usuário', 'Email', 'Especialidade', 'Função', 'Posts', 'Cadastro'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 800, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr 1.5fr', padding: '12px 16px', gap: 8, alignItems: 'center', borderBottom: `1px solid ${C.wipBorder}` }}>
                    {[160, 180, 100, 60, 40, 80].map((w, j) => (
                      <div key={j} className="skeleton" style={{ height: 14, borderRadius: 4 }} />
                    ))}
                  </div>
                ))
              ) : filteredProfiles.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>Nenhum usuário encontrado.</div>
              ) : (
                filteredProfiles.map(profile => {
                  const postCount = stats.postCountByUser[profile.id] || 0
                  const commentCount = stats.commentCountByUser[profile.id] || 0
                  return (
                    <div
                      key={profile.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr 1.5fr',
                        padding: '12px 16px', gap: 8, alignItems: 'center',
                        borderBottom: `1px solid ${C.border}`,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.glassHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* User */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <AvatarOrInitials url={profile.avatar_url} name={profile.full_name} size={30} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name || '—'}</div>
                          <div style={{ fontSize: 10, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commentCount} comentários</div>
                        </div>
                      </div>
                      {/* Email */}
                      <div style={{ fontSize: 11, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email || '—'}</div>
                      {/* Specialty */}
                      <div style={{ fontSize: 11, color: C.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.specialty || '—'}</div>
                      {/* Role */}
                      <div><RoleBadge role={profile.role} /></div>
                      {/* Posts */}
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{postCount}</div>
                      {/* Date */}
                      <div style={{ fontSize: 11, color: C.textDim }}>{formatFullDate(profile.created_at)}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: CONTENT
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.2s ease' }}>

            {/* Post timeline */}
            <div style={{ borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 20 }}>
              <SectionHeader title="Publicações dos Últimos 30 Dias" />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
                {Object.entries(stats.dailyPosts).map(([day, count]) => (
                  <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <div style={{
                      width: '100%', borderRadius: 3, background: C.accent,
                      height: `${Math.max((count / maxDailyPosts) * 70, count > 0 ? 4 : 0)}px`,
                      transition: 'height 0.3s ease', maxHeight: 70,
                      opacity: count > 0 ? 0.8 : 0.15,
                    }} title={`${day}: ${count} posts`} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 9, color: C.textDim }}>30 dias atrás</span>
                <span style={{ fontSize: 9, color: C.textDim }}>Hoje</span>
              </div>
            </div>

            {/* User registrations timeline */}
            <div style={{ borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 20 }}>
              <SectionHeader title="Novos Cadastros nos Últimos 30 Dias" />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                {Object.entries(stats.dailyUsers).map(([day, count]) => (
                  <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <div style={{
                      width: '100%', borderRadius: 3, background: C.green,
                      height: `${Math.max((count / maxDailyUsers) * 50, count > 0 ? 4 : 0)}px`,
                      transition: 'height 0.3s ease', maxHeight: 50,
                      opacity: count > 0 ? 0.8 : 0.15,
                    }} title={`${day}: ${count} usuários`} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 9, color: C.textDim }}>30 dias atrás</span>
                <span style={{ fontSize: 9, color: C.textDim }}>Hoje</span>
              </div>
            </div>

            {/* Full type breakdown */}
            <div style={{ borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 20 }}>
              <SectionHeader title="Distribuição de Posts por Tipo" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {Object.entries(stats.postsByType).length === 0 && (
                  <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: 20, gridColumn: '1/-1' }}>Sem posts ainda.</div>
                )}
                {Object.entries(stats.postsByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const info = TYPE_LABELS[type] || { label: type, color: C.textDim }
                    const pct = stats.totalPosts > 0 ? ((count / stats.totalPosts) * 100).toFixed(1) : 0
                    return (
                      <div key={type} style={{ borderRadius: 12, background: 'rgba(0,26,43,0.4)', border: `1px solid ${C.glassBorder}`, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: info.color }}>{info.label}</span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: info.color }}>{count}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 999, background: 'rgba(192,214,234,0.08)' }}>
                          <div style={{ height: '100%', borderRadius: 999, background: info.color, width: `${pct}%` }} />
                        </div>
                        <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{pct}% do total de posts</div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: ACTIVITY
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'activity' && (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            <div style={{ borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.glass, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
                <SectionHeader title="Atividade Recente" />
              </div>
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {recentActivity.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px', borderBottom: i < recentActivity.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    {/* Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      background: item.type === 'user' ? C.accentSoft : item.type === 'post' ? C.blue + '18' : C.green + '18',
                      border: `1px solid ${item.type === 'user' ? C.accent + '30' : item.type === 'post' ? C.blue + '30' : C.green + '30'}`,
                    }}>
                      <span style={{ fontSize: 14 }}>
                        {item.type === 'user' ? '👤' : item.type === 'post' ? '📝' : '💬'}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.type === 'user' && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft }}>
                            {item.data.full_name || 'Usuário sem nome'} <span style={{ color: C.textDim, fontWeight: 400 }}>se cadastrou</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{item.data.email} · {item.data.specialty || 'sem especialidade'}</div>
                        </>
                      )}
                      {item.type === 'post' && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft }}>
                            Novo post: <span style={{ color: C.blue }}>{item.data.title || 'Sem título'}</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                            {item.data.type && TYPE_LABELS[item.data.type] ? TYPE_LABELS[item.data.type].label : 'Post'} · por {profiles.find(p => p.id === item.data.user_id)?.full_name || 'Usuário desconhecido'}
                          </div>
                        </>
                      )}
                      {item.type === 'comment' && (
                        <div style={{ fontSize: 12, color: C.textDim }}>
                          Um comentário foi adicionado
                        </div>
                      )}
                    </div>

                    {/* Time */}
                    <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0, marginTop: 2 }}>{formatDate(item.date)}</span>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>Nenhuma atividade ainda.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
