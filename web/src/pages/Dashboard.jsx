import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import AriaChat from '../AriaChat'

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
}

const specialties = [
  'Abdome',
  'Cabeça e Pescoço',
  'Geral',
  'Mama',
  'Músculo Esquelético',
  'Neurorradiologia',
  'Obstetrícia',
  'Pediatria',
  'Radiologia Intervencionista',
  'Tórax',
  'Urgência',
  'Vascular',
]

function EX({ color = C.accent, size = 16 }) {
  return (
    <span style={{ color, fontWeight: 800, fontStyle: 'italic' }}>
      <span style={{ fontSize: size * 0.85 }}>e</span>
      <span style={{ fontSize: size * 1.12, fontWeight: 900 }}>X</span>
    </span>
  )
}

function Logo({ size = 20, showIcon = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      {showIcon && (
        <div
          style={{
            width: size * 1.8,
            height: size * 1.8,
            borderRadius: size * 0.5,
            background: `linear-gradient(135deg, ${C.accent}, #b8ff33)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 20px ${C.accentGlow}`,
          }}
        >
          <span
            style={{
              fontWeight: 900,
              fontSize: size * 0.65,
              color: C.bgDeep,
              fontStyle: 'italic',
              letterSpacing: '-0.06em',
            }}
          >
            <span style={{ fontSize: size * 0.55 }}>e</span>
            <span style={{ fontSize: size * 0.75 }}>X</span>
          </span>
        </div>
      )}
      <span
        style={{
          fontFamily: "'Inter',sans-serif",
          fontSize: size,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: C.text,
        }}
      >
        Radio<EX color={C.accent} size={size} />perience
      </span>
    </div>
  )
}

function FloatingOrbs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '15%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(221,255,85,0.06) 0%, transparent 60%)',
          filter: 'blur(60px)',
          animation: 'float1 20s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '8%',
          right: '10%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(17,66,93,0.5) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'float2 25s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '60%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(126,203,255,0.05) 0%, transparent 70%)',
          filter: 'blur(50px)',
          animation: 'float3 18s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: '5%',
          width: 600,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(221,255,85,0.04) 0%, transparent 60%)',
          filter: 'blur(70px)',
          animation: 'float2 22s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '55%',
          right: '5%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,107,0.03) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'float1 28s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '75%',
          left: '30%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,215,0,0.04) 0%, transparent 60%)',
          filter: 'blur(80px)',
          animation: 'float3 24s ease-in-out infinite',
        }}
      />
    </div>
  )
}

function NoiseOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0.03,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundSize: '256px 256px',
      }}
    />
  )
}

function ScanLines() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0.015,
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(192,214,234,0.5) 2px, rgba(192,214,234,0.5) 3px)',
        backgroundSize: '100% 4px',
      }}
    />
  )
}

