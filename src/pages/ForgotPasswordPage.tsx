import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BrandBar } from '../components/Wordmark'

// Step 1 of a password reset: email a recovery link that lands on /reset.
// Always shows the same confirmation, so this page never reveals whether an email has an account.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    })
    setLoading(false)
    // Rate limits and network failures are worth saying; "no such user" is not (Supabase doesn't
    // report it either).
    if (error && /rate limit|network|fetch/i.test(error.message)) {
      setError("We couldn't send the link just now. Wait a minute and try again.")
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-sm p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-success-soft flex items-center justify-center mx-auto mb-4">
                <Mail size={20} className="text-success" />
              </div>
              <h1 className="font-sans font-bold text-xl text-ink mb-2">Check your email</h1>
              <p role="status" className="font-sans text-ink-muted text-sm">
                If <strong className="text-ink">{email.trim()}</strong> has an account, we've sent a link to choose a new password. It works for one hour.
              </p>
              <p className="mt-4 font-sans text-ink-muted text-xs">
                Nothing arrived? Check your spam folder, or{' '}
                <button type="button" onClick={() => setSent(false)} className="text-ink font-semibold hover:underline">
                  try again
                </button>.
              </p>
              <Link to="/login" className="mt-6 inline-block font-sans font-semibold text-sm text-ink hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-sans font-bold text-2xl text-ink mb-1">Forgot your password?</h1>
              <p className="font-sans text-ink-muted text-sm mb-6">Enter your email and we'll send you a link to choose a new one.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block font-sans font-semibold text-sm text-ink" htmlFor="forgot-email">
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
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
                  {loading
                    ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
                    : <Mail size={16} />}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm font-sans text-ink-muted">
                Remembered it?{' '}
                <Link to="/login" className="text-ink font-semibold hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
