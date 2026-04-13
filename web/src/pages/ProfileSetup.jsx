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

const AREA_OPTIONS = [
  { id: 'USG', label: 'USG', desc: 'Ultrassonografia' },
  { id: 'TC', label: 'TC', desc: 'Tomografia Computadorizada' },
  { id: 'RM', label: 'RM', desc: 'Ressonância Magnética' },
  { id: 'DO', label: 'DO', desc: 'Doppler' },
  { id: 'MAMA', label: 'MAMA', desc: 'Mamografia' },
  { id: 'RX', label: 'RX', desc: 'Radiografia' },
]

const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
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
    <Link to='/' style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }}>
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
    </Link>
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

const maskPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (!rest) return `(${ddd}`
  if (rest.length <= 5) return `(${ddd}) ${rest}`
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
}

export default function ProfileSetup() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    nomeCompleto: '',
    crm: '',
    areas: [],
    estado: '',
    telefone: '',
  })
  const [focus, setFocus] = useState({ nome: false, crm: false, estado: false, telefone: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.user_metadata?.full_name && !formData.nomeCompleto) {
      setFormData((prev) => ({ ...prev, nomeCompleto: user.user_metadata.full_name }))
    }
  }, [user, formData.nomeCompleto])

  const toggleArea = (id) => {
    setFormData((prev) => {
      const exists = prev.areas.includes(id)
      return { ...prev, areas: exists ? prev.areas.filter((a) => a !== id) : [...prev.areas, id] }
    })
  }

  const inputStyle = (active) => ({
    width: '100%',
    borderRadius: 10,
    border: `1px solid ${C.glassBorder}`,
    background: C.glass,
    padding: '14px 14px',
    fontSize: 14,
    color: C.text,
    outline: 'none',
    boxShadow: active ? `0 0 0 2px rgba(221,255,85,0.35)` : 'none',
    transition: 'box-shadow 0.2s ease',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.crm) {
      setError('Informe seu CRM.')
      return
    }
    if (!formData.areas.length) {
      setError('Selecione ao menos uma área de atuação.')
      return
    }
    if (!formData.estado) {
      setError('Selecione o estado de atuação.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: formData.nomeCompleto,
        crm: formData.crm,
        areas: formData.areas,
        state: formData.estado,
        phone: formData.telefone,
        profile_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message || 'Erro ao salvar. Tente novamente.')
      setLoading(false)
      return
    }

    await refreshProfile()
    navigate('/dashboard')
  }

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
      `}</style>

      <FloatingOrbs />
      <NoiseOverlay />
      <ScanLines />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(0,26,43,0.3) 0%, rgba(0,34,51,0.5) 20%, rgba(0,26,43,0.4) 40%, rgba(0,34,51,0.6) 60%, rgba(0,26,43,0.4) 100%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            borderRadius: 20,
            background: C.glass,
            border: `1px solid ${C.glassBorder}`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(24px)',
            padding: 28,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Logo size={18} />
          </div>

          <h1 style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 4 }}>
            Complete seu Cadastro
          </h1>
          <p style={{ textAlign: 'center', fontSize: 13, color: C.textMuted, marginBottom: 22 }}>
            Precisamos de algumas informações profissionais
          </p>

          {error && (
            <div
              style={{
                marginBottom: 14,
                borderRadius: 10,
                border: '1px solid rgba(255,107,107,0.3)',
                background: 'rgba(255,107,107,0.08)',
                padding: '10px 12px',
                fontSize: 12,
                color: '#ffb3b3',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 12, color: C.textDim }}>Nome completo</label>
            <input
              value={formData.nomeCompleto}
              onChange={(e) => setFormData((prev) => ({ ...prev, nomeCompleto: e.target.value }))}
              onFocus={() => setFocus((f) => ({ ...f, nome: true }))}
              onBlur={() => setFocus((f) => ({ ...f, nome: false }))}
              type="text"
              placeholder="Seu nome"
              style={inputStyle(focus.nome)}
            />

            <label style={{ marginTop: 6, fontSize: 12, color: C.textDim }}>CRM</label>
            <input
              value={formData.crm}
              onChange={(e) => setFormData((prev) => ({ ...prev, crm: e.target.value.toUpperCase() }))}
              onFocus={() => setFocus((f) => ({ ...f, crm: true }))}
              onBlur={() => setFocus((f) => ({ ...f, crm: false }))}
              type="text"
              placeholder="123456-UF"
              required
              style={inputStyle(focus.crm)}
            />

            <label style={{ marginTop: 6, fontSize: 12, color: C.textDim }}>Área de atuação</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {AREA_OPTIONS.map((area) => {
                const selected = formData.areas.includes(area.id)
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleArea(area.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: selected ? `1px solid ${C.accent}` : `1px solid ${C.glassBorder}`,
                      background: selected ? C.accentSoft : C.glass,
                      color: selected ? C.accent : C.textSoft,
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: selected ? `0 0 16px ${C.accentGlow}` : 'none',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{area.label}</div>
                    <div style={{ fontSize: 11, color: selected ? C.accent : C.textMuted }}>{area.desc}</div>
                  </button>
                )
              })}
            </div>

            <label style={{ marginTop: 8, fontSize: 12, color: C.textDim }}>Estado de atuação</label>
            <select
              value={formData.estado}
              onChange={(e) => setFormData((prev) => ({ ...prev, estado: e.target.value }))}
              onFocus={() => setFocus((f) => ({ ...f, estado: true }))}
              onBlur={() => setFocus((f) => ({ ...f, estado: false }))}
              style={{
                ...inputStyle(focus.estado),
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `linear-gradient(45deg, transparent 50%, ${C.textMuted} 50%), linear-gradient(135deg, ${C.textMuted} 50%, transparent 50%)`,
                backgroundPosition: 'calc(100% - 18px) 20px, calc(100% - 12px) 20px',
                backgroundSize: '6px 6px, 6px 6px',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <option value="" style={{ color: C.textMuted }}>
                Selecione
              </option>
              {STATES.map((uf) => (
                <option key={uf} value={uf} style={{ color: '#0c1b2a' }}>
                  {uf}
                </option>
              ))}
            </select>

            <label style={{ marginTop: 6, fontSize: 12, color: C.textDim }}>Telefone</label>
            <input
              value={formData.telefone}
              onChange={(e) => setFormData((prev) => ({ ...prev, telefone: maskPhone(e.target.value) }))}
              onFocus={() => setFocus((f) => ({ ...f, telefone: true }))}
              onBlur={() => setFocus((f) => ({ ...f, telefone: false }))}
              type="tel"
              placeholder="(11) 91234-5678"
              style={inputStyle(focus.telefone)}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 12,
                width: '100%',
                borderRadius: 10,
                background: C.accent,
                border: 'none',
                padding: '14px 16px',
                fontSize: 14,
                fontWeight: 800,
                color: C.bgDeep,
                cursor: 'pointer',
                boxShadow: `0 0 20px ${C.accentGlow}`,
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading ? 'Salvando...' : 'Salvar e Continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
