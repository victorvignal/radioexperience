import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { buildPostMetadata, getPostImageUrl, readImagePreview, uploadPostImage, validateImageFile } from '../lib/postImages'
import { getInitials } from '../lib/avatar'

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
  staffBorder: 'rgba(221,255,85,0.35)',
  red: '#ff6b6b',
  wip: 'rgba(192,214,234,0.03)',
  wipBorder: 'rgba(192,214,234,0.07)',
}

const TYPE_LABELS = {
  article: { label: 'Artigo', color: '#7ecbff' },
  case: { label: 'Caso Clínico', color: '#5ef0b0' },
  review: { label: 'Revisão', color: '#ffb347' },
  news: { label: 'Notícia', color: '#ff7eb3' },
  post: { label: 'Post', color: '#c5c0c9' },
  vaga: { label: 'Vaga', color: '#ffd166' },
}

const TYPE_OPTIONS = [
  { value: 'post', label: 'Post' },
  { value: 'article', label: 'Artigo' },
  { value: 'case', label: 'Caso Clínico' },
  { value: 'review', label: 'Revisão' },
  { value: 'news', label: 'Notícia' },
  { value: 'vaga', label: 'Vaga' },
]

const API_BASE = 'https://aria-backend-production-176b.up.railway.app'

const specialties = [
  'Abdome','Cabeça e Pescoço','Geral','Mama','Músculo Esquelético',
  'Neurorradiologia','Obstetrícia','Pediatria','Radiologia Intervencionista',
  'Tórax','Urgência','Vascular',
]

function EX({ color = C.accent, size = 16 }) {
  return (
    <span style={{ color, fontWeight: 800, fontStyle: 'italic' }}>
      <span style={{ fontSize: size * 0.85 }}>e</span>
      <span style={{ fontSize: size * 1.12, fontWeight: 900 }}>X</span>
    </span>
  )
}

function Logo({ size = 18, showIcon = true }) {
  return (
    <Link to='/' style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }}>
      {showIcon && (
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
      )}
      <span style={{
        fontFamily: "'Inter',sans-serif", fontSize: size, fontWeight: 700,
        letterSpacing: '-0.03em', color: C.text,
      }}>
        Radio<EX color={C.accent} size={size} />perience
      </span>
    </Link>
  )
}

function FloatingOrbs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[
        { top:'5%', left:'15%', w:500, h:500, color:'rgba(221,255,85,0.06)', anim:'float1 20s' },
        { top:'8%', right:'10%', w:400, h:400, color:'rgba(17,66,93,0.5)', anim:'float2 25s' },
        { top:'25%', left:'60%', w:300, h:300, color:'rgba(126,203,255,0.05)', anim:'float3 18s' },
        { top:'45%', left:'5%', w:600, h:400, color:'rgba(221,255,85,0.04)', anim:'float2 22s' },
        { top:'55%', right:'5%', w:500, h:500, color:'rgba(255,107,107,0.03)', anim:'float1 28s' },
        { top:'75%', left:'30%', w:500, h:500, color:'rgba(255,215,0,0.04)', anim:'float3 24s' },
      ].map((orb, i) => (
        <div key={i} style={{
          position:'absolute', top:orb.top, left:orb.left, right:orb.right,
          width:orb.w, height:orb.h, borderRadius:'50%',
          background:`radial-gradient(circle, ${orb.color} 0%, transparent 60%)`,
          filter:'blur(60px)', animation:`${orb.anim} ease-in-out infinite`,
        }} />
      ))}
    </div>
  )
}

function NoiseOverlay() {
  return (
    <div style={{
      position:'absolute', inset:0, pointerEvents:'none', opacity:0.03,
      backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      backgroundSize:'256px 256px',
    }} />
  )
}

function ScanLines() {
  return (
    <div style={{
      position:'absolute', inset:0, pointerEvents:'none', opacity:0.015,
      backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(192,214,234,0.5) 2px, rgba(192,214,234,0.5) 3px)',
      backgroundSize:'100% 4px',
    }} />
  )
}

