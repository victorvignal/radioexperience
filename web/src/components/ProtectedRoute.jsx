import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const C = {
  bg: '#001a2b',
  border: 'rgba(192,214,234,0.2)',
  accent: '#DDFF55',
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: C.bg,
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
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
