import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BrandBar } from './Wordmark'
import type { UserRole } from '../types/database'

interface Props {
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { session, role, loading, profileError, retryProfile, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // The profile query failed (e.g. a network blip on reload) — that says nothing about the role,
  // so offer a retry instead of "Access denied".
  if (profileError) {
    return (
      <AccountNotice
        title="Couldn't load your account"
        message={`Check your connection and try again. (${profileError})`}
        onRetry={retryProfile}
        onSignOut={signOut}
      />
    )
  }

  // A session with no profile row (e.g. a pre-trigger account) has no area to go to — say so
  // here rather than bouncing between / and /login, and never let it slip through a role gate.
  if (!role) {
    return (
      <AccountNotice
        title="Your account isn't set up yet"
        message="Contact the camp so they can finish setting it up."
        onSignOut={signOut}
      />
    )
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

function AccountNotice({ title, message, onRetry, onSignOut }: {
  title: string
  message: string
  onRetry?: () => void
  onSignOut: () => Promise<void>
}) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">
        <h1 className="font-sans font-bold text-2xl text-ink mb-2">{title}</h1>
        <p role="alert" className="font-sans text-ink-muted text-sm mb-6 max-w-xs">{message}</p>
        <div className="flex gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="h-10 px-4 rounded-[10px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm transition"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => { void onSignOut() }}
            className="h-10 px-4 rounded-[10px] border border-border-strong bg-surface text-ink font-sans font-semibold text-sm hover:bg-surface-sunken transition"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}
