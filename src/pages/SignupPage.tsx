import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Button from '../components/Button'
import { Input } from '../components/Field'
import SignBand from '../components/SignBand'
import PublicShell, { AsideLine, PageHead } from '../components/PublicShell'
import { FieldError, FormError, FormField, PasswordInput, Spinner } from '../components/PublicForm'
import { authErrorMessage, emailProblem, isExistingAccount } from '../lib/authErrors'
import { focusOnMount } from '../lib/focus'
import { buttonClass } from '../lib/ui'

type Errors = { displayName?: string; email?: string; password?: string }

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  // The email already has an account: said under the field, with the two ways back in.
  const [existing, setExisting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  // Resend cooldown in seconds (0 = the button is available).
  const [resendIn, setResendIn] = useState(0)
  const [resendNote, setResendNote] = useState<string | null>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = window.setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendIn])

  async function resend() {
    setResendNote(null)
    setResendIn(60)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    setResendNote(error ? "We couldn't resend it just now. Try again in a minute." : 'Sent again. Check your inbox and spam folder.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExisting(false)
    const errs: Errors = {
      displayName: displayName.trim() ? undefined : 'Enter your name.',
      email: emailProblem(email) ?? undefined,
      password: !password ? 'Choose a password.' : password.length < 8 ? 'Use at least 8 characters.' : undefined,
    }
    setErrors(errs)
    const first = (['displayName', 'email', 'password'] as const).find(k => errs[k])
    if (first) { document.getElementById(first)?.focus(); return }

    setLoading(true)
    // Profile is created server-side by the handle_new_user trigger.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim(), role: 'parent' }, emailRedirectTo: `${window.location.origin}/login` },
    })
    setLoading(false)

    if (isExistingAccount(data?.user, signUpError)) {
      setExisting(true)
      document.getElementById('email')?.focus()
      return
    }
    if (signUpError) {
      const message = authErrorMessage(signUpError)
      if (/password/i.test(message)) { setErrors({ password: message }); document.getElementById('password')?.focus() }
      else setError(message)
      return
    }
    setSuccess(true)
    setResendIn(60)
  }

  if (success) {
    return (
      <PublicShell>
        <PageHead title="Check your email" headingRef={focusOnMount} />
        <div role="status">
          <SignBand
            context={<>We sent a confirmation link to <span className="[overflow-wrap:anywhere]">{email.trim()}</span></>}
            message="Open the link in that email"
            sub="It brings you back here to sign in. Then you'll add your campers."
          />
        </div>
        <div className="mt-6 grid gap-1">
          <p>Didn't get it? Check your spam folder first.</p>
          <p>
            <button
              type="button"
              onClick={() => { void resend() }}
              disabled={resendIn > 0}
              className={buttonClass('text', 'disabled:text-ink-muted disabled:no-underline')}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend the email'}
            </button>
          </p>
          <p role="status" className="text-sm text-ink-muted">{resendNote}</p>
          <p><Link to="/login" className={buttonClass('text')}><ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" />Back to sign in</Link></p>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <PageHead title="Create a parent account" lede="You'll add your campers after you sign in." />
      <form onSubmit={handleSubmit} noValidate className="grid gap-5">
        <FormField id="displayName" label="Your name" hint="Parent or guardian" error={errors.displayName}>
          {a => <Input {...a} type="text" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} />}
        </FormField>
        <FormField id="email" label="Email" error={errors.email}>
          {a => (
            <>
              <Input
                {...a}
                aria-invalid={a['aria-invalid'] ?? (existing || undefined)}
                aria-describedby={[a['aria-describedby'], existing && 'email-existing'].filter(Boolean).join(' ') || undefined}
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setExisting(false) }}
              />
              {existing && (
                <div role="alert" className="grid gap-0.5">
                  <FieldError id="email-existing">There's already an account with this email.</FieldError>
                  <p className="flex flex-wrap gap-x-5 pl-[22px]">
                    <Link to="/login" className={buttonClass('text')}>Sign in</Link>
                    <Link to="/forgot" className={buttonClass('text')}>Reset your password</Link>
                  </p>
                </div>
              )}
            </>
          )}
        </FormField>
        <FormField id="password" label="Password" hint="At least 8 characters" error={errors.password}>
          {a => <PasswordInput {...a} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />}
        </FormField>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" variant="primary" block disabled={loading}>
          {loading ? <><Spinner />Creating account…</> : 'Create account'}
        </Button>
      </form>

      <div className="mt-6">
        <AsideLine>Already have an account? <Link to="/login" className={buttonClass('text')}>Sign in</Link></AsideLine>
        <AsideLine>Volunteering instead? <Link to="/apply" className={buttonClass('text')}>Apply to volunteer</Link></AsideLine>
      </div>
    </PublicShell>
  )
}
