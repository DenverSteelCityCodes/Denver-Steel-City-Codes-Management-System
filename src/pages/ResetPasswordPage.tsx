import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BrandBar } from '../components/Wordmark'
import { focusOnMount } from '../lib/focus'

// The recovery link lands here as /reset#access_token=…&type=recovery (or #error=… when it has
// expired). supabase-js reads and clears the hash while the client initializes, so capture it at
// module load, which runs before that.
const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : ''
const linkFailed = /error_code=otp_expired|error=access_denied/.test(INITIAL_HASH)

// Step 2 of a password reset. The link signs the user in with a short-lived recovery session;
// a signed-in user who opens /reset directly can also use it to change their password.
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError("The two passwords don't match."); return }
    setError(null)
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setError(/same|different/i.test(error.message)
        ? 'Choose a password different from your old one.'
        : /weak|pwned|leaked|known/i.test(error.message)
          ? 'That password has appeared in a data breach. Choose a different one.'
          : `Couldn't save your new password: ${error.message}`)
      return
    }
    setDone(true)
  }

  const input = 'ui-input'

  let body: React.ReactNode
  if (authLoading) {
    body = (
      <div className="flex justify-center py-6">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    )
  } else if (done) {
    body = (
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-success-soft flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={20} className="text-success" />
        </div>
        <h1 ref={focusOnMount} tabIndex={-1} className="font-display font-bold text-xl text-ink mb-2 focus:outline-none">Password updated</h1>
        <p role="status" className="font-sans text-ink-muted text-sm">You're signed in with your new password.</p>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="ui-btn ui-btn--primary mt-6 w-full"
        >
          Continue
        </button>
      </div>
    )
  } else if (!session) {
    body = (
      <div className="text-center">
        <h1 className="font-display font-bold text-xl text-ink mb-2">
          {linkFailed ? 'This link has expired' : "This link isn't valid"}
        </h1>
        <p role="alert" className="font-sans text-ink-muted text-sm">
          Reset links work once, for one hour. Ask for a new one and use the newest email.
        </p>
        <Link
          to="/forgot"
          className="ui-btn ui-btn--primary mt-6 w-full"
        >
          Send a new link
        </Link>
        <Link to="/login" className="mt-4 inline-block font-sans font-semibold text-sm text-ink hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  } else {
    body = (
      <>
        <h1 className="font-display font-bold text-2xl text-ink mb-1">Choose a new password</h1>
        <p className="font-sans text-ink-muted text-sm mb-6">
          For <strong className="text-ink">{session.user.email}</strong>. Use at least 8 characters.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="reset-password">New password</label>
            <input id="reset-password" type="password" autoComplete="new-password" required minLength={8} autoFocus
              value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ characters" className={input} />
          </div>
          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="reset-confirm">Type it again</label>
            <input id="reset-confirm" type="password" autoComplete="new-password" required minLength={8}
              value={confirm} onChange={e => setConfirm(e.target.value)} className={input} />
          </div>

          {error && (
            <p role="alert" className="text-danger text-sm font-sans flex items-center gap-1.5">
              <span>⚠</span> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="ui-btn ui-btn--primary w-full"
          >
            {saving
              ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
              : <KeyRound size={16} />}
            {saving ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-sm p-8">{body}</div>
      </main>
    </div>
  )
}
