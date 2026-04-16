import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#001a2b',
  bgDeep: '#002233',
  glass: 'rgba(192,214,234,0.07)',
  glassHover: 'rgba(192,214,234,0.13)',
  glassBorder: 'rgba(192,214,234,0.15)',
  border: 'rgba(192,214,234,0.1)',
  text: '#F6F2E8',
  textSoft: '#C0D6EA',
  textMuted: '#8ba8c4',
  textDim: '#5a7d9a',
  accent: '#DDFF55',
  accentGlow: 'rgba(221,255,85,0.15)',
  accentSoft: 'rgba(221,255,85,0.08)',
}

function Logo({ size = 17 }) {
  return (
    <Link to='/dashboard' style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }}>
      <div style={{
        width: size * 1.8, height: size * 1.8, borderRadius: size * 0.5,
        background: `linear-gradient(135deg, ${C.accent}, #b8ff33)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 20px ${C.accentGlow}`,
      }}>
        <span style={{
          fontWeight: 900, fontSize: size * 0.65, color: C.bgDeep,
          fontStyle: 'italic', letterSpacing: '-0.06em',
        }}>
          <span style={{ fontSize: size * 0.55 }}>e</span>
          <span style={{ fontSize: size * 0.75 }}>X</span>
        </span>
      </div>
      <span style={{
        fontFamily: "'Inter',sans-serif", fontSize: size, fontWeight: 700,
        letterSpacing: '-0.03em', color: C.text,
      }}>
        Radio<span style={{ color: C.accent, fontWeight: 800, fontStyle: 'italic' }}>e</span><span style={{ color: C.accent, fontWeight: 900 }}>X</span>perience
      </span>
    </Link>
  )
}

function getPostImageUrl(post) {
  if (!post?.metadata) return null
  const meta = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata
  return meta?.image_url || null
}

function getTemplateLabel(type) {
  const labels = {
    script: '📝 Script de Aula',
    slides: '📊 Slides',
    mapa_mental: '🧠 Mapa Mental',
    tabela: '📋 Tabela',
    questoes: '❓ Questões',
    caso_clinico: '🔬 Caso Clínico',
    article: '📄 Artigo',
    case: '🔬 Caso Clínico',
    review: '📚 Revisão',
    news: '📰 Notícias',
    post: '💬 Post',
    vaga: '💼 Vaga',
  }
  return labels[type] || '📄 ' + (type || 'Conteúdo')
}

function getTemplateColor(type) {
  const colors = {
    script: '#7ecbff',
    slides: '#7ecbff',
    mapa_mental: '#b388ff',
    tabela: '#ffd166',
    questoes: '#5ef0b0',
    caso_clinico: '#ff6b6b',
    article: '#7ecbff',
    case: '#ff6b6b',
    review: '#ffb347',
    news: '#ff7eb3',
    post: '#c5c0c9',
    vaga: '#ffd166',
  }
  return colors[type] || '#8ba8c4'
}

