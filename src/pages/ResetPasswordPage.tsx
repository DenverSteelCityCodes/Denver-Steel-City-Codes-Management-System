import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Button from '../components/Button'
import PublicShell, { PageHead } from '../components/PublicShell'
import { FormError, FormField, PasswordInput, Spinner } from '../components/PublicForm'
import { classifyAuthError, authMessage } from '../lib/authErrors'
import { focusOnMount } from '../lib/focus'
import { buttonClass } from '../lib/ui'

// The recovery link lands here as /reset#access_token=…&type=recovery (or #error=… when it has
// expired). supabase-js reads and clears the hash while the client initializes, so capture it at
// module load, which runs before that.
const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : ''
const linkFailed = /error_code=otp_expired|error=access_denied/.test(INITIAL_HASH)

type Errors = { password?: string; confirm?: string }

// Step 2 of a password reset. The link signs the user in with a short-lived recovery session;
// a signed-in user who opens /reset directly can also use it to change their password.
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const errs: Errors = {
      password: !password ? 'Choose a new password.' : password.length < 8 ? 'Use at least 8 characters.' : undefined,
      confirm: !confirm ? 'Type the same password again.' : confirm !== password ? "The two passwords don't match." : undefined,
    }
    setErrors(errs)
    if (errs.password || errs.confirm) {
      document.getElementById(errs.password ? 'reset-password' : 'reset-confirm')?.focus()
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      const kind = classifyAuthError(error)
      if (kind === 'same-password' || kind === 'weak-password' || kind === 'breached-password') {
        setErrors({ password: authMessage(kind) })
        document.getElementById('reset-password')?.focus()
      } else {
        setError(authMessage(kind))
      }
      return
    }
    setDone(true)
  }

  if (authLoading) {
    return (
      <PublicShell>
        <div role="status" className="flex items-center gap-3 py-6 text-ink-muted">
          <span aria-hidden="true" className="w-6 h-6 rounded-full border-[3px] border-ink border-t-transparent animate-spin" />
          Checking your link…
        </div>
      </PublicShell>
    )
  }

  if (done) {
    return (
      <PublicShell>
        <PageHead title="Password updated" lede="You're signed in with your new password." ledeRole="status" headingRef={focusOnMount} />
        <Button variant="primary" block onClick={() => navigate('/', { replace: true })}>Go to my account</Button>
      </PublicShell>
    )
  }

  if (!session) {
    return (
      <PublicShell>
        <PageHead
          title={linkFailed ? 'This link has expired' : "This link isn't valid"}
          lede="Reset links work once, for one hour. Ask for a new one and use the newest email."
          ledeRole="alert"
        />
        <Link to="/forgot" className={buttonClass('primary', undefined, true)}>Send a new link</Link>
        <p className="mt-4"><Link to="/login" className={buttonClass('text')}><ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" />Back to sign in</Link></p>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <PageHead
        title="Choose a new password"
        lede={<>For <strong className="text-ink [overflow-wrap:anywhere]">{session.user.email}</strong>. Use at least 8 characters.</>}
      />
      <form onSubmit={handleSubmit} noValidate className="grid gap-5">
        <FormField id="reset-password" label="New password" error={errors.password}>
          {a => <PasswordInput {...a} autoComplete="new-password" autoFocus value={password} onChange={e => setPassword(e.target.value)} />}
        </FormField>
        <FormField id="reset-confirm" label="Type it again" error={errors.confirm}>
          {a => <PasswordInput {...a} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />}
        </FormField>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" variant="primary" block disabled={saving}>
          {saving ? <><Spinner />Saving…</> : 'Save new password'}
        </Button>
      </form>
      <p className="mt-6"><Link to="/login" className={buttonClass('text')}><ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" />Back to sign in</Link></p>
    </PublicShell>
  )
}
