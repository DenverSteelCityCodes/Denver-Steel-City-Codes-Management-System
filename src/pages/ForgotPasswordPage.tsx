import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Button from '../components/Button'
import { Input } from '../components/Field'
import SignBand from '../components/SignBand'
import PublicShell, { AsideLine, PageHead } from '../components/PublicShell'
import { FormError, FormField, Spinner } from '../components/PublicForm'
import { classifyAuthError, authMessage, emailProblem } from '../lib/authErrors'
import { focusOnMount } from '../lib/focus'
import { buttonClass } from '../lib/ui'

// Step 1 of a password reset: email a recovery link that lands on /reset.
// Always shows the same confirmation, so this page never reveals whether an email has an account.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const problem = emailProblem(email)
    setEmailError(problem)
    if (problem) { document.getElementById('forgot-email')?.focus(); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    })
    setLoading(false)
    // Rate limits and network failures are worth saying; "no such user" is not (Supabase doesn't
    // report it either).
    const kind = classifyAuthError(error)
    if (error && (kind === 'rate-limit' || kind === 'network')) {
      setError(kind === 'rate-limit' ? "We couldn't send the link just now. Wait a minute and try again." : authMessage(kind))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <PublicShell>
        <PageHead title="Check your email" headingRef={focusOnMount} />
        <div role="status">
          <SignBand
            context={<>If <span className="break-all">{email.trim()}</span> has an account</>}
            message="We've sent a link to choose a new password"
            sub="It works once, for one hour. If you ask again, use the newest email."
          />
        </div>
        <div className="mt-6 grid gap-1">
          <p>Nothing arrived? Check your spam folder first.</p>
          <p><button type="button" onClick={() => setSent(false)} className={buttonClass('text')}>Try again</button></p>
          <p><Link to="/login" className={buttonClass('text')}><ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" />Back to sign in</Link></p>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <PageHead title="Forgot your password?" lede="Enter your email and we'll send you a link to choose a new one." />
      <form onSubmit={handleSubmit} noValidate className="grid gap-5">
        <FormField id="forgot-email" label="Email" error={emailError}>
          {a => (
            <Input {...a} type="email" autoComplete="email" inputMode="email" autoFocus
              value={email} onChange={e => setEmail(e.target.value)} />
          )}
        </FormField>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" variant="primary" block disabled={loading}>
          {loading ? <><Spinner />Sending…</> : 'Send reset link'}
        </Button>
      </form>
      <div className="mt-6">
        <AsideLine>Remembered it? <Link to="/login" className={buttonClass('text')}>Sign in</Link></AsideLine>
      </div>
    </PublicShell>
  )
}
