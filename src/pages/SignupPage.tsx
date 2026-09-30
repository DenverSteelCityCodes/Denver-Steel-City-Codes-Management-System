import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BrandBar } from '../components/Wordmark'

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Sign up — profile is created server-side by handle_new_user trigger
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, role: 'parent' } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <BrandBar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-success-soft flex items-center justify-center mx-auto mb-4">
            <span className="text-success text-xl">✓</span>
          </div>
          <h1 className="font-sans font-bold text-xl text-ink mb-2">Check your email</h1>
          <p className="font-sans text-ink-muted text-sm">
            We sent a confirmation link to <strong className="text-ink">{email}</strong>. Click it to activate your account.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block font-sans font-semibold text-sm text-ink hover:underline"
          >
            Back to sign in
          </Link>
        </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">

      <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-sm p-8">
        <h1 className="font-sans font-bold text-2xl text-ink mb-1">Create an account</h1>
        <p className="font-sans text-ink-muted text-sm mb-6">Register to enroll your camper</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="displayName">
              Your name
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition"
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8+ characters"
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
              <UserPlus size={16} />
            )}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-sans text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-ink font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      </main>
    </div>
  )
}
