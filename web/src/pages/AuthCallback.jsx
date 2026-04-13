import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#001a2b',
  border: 'rgba(192,214,234,0.2)',
  accent: '#DDFF55',
  text: '#F6F2E8',
}

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const access_token = hash.get('access_token')
        const refresh_token = hash.get('refresh_token')

        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        } else if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token })
        }
      } catch {}

      if (!cancelled) navigate('/dashboard', { replace: true })
    }

    bootstrap()
    return () => { cancelled = true }
  }, [navigate])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: C.bg,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: `3px solid ${C.border}`,
          borderTopColor: C.accent,
          animation: 'spin 0.9s linear infinite',
        }}
      />
      <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>
        Finalizando autenticação...
      </span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
