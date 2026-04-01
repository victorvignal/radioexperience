import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profileComplete, setProfileComplete] = useState(false)
  const [userRole, setUserRole] = useState('user')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchProfileComplete = async (activeSession) => {
      if (!activeSession?.user) {
        if (mounted) setProfileComplete(false)
        return
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_complete')
        .eq('id', activeSession.user.id)
        .single()
      if (error) {
        console.error(error)
      }
      if (mounted) {
        setProfileComplete(data?.profile_complete || false)
      }
    }

    const fetchUserRole = async (activeSession) => {
      if (!activeSession?.user) return
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', activeSession.user.id)
        .single()
      if (mounted) {
        setUserRole(data?.role || 'user')
      }
    }

    const init = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error(error)
      }
      if (!mounted) return
      setSession(data?.session ?? null)
      setUser(data?.session?.user ?? null)
      await fetchProfileComplete(data?.session)
      await fetchUserRole(data?.session)
      if (mounted) setLoading(false)
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      setLoading(true)
      setSession(newSession)
      setUser(newSession?.user ?? null)
      await fetchProfileComplete(newSession)
      await fetchUserRole(newSession)
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const refreshProfile = async () => {
    if (!session?.user) return
    const { data } = await supabase
      .from('profiles')
      .select('profile_complete')
      .eq('id', session.user.id)
      .single()
    setProfileComplete(data?.profile_complete || false)
  }

  const value = {
    session,
    user,
    profileComplete,
    userRole,
    loading,
    refreshProfile,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
