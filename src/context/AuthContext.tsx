import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: UserRole | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    role: null,
    loading: true,
  })

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on subscribe, so it also covers hydration on mount.
    // Supabase calls made inside this callback can deadlock the auth client, so the profile
    // query is deferred to the next tick.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setTimeout(() => { void loadProfile(session) }, 0)
      } else {
        setState({ session: null, user: null, profile: null, role: null, loading: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(session: Session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    // Profile is created server-side by the handle_new_user trigger.
    // If it's genuinely missing (e.g. pre-migration user), stay in a loading/null state
    // rather than auto-creating with a hardcoded role.
    setState({
      session,
      user: session.user,
      profile: profile ?? null,
      role: profile?.role ?? null,
      loading: false,
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
