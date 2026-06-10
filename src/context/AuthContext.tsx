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
    // Hydrate on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadProfile(session)
      } else {
        setState(s => ({ ...s, loading: false }))
      }
    })

    // Keep in sync with Supabase auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadProfile(session)
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
