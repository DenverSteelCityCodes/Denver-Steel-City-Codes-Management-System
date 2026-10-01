import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BrandBar } from '../components/Wordmark'
import { DEMO_ACCOUNTS, type DemoAccount } from '../lib/demo'

export default function LoginPage() {
  const { role } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [demoBusy, setDemoBusy] = useState<DemoAccount['key'] | null>(null)

  // Demo mode: sign in as a prepared account with one click (no typing, no sign-up).
  async function signInDemo(account: DemoAccount) {
    setError(null)
    setDemoBusy(account.key)
    const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password })
    if (error) {
      setError("The demo account couldn't sign in. It may be mid-reset — try again in a minute.")
      setDemoBusy(null)
    }
    // AuthContext resolves the role and the redirect above takes over.
  }

  // Already signed in (or just signed in — AuthContext resolves the role) → go to that area.
  if (role) return <Navigate to={`/${role}`} replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Wrong email or password. Try again.')
      setLoading(false)
      return
    }
    // AuthContext listener handles the redirect via role
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-10">

      {DEMO_ACCOUNTS.length > 0 && (
        <section aria-labelledby="demo-heading" className="w-full max-w-sm bg-surface border border-brand rounded-xl shadow-sm p-6">
          <h2 id="demo-heading" className="font-sans font-bold text-lg text-ink mb-1">Try the demo</h2>
          <p className="font-sans text-ink-muted text-sm mb-4">
            Explore a fictional summer camp from any seat. Nothing here is real, and the data resets every night.
          </p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map(account => {
              const Icon = account.icon
              return (
                <button
                  key={account.key}
                  type="button"
                  onClick={() => signInDemo(account)}
                  disabled={demoBusy !== null || loading}
                  className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-border-strong bg-surface hover:bg-surface-sunken text-left transition disabled:opacity-60"
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${account.tone}`}>
                    {demoBusy === account.key
                      ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      : <Icon size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-sans font-semibold text-sm text-ink">{account.label}</span>
                    <span className="block font-sans text-xs text-ink-muted">{account.blurb}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-sm p-8">
        <h1 className="font-sans font-bold text-2xl text-ink mb-1">Welcome back</h1>
        <p className="font-sans text-ink-muted text-sm mb-6">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition"
            />
          </div>

          {error && (
            <p role="alert" className="text-danger text-sm font-sans flex items-center gap-1.5">
              <span>⚠</span> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-sans text-ink-muted">
          Don't have an account?{' '}
          <Link to="/signup" className="text-ink font-semibold hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-center text-sm font-sans text-ink-muted">
          Want to volunteer?{' '}
          <Link to="/apply" className="text-ink font-semibold hover:underline">
            Apply here
          </Link>
        </p>
      </div>
      </main>
    </div>
  )
}
