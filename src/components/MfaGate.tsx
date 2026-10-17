import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Admin MFA (spec 27). An admin whose session hasn't passed the authenticator step goes to /mfa
// first; the database refuses admin data until then anyway (private.auth_user_role()). Everyone
// else, and admins on a deployment with the switch off (the demo), pass straight through.
export default function MfaGate() {
  const { session } = useAuth()
  const location = useLocation()
  const [state, setState] = useState<{ key: string; ok: boolean } | null>(null)
  // Re-check when the user or their session's assurance level changes.
  const key = `${session?.user.id ?? ''}:${session?.access_token.slice(-16) ?? ''}`

  useEffect(() => {
    let alive = true
    void (async () => {
      const [{ data: req }, { data: aal }] = await Promise.all([
        supabase.rpc('my_mfa_requirement'),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ])
      const required = !!(req as { required: boolean }[] | null)?.[0]?.required
      if (alive) setState({ key, ok: !required || aal?.currentLevel === 'aal2' })
    })()
    return () => { alive = false }
  }, [key])

  if (!state || state.key !== key) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    )
  }
  if (!state.ok) return <Navigate to={`/mfa?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <Outlet />
}
