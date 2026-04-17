import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const ADMIN_EMAILS = ['radioexperience.project@gmail.com', 'vignal27@gmail.com']
const STAFF_EMAILS = ['vignal27@gmail.com']

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profileComplete, setProfileComplete] = useState(false)
  const [userRole, setUserRole] = useState('user')
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)

  const fetchProfileData = useCallback(async (userId, email) => {
    if (!userId) return
    const isAdminEmail = ADMIN_EMAILS.includes(email)
    const isStaffEmail = STAFF_EMAILS.includes(email)
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_complete, role')
        .eq('id', userId)
        .maybeSingle()
      
      if (error) throw error

      if (data) {
        const resolvedRole = isAdminEmail ? 'admin' : isStaffEmail ? 'staff' : (data.role || 'user')
        setProfileComplete(data.profile_complete || false)
        setUserRole(resolvedRole)
      } else {
        // No profile found — auto-create for known staff/admin, otherwise start with false
        if (isAdminEmail || isStaffEmail) {
          const role = isAdminEmail ? 'admin' : 'staff'
          await supabase.from('profiles').upsert({
            id: userId,
            email,
            full_name: email,
            role,
            profile_complete: true,
          }, { onConflict: 'id' })
          setProfileComplete(true)
          setUserRole(role)
        } else {
          setProfileComplete(false)
          setUserRole('user')
        }
      }
    } catch (e) {
      console.error('[Auth] Profile fetch error:', e)
      setProfileComplete(false)
      setUserRole(isAdminEmail ? 'admin' : isStaffEmail ? 'staff' : 'user')
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const applySession = async (newSession) => {
      if (!mounted) return
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) {
        fetchProfileData(newSession.user.id, newSession.user.email)
      } else {
        setProfileComplete(false)
        setUserRole('user')
        setProfileLoading(false)
      }
    }

    const init = async () => {
      try {
        let resolvedSession = null

        for (let attempt = 0; attempt < 4; attempt++) {
          const { data } = await supabase.auth.getSession()
          resolvedSession = data?.session ?? null
          if (resolvedSession) break
          await new Promise((r) => setTimeout(r, 600))
        }

        await applySession(resolvedSession)
      } catch (e) {
        console.error('[Auth] Init error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      await applySession(newSession)
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [fetchProfileData])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

  const signUp = useCallback(async (email, password, fullName) => {
    // Clean up any existing session first
    await supabase.auth.signOut().catch(() => {})
    
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { full_name: fullName, profile_complete: false }
      }
    })
    if (error) throw error
    
    // Create profile entry with profile_complete: false
    if (data?.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        role: 'user',
        profile_complete: false
      }, { onConflict: 'id' })
      if (profileError) {
        console.error('[Auth] Profile upsert error:', profileError)
      }
    }
    
    return data
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setSession(null)
    setUser(null)
    setProfileComplete(false)
    setUserRole('user')
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await fetchProfileData(session.user.id, session.user.email)
    }
  }, [session?.user?.id, session?.user?.email, fetchProfileData])

  const value = {
    session,
    user,
    profileComplete,
    userRole,
    isAdmin: userRole === 'admin',
    isStaff: userRole === 'staff' || userRole === 'admin',
    loading,
    profileLoading,
    refreshProfile,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
