import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BrandBar } from '../components/Wordmark'

export default function LoginPage() {
  const { role } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">

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
            <p className="text-danger text-sm font-sans flex items-center gap-1.5">
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
