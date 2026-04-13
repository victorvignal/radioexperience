import { useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [focus, setFocus] = useState({ name: false, email: false, password: false, confirm: false })
  const { signUp } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, name)
      setSuccess('Conta criada com sucesso! Redirecionando...')
      setTimeout(() => window.location.href = '/dashboard', 1500)
    } catch (err) {
      setError(err?.message || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setSuccess('')
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://www.radioexperience.com.br/dashboard' },
      })
    } catch (err) {
      setError(err?.message || 'Erro ao entrar com Google. Tente novamente.')
    }
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
            maxWidth: 440,
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

          <h1 style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 4 }}>Criar Conta</h1>
          <p style={{ textAlign: 'center', fontSize: 13, color: C.textMuted, marginBottom: 22 }}>
            Entre na comunidade eXperience
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

          {success && (
            <div
              style={{
                marginBottom: 14,
                borderRadius: 10,
                border: '1px solid rgba(221,255,85,0.3)',
                background: 'rgba(221,255,85,0.08)',
                padding: '10px 12px',
                fontSize: 12,
                color: C.accent,
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 12, color: C.textDim }}>Nome completo</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocus((f) => ({ ...f, name: true }))}
              onBlur={() => setFocus((f) => ({ ...f, name: false }))}
              type="text"
              placeholder="Seu nome"
              required
              style={inputStyle(focus.name)}
            />

            <label style={{ marginTop: 6, fontSize: 12, color: C.textDim }}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocus((f) => ({ ...f, email: true }))}
              onBlur={() => setFocus((f) => ({ ...f, email: false }))}
              type="email"
              placeholder="você@exemplo.com"
              required
              style={inputStyle(focus.email)}
            />

            <label style={{ marginTop: 6, fontSize: 12, color: C.textDim }}>Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocus((f) => ({ ...f, password: true }))}
              onBlur={() => setFocus((f) => ({ ...f, password: false }))}
              type="password"
              placeholder="••••••••"
              required
              style={inputStyle(focus.password)}
            />

            <label style={{ marginTop: 6, fontSize: 12, color: C.textDim }}>Confirmar senha</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={() => setFocus((f) => ({ ...f, confirm: true }))}
              onBlur={() => setFocus((f) => ({ ...f, confirm: false }))}
              type="password"
              placeholder="••••••••"
              required
              style={inputStyle(focus.confirm)}
            />

            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
              <Link to="/login" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'none' }}>
                Já tem conta? Entrar
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 10,
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
              {loading ? 'Criando...' : 'Criar Conta'}
            </button>
          </form>

          <div style={{ margin: '18px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.textMuted }}>
            <div style={{ height: 1, flex: 1, background: C.border }} />
            <span>ou</span>
            <div style={{ height: 1, flex: 1, background: C.border }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.1)',
              background: '#ffffff',
              padding: '12px 14px',
              fontSize: 14,
              fontWeight: 700,
              color: '#333',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continuar com Google
          </button>
        </div>
      </div>
    </div>
  )
}