function GlassModal({ title, onClose, children, width = 560 }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,26,43,0.65)',
        padding: 20,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: width,
          borderRadius: 20,
          border: `1px solid ${C.glassBorder}`,
          background: 'rgba(0,26,43,0.6)',
          padding: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              borderRadius: 8,
              border: `1px solid ${C.glassBorder}`,
              background: 'transparent',
              color: C.textMuted,
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, signOut, userRole } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [showAria, setShowAria] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showLogout, setShowLogout] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const avatarInputRef = useRef(null)
  const [form, setForm] = useState({
    avatar_url: '',
    full_name: '',
    institution: '',
    education: '',
    specialty: '',
    phone: '',
    bio: '',
  })
  const isStaff = userRole === 'staff' || userRole === 'admin'
  const isAdmin = userRole === 'admin'

  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      if (!user?.id) {
        if (active) {
          setProfile(null)
          setProfileLoading(false)
        }
        return
      }
      setProfileLoading(true)
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!active) return
      if (error) {
        setProfile(null)
      } else {
        setProfile(data)
      }
      setProfileLoading(false)
    }
    loadProfile()
    return () => {
      active = false
    }
  }, [user?.id])

  const emailPrefix = useMemo(() => (user?.email ? user.email.split('@')[0] : 'Usuario'), [user?.email])
  const displayName = useMemo(
    () => (profile?.full_name && profile.full_name.trim() ? profile.full_name.trim() : emailPrefix),
    [profile?.full_name, emailPrefix]
  )
  const avatarUrl = profile?.avatar_url || ''
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'RX'

  const openEdit = () => {
    setForm({
      avatar_url: profile?.avatar_url || '',
      full_name: profile?.full_name || '',
      institution: profile?.institution || '',
      education: profile?.education || '',
      specialty: profile?.specialty || '',
      phone: profile?.phone || '',
      bio: profile?.bio || '',
    })
    setFormError('')
    setShowEdit(true)
  }

  const saveProfile = async () => {
    if (!user?.id) return
    setSaving(true)
    setFormError('')
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
    const { data, error } = await supabase.from('profiles').upsert(updates, { onConflict: 'id' }).select().single()
    if (error) {
      setFormError('Não foi possível salvar o perfil. Tente novamente.')
    } else {
      setProfile(data)
      setShowEdit(false)
    }
    setSaving(false)
  }

  const profileFields = [
    { label: 'Instituição', value: profile?.institution },
    { label: 'Formação', value: profile?.education },
    { label: 'Especialidade', value: profile?.specialty },
    { label: 'Contato', value: profile?.phone },
    { label: 'Bio', value: profile?.bio },
  ].filter((item) => item.value && String(item.value).trim())

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-40px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,30px)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,25px)}}
        @media (max-width: 960px) {
          .dashboard-grid { grid-template-columns: repeat(1, 1fr) !important; }
          .dashboard-card-span-4, .dashboard-card-span-5, .dashboard-card-span-7, .dashboard-card-span-12 { grid-column: span 1 !important; }
          .profile-bar { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      <FloatingOrbs />
      <NoiseOverlay />
      <ScanLines />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '90px 24px 40px' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
          className="profile-bar"
        >
          <Logo size={18} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderRadius: 16,
                border: `1px solid ${C.glassBorder}`,
                background: C.glass,
                padding: '8px 10px',
                backdropFilter: 'blur(16px)',
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  style={{ width: 36, height: 36, borderRadius: 12, border: `1px solid ${C.border}`, objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: 'rgba(221,255,85,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    color: C.accent,
                  }}
                >
                  {initials}
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{displayName}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{user?.email}</div>
              </div>
            </div>
            <button
              onClick={() => setShowLogout(true)}
              style={{
                borderRadius: 10,
                border: `1px solid ${C.glassBorder}`,
                background: 'transparent',
                color: C.textSoft,
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Sair
            </button>
          </div>
        </div>

        <div
          className="dashboard-grid"
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: 16,
          }}
        >
          <div
            className="dashboard-card-span-12"
            style={{
              gridColumn: 'span 12',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              borderRadius: 20,
              border: `1px solid ${C.glassBorder}`,
              background: C.glass,
              padding: 24,
              backdropFilter: 'blur(24px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  style={{ width: 64, height: 64, borderRadius: 18, border: `1px solid ${C.border}`, objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background: 'rgba(221,255,85,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    fontWeight: 800,
                    color: C.accent,
                  }}
                >
                  {initials}
                </div>
              )}
              <div>
                <h1 style={{ marginBottom: 6, fontSize: 26, fontWeight: 800 }}>Bem-vindo, {displayName}</h1>
                <p style={{ fontSize: 13, color: C.textMuted }}>
                  {profileLoading ? 'Carregando perfil...' : 'Seu painel da RadioeXperience'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowAria(true)}
                style={{
                  borderRadius: 10,
                  border: 'none',
                  background: C.accent,
                  color: C.bgDeep,
                  padding: '12px 18px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: `0 0 20px ${C.accentGlow}`,
                }}
              >
                Abrir ARIA
              </button>
              <button
                onClick={openEdit}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${C.glassBorder}`,
                  background: C.accentSoft,
                  color: C.textSoft,
                  padding: '12px 18px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Editar Perfil
              </button>
            </div>
          </div>

          <div
            className="dashboard-card-span-4"
            style={{
              gridColumn: 'span 4',
              borderRadius: 20,
              border: `1px solid ${C.glassBorder}`,
              background: C.glass,
              padding: 20,
              backdropFilter: 'blur(24px)',
            }}
          >
            <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim }}>
              Plano atual
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>Free</div>
            <div style={{ marginTop: 6, fontSize: 12, color: C.textMuted }}>Upgrade em breve</div>
          </div>

          <div
            className="dashboard-card-span-4"
            style={{
              gridColumn: 'span 4',
              borderRadius: 20,
              border: `1px solid ${C.glassBorder}`,
              background: C.glass,
              padding: 20,
              backdropFilter: 'blur(24px)',
            }}
          >
            <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim }}>
              ARIA
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textSoft }}>3 perguntas restantes</div>
            <div style={{ marginTop: 6, fontSize: 12, color: C.textMuted }}>Uso mensal (placeholder)</div>
          </div>

          <div
            className="dashboard-card-span-4"
            style={{
              gridColumn: 'span 4',
              borderRadius: 20,
              border: `1px solid ${C.glassBorder}`,
              background: C.glass,
              padding: 20,
              backdropFilter: 'blur(24px)',
            }}
          >
            <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim }}>
              Perfil
            </div>
            <div style={{ marginBottom: 4, fontSize: 13, color: C.textSoft }}>{profile?.full_name || displayName}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{user?.email}</div>
          </div>

          <div
            className="dashboard-card-span-7"
            style={{
              gridColumn: 'span 7',
              borderRadius: 20,
              border: `1px solid ${C.glassBorder}`,
              background: C.glass,
              padding: 20,
              backdropFilter: 'blur(24px)',
            }}
          >
            <div style={{ marginBottom: 12, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim }}>
              Sobre você
            </div>
            {profileFields.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted }}>Complete seu perfil para aparecer aqui.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {profileFields.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${C.border}`,
                      background: 'rgba(0,34,51,0.4)',
                      padding: 12,
                    }}
                  >
                    <div style={{ marginBottom: 6, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 13, color: C.textSoft }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="dashboard-card-span-5"
            style={{
              gridColumn: 'span 5',
              borderRadius: 20,
              border: `1px solid ${C.glassBorder}`,
              background: C.glass,
              padding: 20,
              backdropFilter: 'blur(24px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 700, color: C.textSoft }}>Acesso rápido</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Ações essenciais do seu painel</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setShowAria(true)}
                style={{
                  borderRadius: 10,
                  border: 'none',
                  background: C.accent,
                  color: C.bgDeep,
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: `0 0 18px ${C.accentGlow}`,
                }}
              >
                Abrir ARIA
              </button>
              <button
                onClick={openEdit}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${C.glassBorder}`,
                  background: 'transparent',
                  color: C.textSoft,
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Editar Perfil
              </button>
            </div>
          </div>

          {isStaff && (
            <div
              className="dashboard-card-span-12"
              style={{
                gridColumn: 'span 12',
                borderRadius: 20,
                border: `1px solid ${C.staffBorder}`,
                background: C.glass,
                padding: 20,
                backdropFilter: 'blur(24px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(221,255,85,0.12)',
                    color: C.accent,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Staff
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.textSoft }}>Painel Staff</div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <button
                  onClick={() => {
                    window.location.href = '/admin/upload'
                  }}
                  style={{
                    borderRadius: 12,
                    border: 'none',
                    background: C.accent,
                    color: C.bgDeep,
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: `0 0 18px ${C.accentGlow}`,
                  }}
                >
                  Enviar Escalas
                </button>
                <button
                  onClick={() => {
                    window.location.href = '/vagas'
                  }}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${C.glassBorder}`,
                    background: 'transparent',
                    color: C.textSoft,
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Gerenciar Vagas
                </button>
                <button
                  onClick={() => alert('Em breve')}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${C.glassBorder}`,
                    background: 'transparent',
                    color: C.textSoft,
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Artigos
                </button>
                {isAdmin && (
                  <button
                    onClick={() => alert('Em breve')}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${C.glassBorder}`,
                      background: 'transparent',
                      color: C.textSoft,
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Gerenciar Usuários
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => alert('Em breve')}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${C.glassBorder}`,
                      background: 'transparent',
                      color: C.textSoft,
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Configurações
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAria && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30,
            overflowY: 'auto',
            background: 'rgba(0,26,43,0.6)',
            padding: 20,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ position: 'relative', maxWidth: 860, margin: '60px auto', paddingBottom: 40 }}>
            <button
              onClick={() => setShowAria(false)}
              style={{
                position: 'absolute',
                right: 0,
                top: -44,
                borderRadius: 10,
                border: `1px solid ${C.glassBorder}`,
                background: 'transparent',
                color: C.textSoft,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
            <div
              style={{
                borderRadius: 20,
                border: `1px solid ${C.glassBorder}`,
                background: 'rgba(0,26,43,0.85)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}
            >
              <AriaChat />
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <GlassModal title="Editar Perfil" onClose={() => setShowEdit(false)} width={640}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textMuted }}>Foto de Perfil</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: form.avatar_url ? 'transparent' : C.glass,
                  border: `2px solid ${C.glassBorder}`,
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 28, color: C.textMuted }}>
                      {(form.nomeCompleto || form.full_name || '?')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    ref={avatarInputRef}
                    type="file" accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        setForm((prev) => ({ ...prev, avatar_url: ev.target.result }))
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px', borderRadius: 10,
                      border: `1px solid ${C.glassBorder}`,
                      background: C.glass, color: C.textSoft,
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>&#128247;</span> Escolher foto
                  </button>
                  {form.avatar_url && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, avatar_url: '' }))}
                      style={{
                        padding: '6px 12px', borderRadius: 8,
                        border: '1px solid rgba(255,107,107,0.3)',
                        background: 'rgba(255,107,107,0.08)',
                        color: '#ffb3b3', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted }}>Nome completo</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${C.glassBorder}`,
                    background: 'rgba(0,26,43,0.5)',
                    padding: '10px 12px',
                    fontSize: 14,
                    color: C.text,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted }}>Instituição</label>
                <input
                  value={form.institution}
                  onChange={(e) => setForm((prev) => ({ ...prev, institution: e.target.value }))}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${C.glassBorder}`,
                    background: 'rgba(0,26,43,0.5)',
                    padding: '10px 12px',
                    fontSize: 14,
                    color: C.text,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted }}>Formação</label>
                <input
                  value={form.education}
                  onChange={(e) => setForm((prev) => ({ ...prev, education: e.target.value }))}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${C.glassBorder}`,
                    background: 'rgba(0,26,43,0.5)',
                    padding: '10px 12px',
                    fontSize: 14,
                    color: C.text,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted }}>Especialidade</label>
                <select
                  value={form.specialty}
                  onChange={(e) => setForm((prev) => ({ ...prev, specialty: e.target.value }))}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${C.glassBorder}`,
                    background: 'rgba(0,26,43,0.5)',
                    padding: '10px 12px',
                    fontSize: 14,
                    color: C.text,
                    outline: 'none',
                  }}
                >
                  <option value="">Selecione</option>
                  {specialties.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted }}>Telefone/Contato</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${C.glassBorder}`,
                    background: 'rgba(0,26,43,0.5)',
                    padding: '10px 12px',
                    fontSize: 14,
                    color: C.text,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textMuted }}>Bio/Currículo breve</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                rows={4}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${C.glassBorder}`,
                  background: 'rgba(0,26,43,0.5)',
                  padding: '10px 12px',
                  fontSize: 14,
                  color: C.text,
                  outline: 'none',
                }}
              />
            </div>
            {formError && <div style={{ fontSize: 12, color: '#ffb3b3' }}>{formError}</div>}
            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowEdit(false)}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${C.glassBorder}`,
                  background: 'transparent',
                  color: C.textSoft,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{
                  borderRadius: 10,
                  border: 'none',
                  background: C.accent,
                  color: C.bgDeep,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </GlassModal>
      )}

      {showLogout && (
        <GlassModal title="Sair" onClose={() => setShowLogout(false)} width={420}>
          <div style={{ marginBottom: 16, fontSize: 14, color: C.textSoft }}>Tem certeza que deseja sair?</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={() => setShowLogout(false)}
              style={{
                borderRadius: 10,
                border: `1px solid ${C.glassBorder}`,
                background: 'transparent',
                color: C.textSoft,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={signOut}
              style={{
                borderRadius: 10,
                border: 'none',
                background: C.accent,
                color: C.bgDeep,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Sair
            </button>
          </div>
        </GlassModal>
      )}
    </div>
  )
}
