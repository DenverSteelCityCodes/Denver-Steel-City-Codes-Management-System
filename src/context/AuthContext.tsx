import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: UserRole | null
  // Set when the profile query itself failed (network, RLS) — distinct from "no profile row",
  // so a blip on reload reads as "couldn't load" with a retry, not as "no role → access denied".
  profileError: string | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  retryProfile: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    role: null,
    profileError: null,
    loading: true,
  })
  // Bumped on every auth change; a profile fetch that resolves after a newer change (e.g. a
  // SIGNED_OUT while it was in flight) is dropped instead of writing the old session back.
  const requestRef = useRef(0)
  const sessionRef = useRef<Session | null>(null)
  // The user whose profile is loaded or loading. supabase-js emits SIGNED_IN as well as
  // INITIAL_SESSION at startup, and SIGNED_IN again on every tab refocus; for the same user those
  // only need the fresh session, not another profile fetch (and a new `user` object that would
  // make every hook keyed on it refetch).
  const profileUserRef = useRef<string | null>(null)

  const loadProfile = useCallback(async (session: Session) => {
    const request = ++requestRef.current
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
    if (request !== requestRef.current) return
    // Let the next auth event (e.g. a tab refocus) try again after a failure.
    if (error) profileUserRef.current = null

    // Profile is created server-side by the handle_new_user trigger.
    // If it's genuinely missing (e.g. pre-migration user), role stays null and the routes show
    // "account isn't set up" rather than auto-creating with a hardcoded role.
    setState({
      session,
      user: session.user,
      profile: error ? null : profile ?? null,
      role: error ? null : profile?.role ?? null,
      profileError: error ? error.message : null,
      loading: false,
    })
  }, [])

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on subscribe, so it also covers hydration on mount.
    // Supabase calls made inside this callback can deadlock the auth client, so the profile
    // query is deferred to the next tick.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionRef.current = session
      if (session && profileUserRef.current === session.user.id) {
        setState(s => (s.session ? { ...s, session } : s))
      } else if (session) {
        profileUserRef.current = session.user.id
        // By the time this runs a newer event may have arrived: load with the latest session, or
        // skip if it signed out / switched user (that event schedules its own load).
        setTimeout(() => {
          const latest = sessionRef.current
          if (latest && latest.user.id === session.user.id) void loadProfile(latest)
        }, 0)
      } else {
        profileUserRef.current = null
        requestRef.current++
        setState({ session: null, user: null, profile: null, role: null, profileError: null, loading: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const retryProfile = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    profileUserRef.current = session.user.id
    setState(s => ({ ...s, profileError: null, loading: true }))
    void loadProfile(session)
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signOut, retryProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