function GlassModal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:40, display:'flex', alignItems:'center',
      justifyContent:'center', background:'rgba(0,26,43,0.65)', padding:20, backdropFilter:'blur(12px)',
      overflowY:'auto', WebkitOverflowScrolling:'touch',
    }}>
      <div style={{
        width:'100%', maxWidth:width, borderRadius:20, border:`1px solid ${C.glassBorder}`,
        background:'rgba(0,26,43,0.6)', padding:20, boxShadow:'0 20px 50px rgba(0,0,0,0.4)',
        backdropFilter:'blur(24px)', maxHeight:'90vh', overflowY:'auto',
      }}>
        <div style={{ marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{title}</div>
          <button onClick={onClose} style={{
            borderRadius:8, border:`1px solid ${C.glassBorder}`, background:'transparent',
            color:C.textMuted, padding:'6px 10px', fontSize:12, cursor:'pointer',
          }}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function EditPostModal({ post, onClose, onSaved }) {
  const [title, setTitle] = useState(post.title || '')
  const [content, setContent] = useState(post.content || '')
  const [type, setType] = useState(post.type || 'post')
  const [saving, setSaving] = useState(false)
  const [visibility, setVisibility] = useState(post.visibility || 'public')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(getPostImageUrl(post) || '')
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('Título é obrigatório.'); return }
    setSaving(true); setError('')
    try {
      let imageUrl = getPostImageUrl(post)
      if (imageFile) imageUrl = await uploadPostImage(imageFile, post.user_id)

      const updates = {
        title: title.trim(),
        content: content.trim(),
        type,
        visibility,
        metadata: buildPostMetadata(post.metadata, imageUrl),
      }

      const { error: updateError } = await supabase.from('posts').update(updates).eq('id', post.id)
      if (updateError) throw updateError
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'rgba(0,26,43,0.6)', border: `1px solid ${C.glassBorder}`,
    borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13,
    fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,10,20,0.75)', backdropFilter: 'blur(12px)', padding: 20,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 640, background: 'rgba(0,26,43,0.97)',
        border: `1px solid ${C.glassBorder}`, borderRadius: 20, overflowY: 'auto', maxHeight: '90vh',
        boxShadow: '0 0 60px rgba(0,0,0,0.5)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 800, color: C.textSoft, fontSize: 15 }}>Editar Publicação</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Título</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Tipo</div>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Conteúdo</div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Imagem</div>
            <input
              type='file'
              accept='image/jpeg,image/png,image/webp,image/gif'
              onChange={async (e) => {
                const file = e.target.files?.[0] || null
                try {
                  setError('')
                  validateImageFile(file)
                  setImageFile(file)
                  setImagePreview(file ? await readImagePreview(file) : getPostImageUrl(post) || '')
                } catch (err) {
                  setImageFile(null)
                  setImagePreview(getPostImageUrl(post) || '')
                  setError(err.message || 'Imagem inválida.')
                }
              }}
              style={inputStyle}
            />
            {!!imagePreview && <img src={imagePreview} alt='Prévia' style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, border: `1px solid ${C.glassBorder}`, marginTop: 10 }} />}
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

          {error && <div style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: 'transparent', color: C.textSoft, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: C.bgDeep, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeletePostModal({ post, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setDeleting(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/posts/${post.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro ao excluir')
      onDeleted()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,10,20,0.75)', backdropFilter: 'blur(12px)', padding: 20,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'rgba(0,26,43,0.97)',
        border: `1px solid rgba(255,107,107,0.3)`, borderRadius: 20, padding: 24,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🗑️</div>
        <h3 style={{ color: C.text, marginBottom: 8 }}>Excluir publicação?</h3>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
          A publicação <strong style={{ color: C.textSoft }}>&quot;{post.title}&quot;</strong> será removida permanentemente.
        </p>
        {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: 'transparent', color: C.textSoft, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleDelete} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#ff6b6b', color: '#fff', fontWeight: 800, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1, fontSize: 13 }}>{deleting ? 'Excluindo...' : 'Excluir'}</button>
        </div>
      </div>
    </div>
  )
}

function NewPostModal({ onClose, onCreated, userId }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState('post')
  const [saving, setSaving] = useState(false)
  const [visibility, setVisibility] = useState('public')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Título e conteúdo são obrigatórios.')
      return
    }
    setSaving(true)
    setError('')
    try {
      let imageUrl = null
      if (imageFile) imageUrl = await uploadPostImage(imageFile, userId)

      const { error: err } = await supabase.from('posts').insert({
        user_id: userId || null,
        title: title.trim(),
        content: content.trim(),
        type,
        status: 'published',
        is_agent: false,
        visibility,
        metadata: buildPostMetadata({}, imageUrl),
      })
      if (err) throw err
      onCreated()
      onClose()
    } catch (e) {
      console.error('Error creating post:', e)
      setError('Erro ao publicar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'rgba(0,26,43,0.6)', border: `1px solid ${C.glassBorder}`,
    borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13,
    fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,10,20,0.75)', backdropFilter: 'blur(12px)', padding: 20,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 640, background: 'rgba(0,26,43,0.97)',
        border: `1px solid ${C.glassBorder}`, borderRadius: 20, overflowY: 'auto', maxHeight: '90vh',
        boxShadow: '0 0 60px rgba(0,0,0,0.5)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 800, color: C.textSoft, fontSize: 15 }}>Novo Post</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Título</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Tipo</div>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Conteúdo</div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Imagem</div>
            <input
              type='file'
              accept='image/jpeg,image/png,image/webp,image/gif'
              onChange={async (e) => {
                const file = e.target.files?.[0] || null
                try {
                  setError('')
                  validateImageFile(file)
                  setImageFile(file)
                  setImagePreview(file ? await readImagePreview(file) : '')
                } catch (err) {
                  setImageFile(null)
                  setImagePreview('')
                  setError(err.message || 'Imagem inválida.')
                }
              }}
              style={inputStyle}
            />
            {!!imagePreview && <img src={imagePreview} alt='Prévia' style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, border: `1px solid ${C.glassBorder}`, marginTop: 10 }} />}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Visibilidade
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ v: 'public', l: 'Público', icon: '🌐' }, { v: 'private', l: 'Somente eu', icon: '🔒' }].map((opt) => (
                <button key={opt.v} type='button' onClick={() => setVisibility(opt.v)} style={{
                  padding: '8px 16px', borderRadius: 10,
                  border: `1px solid ${visibility === opt.v ? 'rgba(221,255,85,0.3)' : C.glassBorder}`,
                  background: visibility === opt.v ? C.accentSoft : 'transparent',
                  color: visibility === opt.v ? C.accent : C.textMuted,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {opt.icon} {opt.l}
                </button>
              ))}
            </div>
          </div>
          {error && <div style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: 'transparent', color: C.textSoft, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: C.bgDeep, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>{saving ? 'Publicando...' : 'Publicar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Ícones SVG inline ─────────────────────────────────────────────────────────

function IconARIA({ size = 28, color = C.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
      <path d="M10 22 Q16 10 22 22" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="16" r="3" fill={color} fillOpacity="0.9" />
      <circle cx="10" cy="22" r="1.5" fill={color} fillOpacity="0.6" />
      <circle cx="22" cy="22" r="1.5" fill={color} fillOpacity="0.6" />
    </svg>
  )
}

function IconCasos({ size = 24, color = '#8ba8c4' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="6" y="4" width="20" height="24" rx="3" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M10 10 H22 M10 15 H22 M10 20 H16" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  )
}

function IconCursos({ size = 24, color = '#8ba8c4' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 6 L28 12 L16 18 L4 12 Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M4 12 V20 M28 12 V18 Q22 22 16 22 Q10 22 4 18" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" fill="none" />
    </svg>
  )
}

function IconSimulados({ size = 24, color = '#8ba8c4' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="10" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M16 8 V16 L21 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  )
}

function IconVagas({ size = 24, color = '#8ba8c4' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="6" y="12" width="20" height="14" rx="3" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" fill="none" />
      <path d="M11 12 V9 Q11 6 16 6 Q21 6 21 9 V12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" fill="none" />
      <path d="M10 19 H22" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  )
}

function IconComunidade({ size = 24, color = '#8ba8c4' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <circle cx="22" cy="12" r="4" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M4 26 Q4 20 12 20 Q17 20 19 23 Q21 20 22 20 Q28 20 28 26" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" fill="none" />
    </svg>
  )
}

function IconNews({ size = 16, color = C.textMuted }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="12" rx="2" stroke={color} strokeWidth="1.2" strokeOpacity="0.6" />
      <path d="M4 6 H12 M4 9 H10" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  )
}

function IconLogout({ size = 14, color = '#ffb3b3' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M10 10l2-3-2-3M12 7H5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconEdit({ size = 14, color = C.textMuted }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="5" r="3" stroke={color} strokeWidth="1.2"/>
      <path d="M2 12c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Tool Card (large, prominent) ─────────────────────────────────────────────

function ToolCard({ icon, label, active = false, onClick, accent = false }) {
  const [hover, setHover] = useState(false)
  const isActive = active || accent

  return (
    <div
      onClick={isActive ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 16,
        border: isActive
          ? `1px solid ${hover ? 'rgba(221,255,85,0.5)' : 'rgba(221,255,85,0.3)'}`
          : `1px solid ${C.wipBorder}`,
        background: isActive
          ? (hover ? C.glassHover : C.glass)
          : C.wip,
        padding: '16px 18px',
        backdropFilter: 'blur(24px)',
        cursor: isActive ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        transform: isActive && hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isActive && hover ? `0 8px 28px rgba(221,255,85,0.12)` : 'none',
        opacity: isActive ? 1 : 0.4,
        minHeight: 100,
        justifyContent: 'flex-end',
      }}
    >
      {isActive && (
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background:'radial-gradient(ellipse at 20% 20%, rgba(221,255,85,0.08) 0%, transparent 60%)',
        }} />
      )}
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: isActive ? C.text : C.textDim,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {icon}
          {label}
          {!isActive && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: C.textDim,
              background: 'rgba(192,214,234,0.07)',
              border: '1px solid rgba(192,214,234,0.12)',
              borderRadius: 4, padding: '1px 6px',
            }}>
              Em breve
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── News Feed Card ─────────────────────────────────────────────────────────────

function getPreview(text, isAgent) {
  if (!text) return ''
  const normalized = text.replace(/\r/g, '').trim()
  if (!isAgent) {
    const firstBlock = normalized.split(/\n\n+/)[0] || normalized
    return firstBlock.replace(/\s+/g, ' ').slice(0, 240)
  }
  const lines = normalized.split('\n').filter(Boolean)
  const highlighted = lines.filter((l) => /^(\*\*|#|✅|⚠️|•|-)/.test(l.trim())).slice(0, 4)
  const content = highlighted.length ? highlighted.join(' ') : normalized.split(/\n\n+/)[0]
  return content.replace(/\*\*/g, '').replace(/#/g, '').replace(/\s+/g, ' ').slice(0, 320)
}

function NewsCard({ title, excerpt, created_at, type, onOpen, isStaff, onEdit, onDelete }) {
  const date = created_at
    ? new Date(created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : ''

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: `1px solid ${C.wipBorder}`,
      cursor: onOpen ? 'pointer' : 'default',
    }}>
      <div
        onClick={onOpen}
        role={onOpen ? 'button' : undefined}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, lineHeight: 1.4, marginBottom: 3 }}>
            {title || 'Sem título'}
          </div>
          {excerpt && (
            <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {excerpt}
            </div>
          )}
          {type && (
            <span style={{
              display: 'inline-block', marginTop: 4, fontSize: 9, fontWeight: 700,
              color: C.accent, background: C.accentSoft, borderRadius: 4,
              padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{type}</span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          {date && (
            <div style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap', marginTop: 2 }}>
              {date}
            </div>
          )}
          {isStaff && (
            <div style={{ display:'flex', gap:4 }} onClick={(e) => e.stopPropagation()}>
              <button onClick={onEdit} style={{
                borderRadius:6, border:`1px solid ${C.glassBorder}`, background:'transparent',
                color:C.textMuted, fontSize:10, padding:'2px 5px', cursor:'pointer',
              }}>✏️</button>
              <button onClick={onDelete} style={{
                borderRadius:6, border:'1px solid rgba(255,107,107,0.35)', background:'rgba(255,107,107,0.08)',
                color:'#ffb3b3', fontSize:10, padding:'2px 5px', cursor:'pointer',
              }}>🗑️</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────────

function WelcomeBanner({ displayName, profileLoading, navigate }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(221,255,85,0.08) 0%, rgba(0,26,43,0.4) 60%)`,
      border: `1px solid rgba(221,255,85,0.2)`,
      borderRadius: 20,
      padding: '20px 24px',
      position:'relative', overflow:'hidden',
    }}>
      <div style={{
        position:'absolute', top:'-20px', right:'-20px',
        width:160, height:160, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(221,255,85,0.08) 0%, transparent 70%)',
        pointerEvents:'none',
      }} />
      <div style={{ fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:C.accent, marginBottom:6, fontWeight:700 }}>
        {profileLoading ? '...' : 'Painel do Membro'}
      </div>
      <h1 style={{
        fontSize:'clamp(22px, 3.5vw, 38px)',
        fontWeight:900, letterSpacing:'-0.02em',
        marginBottom:6,
      }}>
        Bem-vindo,{' '}
        <span style={{ color:C.accent }}>{displayName.split(' ')[0]}</span>
      </h1>
      <p style={{ fontSize:13, color:C.textMuted, maxWidth: 480 }}>
        {profileLoading
          ? 'Carregando...'
          : 'ARIA está pronta para te ajudar com dúvidas em radiologia. Escolha uma ferramenta abaixo para começar.'}
      </p>
      <button
        onClick={() => navigate('/aria')}
        style={{
          marginTop:16,
          borderRadius:12, border:'none', background:C.accent,
          color:C.bgDeep, padding:'12px 28px', fontSize:14, fontWeight:800,
          cursor:'pointer', boxShadow:`0 0 24px ${C.accentGlow}`,
          display:'inline-flex', alignItems:'center', gap:8,
        }}
      >
        <IconARIA size={18} color={C.bgDeep} />
        Abrir ARIA
      </button>
    </div>
  )
}

function NewsFeedPanel({ posts, postsLoading, isStaff, onExpand, onNewPost, onEditPost, onDeletePost }) {
  const navigate = useNavigate()
  return (
    <div style={{
      flex:1, minHeight: 180,
      background: C.glass,
      border: `1px solid ${C.glassBorder}`,
      borderRadius: 18,
      padding: '16px 18px',
      backdropFilter: 'blur(24px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <IconNews size={16} />
          <span style={{ fontSize:13, fontWeight:800, color:C.textSoft }}>Feed de Notícias</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {isStaff && (
            <button
              onClick={onNewPost}
              style={{
                borderRadius: 8, border: 'none',
                background: C.accent, color: C.bgDeep,
                padding: '4px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
              }}
            >+ Novo</button>
          )}
          <button
            onClick={onExpand}
            style={{
              borderRadius: 8, border: `1px solid ${C.glassBorder}`,
              background: 'transparent', color: C.textMuted,
              padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >Ver mais</button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', maxHeight: 500 }}>
        {postsLoading ? (
          <div style={{ fontSize:12, color:C.textDim, textAlign:'center', padding:'20px 0' }}>Carregando...</div>
        ) : posts.length === 0 ? (
          <div style={{ fontSize:12, color:C.textDim, textAlign:'center', padding:'20px 0' }}>
            Nenhum post ainda. Seja o primeiro!
          </div>
        ) : (
          posts.map((post) => (
            <NewsCard
              key={post.id}
              title={post.title}
              excerpt={post.content ? post.content.replace(/<[^>]*>/g, '').substring(0, 120) : ''}
              created_at={post.created_at}
              type={post.type}
              isStaff={isStaff}
              onOpen={post.id ? () => navigate(`/artigo/${post.id}`) : undefined}
              onEdit={post.id ? () => onEditPost(post) : undefined}
              onDelete={post.id ? () => onDeletePost(post) : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

function SidebarPanel({ profileMenuRef, showProfileMenu, setShowProfileMenu, avatarUrl, initials, displayName, profileLoading, profile, user, openEdit, setShowLogout, isStaff, staffActions }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column',
      gap: 14,
      paddingLeft: 8,
    }}>
      {/* Profile button */}
      <div ref={profileMenuRef} style={{ position:'relative' }}>
        <button
          onClick={() => setShowProfileMenu((v) => !v)}
          style={{
            display:'flex', alignItems:'center', gap:10,
            borderRadius:14, border:`1px solid ${C.glassBorder}`,
            background:C.glass, backdropFilter:'blur(16px)',
            padding:'8px 14px', cursor:'pointer', width:'100%',
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width:32, height:32, borderRadius:10, border:`1px solid ${C.border}`, objectFit:'cover' }} />
          ) : (
            <div style={{
              width:32, height:32, borderRadius:10, background:'rgba(221,255,85,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:800, color:C.accent,
            }}>{initials}</div>
          )}
          <div style={{ textAlign:'left', flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textSoft }}>{displayName.split(' ')[0]}</div>
            <div style={{ fontSize:10, color:C.textDim }}>{profileLoading ? '...' : (profile?.specialty || user?.email?.split('@')[0])}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color:C.textMuted, flexShrink:0 }}>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showProfileMenu && (
          <div style={{
            position:'absolute', top:'100%', left:0, right:0,
            marginTop:8, minWidth:190,
            borderRadius:14, border:`1px solid ${C.glassBorder}`,
            background:'rgba(0,26,43,0.88)', backdropFilter:'blur(24px)',
            boxShadow:'0 16px 48px rgba(0,0,0,0.5)',
            overflow:'hidden', animation:'fadeIn 0.15s ease', zIndex:20,
          }}>
            <div style={{ padding:'12px 14px', borderBottom:`1px solid ${C.glassBorder}` }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.textSoft }}>{displayName}</div>
              <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{user?.email}</div>
            </div>
            <button onClick={openEdit} style={{
              width:'100%', padding:'10px 14px', textAlign:'left',
              border:'none', background:'transparent', cursor:'pointer',
              fontSize:13, fontWeight:600, color:C.textSoft,
              display:'flex', alignItems:'center', gap:8,
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.glass}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            ><IconEdit size={14} /> Editar perfil</button>
            <button onClick={() => { setShowProfileMenu(false); setShowLogout(true) }} style={{
              width:'100%', padding:'10px 14px', textAlign:'left',
              border:'none', background:'transparent', cursor:'pointer',
              fontSize:13, fontWeight:600, color:'#ffb3b3',
              display:'flex', alignItems:'center', gap:8,
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.glass}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            ><IconLogout size={14} /> Sair</button>
          </div>
        )}
      </div>

      {/* Staff panel */}
      {isStaff && (
        <div style={{
          borderRadius:18, border:`1px solid ${C.staffBorder}`,
          background:C.glass, backdropFilter:'blur(24px)',
          padding:'16px',
          display:'flex', flexDirection:'column', gap:8,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <div style={{
              padding:'2px 10px', borderRadius:999, background:'rgba(221,255,85,0.12)',
              color:C.accent, fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase',
            }}>Staff</div>
          </div>
          {staffActions.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              style={{
                width:'100%', borderRadius:12,
                border: btn.accent ? 'none' : `1px solid ${C.glassBorder}`,
                background: btn.accent ? C.accent : 'transparent',
                color: btn.accent ? C.bgDeep : C.textSoft,
                padding:'11px 14px', fontSize:13, fontWeight:800,
                cursor:'pointer', textAlign:'left',
                boxShadow: btn.accent ? `0 0 16px ${C.accentGlow}` : 'none',
                transition:'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!btn.accent) e.currentTarget.style.background = C.glassHover }}
              onMouseLeave={(e) => { if (!btn.accent) e.currentTarget.style.background = 'transparent' }}
            >{btn.label}</button>
          ))}
        </div>
      )}

      {/* Quick stats */}
      <div style={{
        background:C.glass, border:`1px solid ${C.glassBorder}`,
        borderRadius:18, padding:'16px',
        backdropFilter:'blur(24px)', flex:1,
      }}>
        <div style={{ fontSize:11, fontWeight:800, color:C.textSoft, marginBottom:12, letterSpacing:'0.06em', textTransform:'uppercase' }}>Resumo</div>
        <div style={{ display:'grid', gap:10 }}>
          {[
            { label:'Especialidade', value: profileLoading ? '...' : (profile?.specialty || 'Não definida') },
            { label:'Instituição', value: profileLoading ? '...' : (profile?.institution || 'Não informada') },
            { label:'Membro desde', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month:'short', year:'numeric' }) : '...' },
          ].map((item) => (
            <div key={item.label} style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <div style={{ fontSize:10, color:C.textDim, fontWeight:600 }}>{item.label}</div>
              <div style={{ fontSize:12, color:C.textSoft, fontWeight:700 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MobileStaffAccordion({ staffActions }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      borderRadius:14, border:`1px solid ${C.staffBorder}`,
      background:C.glass, overflow:'hidden', flexShrink:0,
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width:'100%', padding:'12px 14px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          border:'none', background:'transparent', cursor:'pointer',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{
            padding:'2px 10px', borderRadius:999, background:'rgba(221,255,85,0.12)',
            color:C.accent, fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase',
          }}>Staff</div>
          <span style={{ fontSize:12, color:C.textMuted }}>({staffActions.length} ações)</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
          color:C.textMuted, transition:'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding:'0 14px 14px', display:'flex', flexDirection:'column', gap:6, animation:'fadeIn 0.15s ease' }}>
          {staffActions.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              style={{
                width:'100%', borderRadius:10,
                border: btn.accent ? 'none' : `1px solid ${C.glassBorder}`,
                background: btn.accent ? C.accent : 'transparent',
                color: btn.accent ? C.bgDeep : C.textSoft,
                padding:'10px 14px', fontSize:12, fontWeight:800,
                cursor:'pointer', textAlign:'left',
                boxShadow: btn.accent ? `0 0 12px ${C.accentGlow}` : 'none',
              }}
            >{btn.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, signOut, userRole } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const navigate = useNavigate()
  const [showEdit, setShowEdit] = useState(false)
  const [showLogout, setShowLogout] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const avatarInputRef = useRef(null)
  const desktopProfileMenuRef = useRef(null)
  const mobileProfileMenuRef = useRef(null)
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [showFeedExpanded, setShowFeedExpanded] = useState(false)
  const [editPost, setEditPost] = useState(null)
  const [deletePost, setDeletePost] = useState(null)
  const [newPostOpen, setNewPostOpen] = useState(false)
  const [feedPosts, setFeedPosts] = useState([])
  const [feedAuthors, setFeedAuthors] = useState({})
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [feedFilter, setFeedFilter] = useState('all')
  const [feedSearch, setFeedSearch] = useState('')
  const [comments, setComments] = useState({})
  const [openComments, setOpenComments] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [form, setForm] = useState({
    avatar_url:'', full_name:'', institution:'', education:'', specialty:'', phone:'', bio:'',
  })
  const isStaff = userRole === 'staff' || userRole === 'admin'
  const isAdmin = userRole === 'admin'

  // Load profile
  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      if (!user?.id) { if (active) { setProfile(null); setProfileLoading(false) } return }
      setProfileLoading(true)
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (!active) return
      setProfile(error ? null : data)
      setProfileLoading(false)
    }
    loadProfile()
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    setForm({
      avatar_url: profile?.avatar_url || '',
      full_name: profile?.full_name || '',
      institution: profile?.institution || '',
      education: profile?.education || '',
      specialty: profile?.specialty || '',
      phone: profile?.phone || '',
      bio: profile?.bio || '',
    })
  }, [profile])

  // Load posts — fetch directly from Supabase
  const fetchDashboardPosts = async () => {
    setPostsLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, content, created_at, type')
      .order('created_at', { ascending: false })
      .limit(6)
    setPosts(error ? [] : (data || []))
    setPostsLoading(false)
  }

  useEffect(() => {
    fetchDashboardPosts()
  }, [])

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e) => {
      const clickedInsideDesktop = desktopProfileMenuRef.current?.contains(e.target)
      const clickedInsideMobile = mobileProfileMenuRef.current?.contains(e.target)

      if (!clickedInsideDesktop && !clickedInsideMobile) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const emailPrefix = useMemo(() => (user?.email ? user.email.split('@')[0] : 'Usuario'), [user?.email])
  const displayName = useMemo(
    () => (profile?.full_name?.trim() ? profile.full_name.trim() : emailPrefix),
    [profile?.full_name, emailPrefix]
  )
  const avatarUrl = profile?.avatar_url || ''
  const initials = getInitials(displayName, 'RX')

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffH = Math.floor(diffMs / 3600000)
    if (diffH < 1) return 'agora'
    if (diffH < 24) return `${diffH}h`
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  }

  const openEdit = () => {
    setShowProfileMenu(false)
    setFormError('')
    setForm({
      avatar_url: profile?.avatar_url || '',
      full_name: profile?.full_name || '',
      institution: profile?.institution || '',
      education: profile?.education || '',
      specialty: profile?.specialty || '',
      phone: profile?.phone || '',
      bio: profile?.bio || '',
    })
    setShowEdit(true)
  }

  const saveProfile = async () => {
    if (!user?.id) return
    setSaving(true); setFormError('')
    const updates = {
      id: user.id,
      avatar_url: form.avatar_url?.trim() || null,
      full_name: form.full_name?.trim() || null,
      institution: form.institution?.trim() || null,
      education: form.education?.trim() || null,
      specialty: form.specialty || null,
      phone: form.phone?.trim() || null,
      bio: form.bio?.trim() || null,
      updated_at: new Date().toISOString(),
    }
    try {
      let profileData = null

      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (existingProfileError) throw existingProfileError

      if (existingProfile) {
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single()

        if (error) throw error
        profileData = data
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            ...updates,
            id: user.id,
            email: user.email || null,
            role: profile?.role || 'user',
            profile_complete: profile?.profile_complete ?? false,
          })
          .select()
          .single()

        if (error) throw error
        profileData = data
      }

      setProfile(profileData)
      setFeedAuthors((prev) => ({
        ...prev,
        [user.id]: {
          ...(prev[user.id] || {}),
          ...profileData,
        },
      }))
      setComments((prev) => {
        const next = {}
        Object.entries(prev).forEach(([postId, postComments]) => {
          next[postId] = (postComments || []).map((comment) => (
            comment.user_id === user.id
              ? {
                  ...comment,
                  profiles: {
                    ...(comment.profiles || {}),
                    full_name: profileData?.full_name || comment.profiles?.full_name || displayName,
                    avatar_url: profileData?.avatar_url || null,
                  },
                }
              : comment
          ))
        })
        return next
      })
      setShowEdit(false)
    } catch (error) {
      console.error('Error saving profile:', error)
      setFormError(error?.message || 'Não foi possível salvar o perfil. Tente novamente.')
    }
    setSaving(false)
  }

  const fetchFeedPosts = async () => {
    setFeedLoading(true)
    setFeedError('')
    try {
      const { data, error: err } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      const postList = data || []
      setFeedPosts(postList)

      const userIds = [...new Set(postList.map((p) => p.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, specialty, institution, avatar_url, role')
          .in('id', userIds)
        if (profiles) {
          const map = {}
          profiles.forEach((p) => (map[p.id] = p))
          setFeedAuthors(map)
        }
      }
    } catch (err) {
      console.error(err)
      setFeedError('Erro ao carregar artigos.')
    } finally {
      setFeedLoading(false)
    }
  }

  const fetchCommentsForPosts = async (postIds) => {
    if (!postIds.length) return
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(full_name, avatar_url)')
        .in('post_id', postIds)
        .order('created_at', { ascending: true })
      if (error) { console.error('Error fetching comments:', error); return }
      const grouped = {}
      ;(data || []).forEach((c) => {
        if (!grouped[c.post_id]) grouped[c.post_id] = []
        grouped[c.post_id].push(c)
      })
      setComments((prev) => ({ ...prev, ...grouped }))
    } catch (e) { console.error(e) }
  }

  const fetchComments = async () => {
    if (!feedPosts.length) return
    const postIds = feedPosts.map((p) => p.id)
    await fetchCommentsForPosts(postIds)
  }

  useEffect(() => {
    if (showFeedExpanded) fetchFeedPosts()
  }, [showFeedExpanded])

  useEffect(() => {
    if (showFeedExpanded && feedPosts.length) fetchComments()
  }, [showFeedExpanded, feedPosts])

  const toggleComments = (postId) => {
    setOpenComments((prev) => (prev === postId ? null : postId))
  }

  const postComment = async (postId) => {
    if (!commentText.trim() || !user) return
    setCommentLoading(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: user.id, content: commentText.trim() })
        .select('*, profiles(full_name, avatar_url)')
        .single()
      if (error) throw error
      setComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data],
      }))
      setCommentText('')
    } catch (e) { console.error(e) }
    setCommentLoading(false)
  }

  const deleteComment = async (commentId, postId) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId)
      setComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
      }))
    } catch (e) { console.error(e) }
  }

  const formatCommentTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffH = Math.floor(diffMs / 3600000)
    if (diffH < 1) return 'agora'
    if (diffH < 24) return `${diffH}h`
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  }

  const tools = [
    { id:'aria', icon:<IconARIA size={20} color={C.accent} />, label:'ARIA', active:true, onClick:() => navigate('/aria') },
    { id:'teams', icon:<IconVagas size={20} color={C.accent} />, label:'eX Teams', active:true, onClick:() => navigate('/teams') },
    { id:'cursos', icon:<IconCursos size={20} />, label:'Cursos', active:false },
    { id:'simulados', icon:<IconSimulados size={20} />, label:'Simulados', active:false },
    { id:'challenge', icon:<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#ff6b6b' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg>, label:'ARIA Challenge', active:true, onClick:() => navigate('/challenge') },
    { id:'comunidade', icon:<IconComunidade size={20} />, label:'Comunidade', active:false },
  ]

  const staffActions = [
    { label:'eX Teams', action:() => navigate('/teams') },
    { label:'Artigos/Livros', action:() => navigate('/admin/article-upload') },
    ...(isAdmin ? [
      { label:'Usuários', action:() => navigate('/admin/users') },
      { label:'Config', action:() => navigate('/admin/config') },
    ] : []),
  ]

  const filteredFeed = useMemo(() => {
    const term = feedSearch.trim().toLowerCase()
    const byFilter = feedFilter === 'all'
      ? feedPosts
      : feedPosts.filter((p) => p.type === feedFilter)
    const visible = byFilter.filter((p) => p.visibility !== "private" || p.user_id === user?.id)
    if (!term) return visible
    return visible.filter((p) => {
      const text = `${p.title || ''} ${p.content || ''}`.toLowerCase()
      return text.includes(term)
    })
  }, [feedPosts, feedFilter, feedSearch])

  return (
    <div style={{
      position:'fixed', inset:0,
      background:C.bg, color:C.text,
      fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      overflow:'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-40px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,30px)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,25px)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

        @media (max-width: 1100px) {
          .db-desktop { display: none !important; }
          .db-mobile { display: flex !important; }
        }
        @media (min-width: 1101px) {
          .db-desktop { display: grid !important; }
          .db-mobile { display: none !important; }
        }
        .db-mobile-tools::-webkit-scrollbar { height: 0; }
        .db-mobile-tools { -ms-overflow-style: none; scrollbar-width: none; }

        /* Profile edit modal mobile fixes */
        .edit-profile-modal {
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .edit-profile-fields {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .edit-profile-avatar-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .edit-profile-input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border-radius: 10px;
          border: 1px solid rgba(192,214,234,0.15);
          background: rgba(0,26,43,0.5);
          padding: 10px 12px;
          font-size: 14px;
          color: #F6F2E8;
          outline: none;
        }
        @media (max-width: 640px) {
          .glass-modal-inner {
            padding: 14px !important;
            border-radius: 14px !important;
          }
          .edit-profile-modal {
            max-width: 100% !important;
            border-radius: 14px !important;
            padding: 16px !important;
            max-height: 85vh;
          }
          .edit-profile-fields {
            grid-template-columns: 1fr !important;
          }
          .edit-profile-avatar-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .edit-profile-specialty {
            grid-column: span 1 !important;
          }
          .edit-profile-actions {
            flex-direction: column !important;
          }
          .edit-profile-actions button {
            width: 100% !important;
            text-align: center !important;
          }
          .edit-profile-input {
            font-size: 16px !important;
            padding: 12px !important;
          }
        }
      `}</style>

      <FloatingOrbs />
      <NoiseOverlay />
      <ScanLines />

      {/* ═══════ DESKTOP LAYOUT (>1100px) ═══════ */}
      <div className="db-desktop" style={{
        position:'relative', zIndex:1,
        height:'100vh', width:'100vw',
        gridTemplateColumns: '1fr 280px',
        gridTemplateRows: 'auto 1fr auto',
        padding: '60px 24px 20px',
        gap: 16,
      }}>

        {/* Top-left logo */}
        <div style={{
          position:'absolute', top:0, left:0,
          padding:'20px 24px', zIndex:10,
        }}>
          <Logo size={17} />
        </div>

        {/* Main content grid area */}
        <div style={{
          gridColumn:'1 / -1',
          gridRow:'1 / -1',
          display:'grid',
          gridTemplateColumns: '1fr 260px',
          gridTemplateRows: '1fr auto',
          gap: 16,
          height: '100vh',
          paddingBottom: 20
        }}>

          {/* Left column: Welcome + News Feed */}
          <div style={{
            display:'flex', flexDirection:'column',
            gap: 16,
            paddingRight: 8,
            overflow:'hidden',
          }}>

            {/* Welcome + Tools */}
            <div style={{
              flex: '0 0 auto',
              display:'flex', flexDirection:'column',
              gap: 14,
            }}>
              <WelcomeBanner displayName={displayName} profileLoading={profileLoading} navigate={navigate} />
              <div className="db-tools-row" style={{
                display:'grid',
                gridTemplateColumns:'repeat(5, 1fr)',
                gap: 10,
              }}>
                {tools.map((tool) => (
                  <ToolCard key={tool.id} {...tool} />
                ))}
              </div>
            </div>

            {/* News Feed */}
            <NewsFeedPanel
              posts={posts}
              postsLoading={postsLoading}
              isStaff={isStaff}
              onExpand={() => setShowFeedExpanded(true)}
              onNewPost={() => setNewPostOpen(true)}
              onEditPost={(post) => setEditPost(post)}
              onDeletePost={(post) => setDeletePost(post)}
            />

          </div>

          {/* Right column: Profile + Staff panel */}
          <SidebarPanel
            profileMenuRef={desktopProfileMenuRef}
            showProfileMenu={showProfileMenu}
            setShowProfileMenu={setShowProfileMenu}
            avatarUrl={avatarUrl}
            initials={initials}
            displayName={displayName}
            profileLoading={profileLoading}
            profile={profile}
            user={user}
            openEdit={openEdit}
            setShowLogout={setShowLogout}
            isStaff={isStaff}
            staffActions={staffActions}
          />

        </div>
      </div>

      {/* ═══════ MOBILE LAYOUT (<=1100px) ═══════ */}
      <div className="db-mobile" style={{
        position:'relative', zIndex:1,
        height:'100vh', width:'100vw',
        display:'none',
        flexDirection:'column',
        padding: '12px 16px 16px',
        gap: 12,
        overflowY:'auto',
        overflowX:'hidden',
      }}>

        {/* Top bar: Logo + Profile */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexShrink: 0,
        }}>
          <Logo size={15} />
          <div ref={mobileProfileMenuRef} style={{ position:'relative' }}>
            <button
              onClick={() => setShowProfileMenu((v) => !v)}
              style={{
                display:'flex', alignItems:'center', gap:8,
                borderRadius:12, border:`1px solid ${C.glassBorder}`,
                background:C.glass, padding:'6px 10px', cursor:'pointer',
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width:28, height:28, borderRadius:8, objectFit:'cover' }} />
              ) : (
                <div style={{
                  width:28, height:28, borderRadius:8, background:'rgba(221,255,85,0.12)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:800, color:C.accent,
                }}>{initials}</div>
              )}
              <span style={{ fontSize:12, fontWeight:700, color:C.textSoft }}>{displayName.split(' ')[0]}</span>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ color:C.textMuted }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showProfileMenu && (
              <div style={{
                position:'absolute', top:'100%', right:0,
                marginTop:8, minWidth:190, zIndex:20,
                borderRadius:14, border:`1px solid ${C.glassBorder}`,
                background:'rgba(0,26,43,0.92)', backdropFilter:'blur(24px)',
                boxShadow:'0 16px 48px rgba(0,0,0,0.5)',
                overflow:'hidden', animation:'fadeIn 0.15s ease',
              }}>
                <div style={{ padding:'12px 14px', borderBottom:`1px solid ${C.glassBorder}` }}>
                  <div style={{ fontSize:13, fontWeight:800, color:C.textSoft }}>{displayName}</div>
                  <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{user?.email}</div>
                </div>
                <button onClick={openEdit} style={{
                  width:'100%', padding:'10px 14px', textAlign:'left',
                  border:'none', background:'transparent', cursor:'pointer',
                  fontSize:13, fontWeight:600, color:C.textSoft,
                  display:'flex', alignItems:'center', gap:8,
                }}><IconEdit size={14} /> Editar perfil</button>
                <button onClick={() => { setShowProfileMenu(false); setShowLogout(true) }} style={{
                  width:'100%', padding:'10px 14px', textAlign:'left',
                  border:'none', background:'transparent', cursor:'pointer',
                  fontSize:13, fontWeight:600, color:'#ffb3b3',
                  display:'flex', alignItems:'center', gap:8,
                }}><IconLogout size={14} /> Sair</button>
              </div>
            )}
          </div>
        </div>

        {/* Welcome compact */}
        <div style={{
          background: `linear-gradient(135deg, rgba(221,255,85,0.08) 0%, rgba(0,26,43,0.4) 60%)`,
          border: `1px solid rgba(221,255,85,0.2)`,
          borderRadius: 16,
          padding: '14px 16px',
          flexShrink: 0,
        }}>
          <div style={{ fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:C.accent, marginBottom:4, fontWeight:700 }}>
            {profileLoading ? '...' : 'Painel do Membro'}
          </div>
          <div style={{ fontSize:20, fontWeight:900, letterSpacing:'-0.02em', marginBottom:6 }}>
            Bem-vindo, <span style={{ color:C.accent }}>{displayName.split(' ')[0]}</span>
          </div>
          <button onClick={() => navigate('/aria')} style={{
            borderRadius:10, border:'none', background:C.accent,
            color:C.bgDeep, padding:'10px 20px', fontSize:13, fontWeight:800,
            cursor:'pointer', boxShadow:`0 0 16px ${C.accentGlow}`,
            display:'inline-flex', alignItems:'center', gap:6,
          }}>
            <IconARIA size={16} color={C.bgDeep} /> Abrir ARIA
          </button>
        </div>

        {/* Tools — horizontal scrollable row */}
        <div className="db-mobile-tools" style={{
          display:'flex', gap:10,
          overflowX:'auto', flexShrink:0,
          paddingBottom:4,
        }}>
          {tools.map((tool) => (
            <div key={tool.id} style={{ minWidth:130, flex:'0 0 auto' }}>
              <ToolCard {...tool} />
            </div>
          ))}
        </div>

        {/* Staff panel — collapsible accordion */}
        {isStaff && <MobileStaffAccordion staffActions={staffActions} />}

        {/* News Feed — simple card list */}
        <NewsFeedPanel
          posts={posts}
          postsLoading={postsLoading}
          isStaff={isStaff}
          onExpand={() => setShowFeedExpanded(true)}
          onNewPost={() => setNewPostOpen(true)}
          onEditPost={(post) => setEditPost(post)}
          onDeletePost={(post) => setDeletePost(post)}
        />

      </div>

      {/* ─── Expanded Community Feed Overlay ─────────────────────────── */}
      {showFeedExpanded && (
        <div className="feed-ov" style={{
          position:'fixed', inset:0, zIndex:60, background:C.bg, color:C.text,
          overflowY:'auto', WebkitOverflowScrolling:'touch',
        }}>
          <style>{`
            .feed-ov::-webkit-scrollbar{width:0}
            .feed-ov-pills{display:flex;gap:8px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px}
            .feed-ov-pills::-webkit-scrollbar{display:none}
            @media(max-width:640px){
              .feed-ov-bar{padding:10px 12px!important}
              .feed-ov-bar strong{font-size:13px!important}
              .feed-ov-body{padding:14px 14px 60px!important}
              .feed-ov-filters{flex-direction:column!important;align-items:stretch!important;gap:8px!important}
              .feed-ov-search{min-width:unset!important;width:100%!important}
              .feed-ov-card{padding:14px!important;border-radius:14px!important}
              .feed-ov-card h2{font-size:16px!important;line-height:1.3!important}
              .feed-ov-card p{font-size:12.5px!important;line-height:1.6!important}
              .feed-ov-avatar{width:28px!important;height:28px!important;border-radius:8px!important;font-size:11px!important}
              .feed-ov-badge{font-size:9px!important;padding:2px 8px!important}
              .feed-ov-date{font-size:10px!important}
              .feed-ov-admin{gap:6px!important}
              .feed-ov-admin button{padding:6px 0!important;font-size:11px!important}
              .feed-ov-comment{flex-direction:column!important;align-items:stretch!important}
              .feed-ov-comment button{align-self:flex-end}
            }
          `}</style>
          <div className="feed-ov-bar" style={{
            position:'sticky', top:0, zIndex:5,
            background:'rgba(0,26,43,0.92)', backdropFilter:'blur(24px)',
            borderBottom:`1px solid ${C.border}`, padding:'12px 20px',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button
                onClick={() => setShowFeedExpanded(false)}
                style={{
                  background:'transparent', border:`1px solid ${C.glassBorder}`,
                  borderRadius:8, padding:'5px 10px', color:C.textMuted,
                  fontSize:12, fontWeight:700, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:4,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Voltar
              </button>
              <IconComunidade size={18} color={C.accent} />
              <strong style={{ fontSize:14 }}>Comunidade Radiológica</strong>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {isStaff && (
                <button
                  onClick={() => setNewPostOpen(true)}
                  style={{
                    borderRadius: 8, border: 'none', background: C.accent, color: C.bgDeep,
                    padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  }}
                >+ Novo Post</button>
              )}
            </div>
          </div>

          <div className="feed-ov-body" style={{ maxWidth: 1200, margin:'0 auto', padding:'24px 20px 60px' }}>
            <div className="feed-ov-filters" style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center', marginBottom:16 }}>
              <div className="feed-ov-pills">
                {['all','post','vaga','article','case','news'].map((k) => (
                  <button
                    key={k}
                    onClick={() => setFeedFilter(k)}
                    style={{
                      borderRadius:999, border:`1px solid ${feedFilter===k ? 'rgba(221,255,85,0.3)' : C.glassBorder}`,
                      background: feedFilter===k ? C.accentSoft : 'transparent',
                      color: feedFilter===k ? C.accent : C.textMuted,
                      padding: '7px 14px', whiteSpace:'nowrap', fontWeight:700, cursor:'pointer',
                      fontSize:12, flexShrink:0,
                    }}
                  >{k === 'all' ? 'Todos' : TYPE_LABELS[k]?.label || k}</button>
                ))}
              </div>
              <input className="feed-ov-search"
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                placeholder="Buscar no feed..."
                style={{
                  minWidth: 220, borderRadius: 10, border:`1px solid ${C.glassBorder}`,
                  background:'rgba(0,26,43,0.6)', color:C.text, padding:'8px 12px',
                  fontSize:12, outline:'none',
                }}
              />
            </div>

            {feedError && <div style={{ marginBottom: 14, color: C.red }}>{feedError}</div>}

            {feedLoading ? (
              <p style={{ color: C.textMuted, padding: '20px 0' }}>Carregando...</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {filteredFeed.map((post) => {
                  const typeInfo = TYPE_LABELS[post.type] || TYPE_LABELS.article
                  const author = post.is_agent ? null : (feedAuthors[post.user_id] || null)
                  const authorName = post.is_agent ? 'ARIA' : (author?.full_name || 'Comunidade eX')
                  const authorAvatar = post.is_agent ? '' : (author?.avatar_url || '')
                  const authorInitials = getInitials(authorName, 'C')
                  const specialty = author?.specialty || post?.metadata?.specialty || (post.is_agent ? 'Curadoria IA' : null)
                  const source = post?.journal || post?.metadata?.source || null
                  const location = post?.metadata?.location
                  const role = author?.role || post?.metadata?.author_role || null
                  const preview = getPreview(post.content, post.is_agent)
                  const imageUrl = getPostImageUrl(post)

                  return (
                    <article
                      key={post.id}
                      onClick={() => navigate(`/artigo/${post.id}`)}
                      style={{
                        borderRadius: 16, background: C.glass, border:`1px solid ${C.glassBorder}`,
                        padding: 18, cursor:'pointer', position:'relative',
                      }}
                    >
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:10 }}>
                        <div style={{
                          width:34, height:34, borderRadius:10,
                          background: post.is_agent ? C.accentSoft : 'rgba(126,203,255,0.15)',
                          display:'grid', placeItems:'center',
                          color: post.is_agent ? C.accent : '#7ecbff', fontWeight:800,
                          flexShrink:0,
                          overflow:'hidden',
                          border: post.is_agent ? 'none' : '1px solid rgba(126,203,255,0.2)',
                        }}>{post.is_agent ? 'IA' : authorAvatar ? <img src={authorAvatar} alt={authorName} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : authorInitials}</div>
                        <div style={{ minWidth:0 }}>
                          <div
                            onClick={(e) => { e.stopPropagation(); if (!post.is_agent && post.user_id) navigate(`/profile/${post.user_id}`); }}
                            style={{ fontSize:13, fontWeight:700, color:C.textSoft, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor: post.is_agent ? 'default' : 'pointer' }}
                          >{authorName}</div>
                          <div style={{ fontSize:11, color:C.textDim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {specialty || 'Radiologia'}{role ? ` · ${role}` : ''}
                          </div>
                        </div>
                        <span style={{
                          marginLeft:'auto', fontSize:10, padding:'3px 10px', borderRadius:999,
                          background:`${typeInfo.color}18`, border:`1px solid ${typeInfo.color}35`,
                          color:typeInfo.color, fontWeight:700, flexShrink:0,
                        }}>{typeInfo.label}</span>
                        <span style={{ fontSize:11, color:C.textDim, flexShrink:0 }}>{formatDate(post.created_at)}</span>
                      </div>

                      <h2 style={{ margin:'0 0 8px', fontSize:20, lineHeight:1.3, color:C.text, fontWeight:800, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                        {post.title}
                      </h2>

                      {post.is_agent && (
                        <div style={{ marginBottom: 10, fontSize: 12, color: C.accent, background: C.accentSoft, border: `1px solid rgba(221,255,85,0.25)`, padding: '7px 10px', borderRadius: 10 }}>
                          Resumo da ARIA com foco em aplicabilidade clínica e referência de fonte.
                        </div>
                      )}

                      {imageUrl && <img src={imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 14, marginBottom: 12, border: `1px solid ${C.glassBorder}` }} />}

                      <p style={{ margin:0, color:C.textMuted, lineHeight:1.7, fontSize:13.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical' }}>
                        {preview}
                      </p>

                      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}`, alignItems:'center' }}>
                        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                          {source && <span style={{ fontSize:11, color:C.textDim }}>📚 {source}</span>}
                          {location && <span style={{ fontSize:11, color:C.textDim }}>📍 {location}</span>}
                          {post.source_url && (
                            <a href={post.source_url} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer"
                              style={{ fontSize:11, color:C.accent, textDecoration:'none', fontWeight:700 }}>
                              Fonte ↗
                            </a>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleComments(post.id) }}
                          style={{ marginLeft:'auto', fontSize:11, color: openComments === post.id ? C.accent : C.textDim, fontWeight:700, background:'transparent', border:'none', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:4 }}
                        >💬 {comments[post.id]?.length || 0}</button>
                        <span style={{ fontSize:11, color:C.accent, fontWeight:700, flexShrink:0 }}>Ler editorial →</span>
                      </div>

                      {isStaff && (
                        <div style={{
                          display:'flex', gap:8, marginTop:10, paddingTop:10,
                          borderTop:`1px solid ${C.border}`,
                        }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditPost(post)}
                            style={{
                              flex:1, padding:'7px 0', borderRadius:8, fontSize:12, fontWeight:700,
                              border:`1px solid ${C.glassBorder}`, background:C.glass, color:C.textSoft, cursor:'pointer',
                            }}
                          >✏️ Editar</button>
                          <button
                            onClick={() => setDeletePost(post)}
                            style={{
                              flex:1, padding:'7px 0', borderRadius:8, fontSize:12, fontWeight:700,
                              border:'1px solid rgba(255,107,107,0.3)', background:'rgba(255,107,107,0.07)',
                              color:'#ff9999', cursor:'pointer',
                            }}
                          >🗑️ Excluir</button>
                        </div>
                      )}

                      {openComments === post.id && (
                        <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:12 }}>
                            {(comments[post.id] || []).map((comment) => (
                              <div key={comment.id} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                                <div style={{
                                  width:26, height:26, borderRadius:7, flexShrink:0,
                                  background:C.accentSoft, color:C.accent,
                                  display:'grid', placeItems:'center',
                                  fontSize:10, fontWeight:800,
                                  overflow:'hidden',
                                  border:`1px solid ${C.glassBorder}`,
                                }}>
                                  {comment.profiles?.avatar_url ? (
                                    <img src={comment.profiles.avatar_url} alt={comment.profiles?.full_name || 'Usuário'} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                  ) : (
                                    getInitials(comment.profiles?.full_name, 'U')
                                  )}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                    <span
                                      onClick={() => comment.user_id && navigate(`/profile/${comment.user_id}`)}
                                      style={{ fontSize:12, fontWeight:700, color:C.textSoft, cursor:'pointer' }}
                                    >
                                      {comment.profiles?.full_name || 'Usuário'}
                                    </span>
                                    <span style={{ fontSize:10, color:C.textDim }}>
                                      {formatCommentTime(comment.created_at)}
                                    </span>
                                    {user && comment.user_id === user.id && (
                                      <button
                                        onClick={() => deleteComment(comment.id, post.id)}
                                        style={{ fontSize:10, color:C.red, background:'transparent', border:'none', cursor:'pointer', padding:0 }}
                                      >🗑️</button>
                                    )}
                                  </div>
                                  <p style={{ margin:'2px 0 0', fontSize:12.5, color:C.textMuted, lineHeight:1.5 }}>
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {(comments[post.id] || []).length === 0 && (
                              <p style={{ fontSize:12, color:C.textDim, textAlign:'center', padding:'8px 0' }}>
                                Seja o primeiro a comentar 👋
                              </p>
                            )}
                          </div>
                          {user ? (
                            <div className="feed-ov-comment" style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                              <textarea
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Escreva um comentário..."
                                rows={2}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  flex:1, background:C.bgDeep, border:`1px solid ${C.glassBorder}`,
                                  borderRadius:10, padding:'8px 10px', color:C.text, fontSize:12.5,
                                  fontFamily:'inherit', outline:'none', resize:'none', lineHeight:1.5,
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    postComment(post.id)
                                  }
                                }}
                              />
                              <button
                                onClick={() => postComment(post.id)}
                                disabled={commentLoading || !commentText.trim()}
                                style={{
                                  padding:'7px 14px', borderRadius:10, border:'none',
                                  background: commentLoading ? C.glassBorder : C.accent,
                                  color: C.bgDeep, fontWeight:800, fontSize:12,
                                  cursor: commentLoading ? 'not-allowed' : 'pointer',
                                  whiteSpace:'nowrap',
                                }}
                              >{commentLoading ? '...' : 'Enviar'}</button>
                            </div>
                          ) : (
                            <p style={{ fontSize:12, color:C.textDim, textAlign:'center' }}>
                              Faça login para comentar
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Edit Profile Modal ─────────────────────────────────────────── */}
      {showEdit && (
        <GlassModal title="Editar Perfil" onClose={() => setShowEdit(false)} width={640}>
          <div className="edit-profile-modal" style={{ display:'grid', gap:12 }}>
            <div style={{ display:'grid', gap:6 }}>
              <label style={{ fontSize:12, color:C.textMuted }}>Foto de Perfil</label>
              <div className="edit-profile-avatar-row">
                <div style={{
                  width:72, height:72, borderRadius:'50%', flexShrink:0,
                  background: form.avatar_url ? 'transparent' : C.glass,
                  border:`2px solid ${C.glassBorder}`, overflow:'hidden',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {form.avatar_url
                    ? <img src={form.avatar_url} alt="Avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <span style={{ fontSize:28, color:C.textMuted }}>{(form.full_name || '?')[0]?.toUpperCase()}</span>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <input ref={avatarInputRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]; if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => setForm((p) => ({ ...p, avatar_url:ev.target.result }))
                      reader.readAsDataURL(file)
                    }} />
                  <button type="button" onClick={() => avatarInputRef.current?.click()} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:10,
                    border:`1px solid ${C.glassBorder}`, background:C.glass, color:C.textSoft, fontSize:13, cursor:'pointer',
                  }}>📷 Escolher foto</button>
                  {form.avatar_url && (
                    <button type="button" onClick={() => setForm((p) => ({ ...p, avatar_url:'' }))} style={{
                      padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,107,107,0.3)',
                      background:'rgba(255,107,107,0.08)', color:'#ffb3b3', fontSize:12, cursor:'pointer',
                    }}>Remover foto</button>
                  )}
                </div>
              </div>
            </div>
            <div className="edit-profile-fields">
              {[
                { label:'Nome completo', key:'full_name' },
                { label:'Instituição', key:'institution' },
                { label:'Formação', key:'education' },
                { label:'Telefone/Contato', key:'phone' },
              ].map((field) => (
                <div key={field.key} style={{ display:'grid', gap:6, minWidth:0 }}>
                  <label style={{ fontSize:12, color:C.textMuted }}>{field.label}</label>
                  <input
                    className="edit-profile-input"
                    value={form[field.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [field.key]:e.target.value }))}
                  />
                </div>
              ))}
              <div className="edit-profile-specialty" style={{ display:'grid', gap:6, gridColumn:'span 2', minWidth:0 }}>
                <label style={{ fontSize:12, color:C.textMuted }}>Especialidade</label>
                <select className="edit-profile-input" value={form.specialty} onChange={(e) => setForm((p) => ({ ...p, specialty:e.target.value }))}>
                  <option value="">Selecione</option>
                  {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gap:6, minWidth:0 }}>
              <label style={{ fontSize:12, color:C.textMuted }}>Bio / Currículo breve</label>
              <textarea className="edit-profile-input" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio:e.target.value }))} rows={4}
                style={{ resize:'vertical' }} />
            </div>
            {formError && <div style={{ fontSize:12, color:'#ffb3b3' }}>{formError}</div>}
            <div className="edit-profile-actions" style={{ marginTop:4, display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={() => setShowEdit(false)} style={{
                borderRadius:10, border:`1px solid ${C.glassBorder}`, background:'transparent',
                color:C.textSoft, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer',
              }}>Cancelar</button>
              <button onClick={saveProfile} disabled={saving} style={{
                borderRadius:10, border:'none', background:C.accent, color:C.bgDeep,
                padding:'8px 14px', fontSize:12, fontWeight:800, cursor:'pointer', opacity:saving?0.7:1,
              }}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </GlassModal>
      )}

      {/* ─── Logout Modal ─────────────────────────────────────────────── */}
      {showLogout && (
        <GlassModal title="Sair" onClose={() => setShowLogout(false)} width={420}>
          <div style={{ marginBottom:16, fontSize:14, color:C.textSoft }}>Tem certeza que deseja sair?</div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={() => setShowLogout(false)} style={{
              borderRadius:10, border:`1px solid ${C.glassBorder}`, background:'transparent',
              color:C.textSoft, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer',
            }}>Cancelar</button>
            <button onClick={signOut} style={{
              borderRadius:10, border:'none', background:C.accent, color:C.bgDeep,
              padding:'8px 14px', fontSize:12, fontWeight:800, cursor:'pointer',
            }}>Sair</button>
          </div>
        </GlassModal>
      )}

      {newPostOpen && (
        <NewPostModal
          userId={user?.id}
          onClose={() => setNewPostOpen(false)}
          onCreated={() => {
            fetchDashboardPosts()
            fetchFeedPosts()
          }}
        />
      )}

      {editPost && (
        <EditPostModal
          post={editPost}
          onClose={() => setEditPost(null)}
          onSaved={() => {
            fetchDashboardPosts()
            fetchFeedPosts()
          }}
        />
      )}

      {deletePost && (
        <DeletePostModal
          post={deletePost}
          onClose={() => setDeletePost(null)}
          onDeleted={() => {
            fetchDashboardPosts()
            fetchFeedPosts()
          }}
        />
      )}
    </div>
  )
}