function ProjectCard({ project, onClick }) {
  const date = project.created_at
    ? new Date(project.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''
  const color = getTemplateColor(project.type)
  const label = getTemplateLabel(project.type)

  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(project.content || '').catch(() => {})
  }

  const handleExport = (e) => {
    e.stopPropagation()
    const blob = new Blob([project.content || ''], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(project.title || 'projeto').replace(/[^a-zA-Z0-9]/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: C.glass,
        border: `1px solid ${C.glassBorder}`,
        borderRadius: 16,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(16px)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = C.glassHover
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = C.glass
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 9, fontWeight: 700,
            color: color,
            background: `${color}15`,
            border: `1px solid ${color}30`,
            borderRadius: 4,
            padding: '2px 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 8,
          }}>
            {label}
          </div>
          <h3 style={{
            fontSize: 14, fontWeight: 700, color: C.textSoft,
            marginBottom: 6, lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {project.title || 'Sem título'}
          </h3>
          {project.content && (
            <p style={{
              fontSize: 12, color: C.textMuted, lineHeight: 1.5,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {project.content.replace(/<[^>]*>/g, '').substring(0, 160)}
            </p>
          )}
          {date && (
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>{date}</div>
          )}
        </div>
        {getPostImageUrl(project) && (
          <img
            src={getPostImageUrl(project)}
            alt=''
            style={{
              width: 72, height: 72, borderRadius: 10,
              objectFit: 'cover', flexShrink: 0,
              border: `1px solid ${C.glassBorder}`,
            }}
          />
        )}
      </div>
      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <button
          onClick={handleCopy}
          style={{
            background: 'rgba(126,203,255,0.06)',
            border: `1px solid rgba(126,203,255,0.18)`,
            borderRadius: 6,
            padding: '5px 10px',
            cursor: 'pointer',
            color: '#7ecbff',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar
        </button>
        <button
          onClick={handleExport}
          style={{
            background: 'rgba(221,255,85,0.06)',
            border: `1px solid rgba(221,255,85,0.18)`,
            borderRadius: 6,
            padding: '5px 10px',
            cursor: 'pointer',
            color: C.accent,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar
        </button>
        <button
          onClick={e => { e.stopPropagation(); onClick() }}
          style={{
            background: 'rgba(179,136,255,0.08)',
            border: `1px solid rgba(179,136,255,0.2)`,
            borderRadius: 6,
            padding: '5px 10px',
            cursor: 'pointer',
            color: '#b388ff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
      </div>
    </div>
  )
}

export default function MyProjects() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | study | posts
  const [search, setSearch] = useState('')

  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.id) { setLoading(false); return }
      setLoading(true)

      // Fetch user's posts from Supabase
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Fetch study projects (drafts saved in localStorage or a separate table)
      // For now, load from localStorage
      const savedProjects = JSON.parse(localStorage.getItem('studyProjects') || '[]')
        .filter(p => p.userId === user.id)

      const allProjects = [
        ...(postsData || []).map(p => ({ ...p, source: 'post' })),
        ...savedProjects.map(p => ({ ...p, source: 'study' })),
      ]

      setProjects(allProjects)
      setLoading(false)
    }
    loadProjects()
  }, [user?.id])

  const filtered = projects.filter(p => {
    // Filter by source
    if (filter === 'study' && p.source !== 'study') return false
    if (filter === 'posts' && p.source !== 'post') return false
    // Filter by search
    if (search.trim()) {
      const term = search.toLowerCase()
      const text = `${p.title || ''} ${p.content || ''}`.toLowerCase()
      if (!text.includes(term)) return false
    }
    return true
  })

  const studyProjects = projects.filter(p => p.source === 'study')
  const postProjects = projects.filter(p => p.source === 'post')

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.bg, color: C.text,
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      overflow: 'auto',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-40px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,30px)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,25px)}}
      `}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(0,26,43,0.92)', backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'transparent', border: `1px solid ${C.glassBorder}`,
            borderRadius: 8, padding: '5px 10px',
            color: C.textMuted, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Voltar
        </button>
        <div style={{ flex: 1 }}>
          <Logo size={15} />
        </div>
        <button
          onClick={() => navigate('/criar')}
          style={{
            background: C.accent, border: 'none',
            borderRadius: 8, padding: '8px 16px',
            color: C.bgDeep, fontSize: 12, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          + Novo Projeto
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', marginBottom: 6 }}>
            Meus Projetos
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted }}>
            Todos os seus projetos criados no StudyLabs e posts da comunidade.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: projects.length, color: C.accent },
            { label: 'StudyLabs', value: studyProjects.length, color: '#7ecbff' },
            { label: 'Posts', value: postProjects.length, color: '#5ef0b0' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: C.glass, border: `1px solid ${C.glassBorder}`,
              borderRadius: 12, padding: '12px 20px',
              backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { v: 'all', l: 'Todos' },
              { v: 'study', l: '📝 StudyLabs' },
              { v: 'posts', l: '💬 Posts' },
            ].map(f => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                style={{
                  padding: '6px 14px', borderRadius: 8,
                  border: filter === f.v ? `1px solid rgba(221,255,85,0.3)` : `1px solid ${C.glassBorder}`,
                  background: filter === f.v ? C.accentSoft : 'transparent',
                  color: filter === f.v ? C.accent : C.textMuted,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {f.l}
              </button>
            ))}
          </div>
          <input
            type='text'
            placeholder='Buscar projeto...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 200,
              background: 'rgba(0,26,43,0.5)', border: `1px solid ${C.glassBorder}`,
              borderRadius: 8, padding: '8px 14px',
              color: C.text, fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textDim, fontSize: 14 }}>
            Carregando projetos...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ color: C.textMuted, fontSize: 14 }}>
              {filter === 'all' ? 'Nenhum projeto ainda.' : `Nenhum projeto ${filter === 'study' ? 'do StudyLabs' : 'de post'}.`}
            </p>
            <button
              onClick={() => navigate('/criar')}
              style={{
                marginTop: 16,
                padding: '10px 20px', borderRadius: 10,
                background: C.accent, border: 'none',
                color: C.bgDeep, fontSize: 13, fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Criar primeiro projeto
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {filtered.map(project => (
              <ProjectCard
                key={project.id || project.localId}
                project={project}
                onClick={() => {
                  if (project.source === 'study') {
                    navigate('/criar', { state: { project } })
                  } else {
                    navigate(`/artigo/${project.id}`)
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
