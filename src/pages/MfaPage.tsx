import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Button from '../components/Button'
import { Input } from '../components/Field'
import PublicShell, { PageHead } from '../components/PublicShell'
import { FieldError, Spinner } from '../components/PublicForm'
import { authErrorMessage, authMessage, classifyAuthError } from '../lib/authErrors'
import { focusOnMount } from '../lib/focus'
import { buttonClass } from '../lib/ui'

type Mode =
  | { kind: 'loading' }
  | { kind: 'verify'; factorId: string }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'error' }

// The setup's numbered steps: an outlined square, because the order carries meaning.
function StepNumber({ n }: { n: number }) {
  return <span aria-hidden="true" className="w-10 h-10 grid place-items-center border-2 border-ink rounded text-lg font-extrabold leading-none">{n}</span>
}

// Two-step sign-in for admins (spec 27): set up an authenticator app the first time, then enter
// its 6-digit code after each password sign-in. MfaGate sends admins here; the database refuses
// admin data until the code is verified.
export default function MfaPage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
  const [mode, setMode] = useState<Mode>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // A wrong code puts focus back in the field (the button was disabled while checking).
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (err) inputRef.current?.focus() }, [err])

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (!alive) return
      if (error) { setMode({ kind: 'error' }); return }
      const verified = data.totp.find(f => f.status === 'verified')
      if (verified) { setMode({ kind: 'verify', factorId: verified.id }); return }
      // Leftovers from an unfinished setup would block a new one.
      for (const f of data.all.filter(f => f.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data: en, error: enErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
      })
      if (!alive) return
      if (enErr || !en) { setMode({ kind: 'error' }); return }
      setMode({ kind: 'enroll', factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret })
    })()
    return () => { alive = false }
  }, [attempt])

  function retry() {
    setMode({ kind: 'loading' })
    setAttempt(a => a + 1)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode.kind !== 'verify' && mode.kind !== 'enroll') return
    const clean = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(clean)) { setErr('Enter the 6-digit code from your authenticator app.'); return }
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code: clean })
    setBusy(false)
    if (error) {
      setErr(classifyAuthError(error) === 'bad-code' || /invalid|expired/i.test(error.message) ? authMessage('bad-code') : authErrorMessage(error))
      setCode('')
      return
    }
    navigate(next, { replace: true })
  }

  const signOutLink = (
    <p className="mt-6">
      <button type="button" onClick={() => { void signOut() }} className={buttonClass('text', 'font-semibold text-ink-muted hover:text-ink')}>
        <LogOut size={16} strokeWidth={2.5} aria-hidden="true" />Sign out
      </button>
    </p>
  )

  if (mode.kind === 'loading') {
    return (
      <PublicShell>
        <PageHead title="Two-step sign-in" />
        <div role="status" aria-label="Getting two-step sign-in ready" className="h-44 w-44 rounded bg-surface-sunken animate-pulse" />
        {signOutLink}
      </PublicShell>
    )
  }

  if (mode.kind === 'error') {
    return (
      <PublicShell>
        <PageHead
          title="Two-step sign-in"
          lede="We couldn't start two-step sign-in. Check your connection and try again."
          ledeRole="alert"
          headingRef={focusOnMount}
        />
        <Button variant="primary" onClick={retry}>Try again</Button>
        {signOutLink}
      </PublicShell>
    )
  }

  const codeField = (labelText: React.ReactNode, hint: string) => (
    <>
      <label htmlFor="mfa-code" className="font-bold">{labelText}</label>
      <p id="mfa-code-hint" className="mt-1 text-sm text-ink-muted">{hint}</p>
      <Input
        ref={inputRef}
        id="mfa-code"
        className="mt-3 max-w-60 text-2xl font-bold tracking-[0.3em] text-center"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        value={code}
        onChange={e => setCode(e.target.value)}
        aria-invalid={err ? true : undefined}
        aria-describedby={['mfa-code-hint', err && 'mfa-error'].filter(Boolean).join(' ')}
        autoFocus={mode.kind === 'verify'}
      />
      {err && <div className="mt-2"><FieldError id="mfa-error" alert>{err}</FieldError></div>}
    </>
  )

  if (mode.kind === 'verify') {
    return (
      <PublicShell>
        <PageHead title="Enter your code" lede="Open your authenticator app and enter the 6-digit code for Steel City Codes." headingRef={focusOnMount} />
        <form onSubmit={submit} noValidate>
          {codeField('6-digit code', 'It changes every 30 seconds. Use the one on screen now.')}
          <Button type="submit" variant="primary" className="mt-5 w-full sm:w-auto sm:min-w-60" disabled={busy}>
            {busy ? <><Spinner />Checking…</> : 'Continue'}
          </Button>
        </form>
        <p className="mt-6 text-sm text-ink-muted">Lost your phone? Ask another admin to reset your two-step sign-in on the Users page.</p>
        {signOutLink}
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <PageHead
        title="Set up two-step sign-in"
        lede="Admins can see every camper's medical details, so admin accounts need a second step. It takes about a minute."
        headingRef={focusOnMount}
      />
      <form onSubmit={submit} noValidate>
        <ol className="border-b-2 border-ink">
          <li className="grid grid-cols-[40px_1fr] gap-x-4 py-4 border-t-2 border-ink">
            <StepNumber n={1} />
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug">Scan this code with an authenticator app</h2>
              <p className="mt-1 text-ink-muted">Google Authenticator, Microsoft Authenticator or 1Password all work.</p>
              <img src={mode.qr} alt="QR code for your authenticator app" className="mt-4 w-44 h-44 bg-white p-2 rounded border-2 border-ink" />
              <p className="mt-4 text-sm text-ink-muted">Can't scan? Enter this key in the app instead:</p>
              <code className="inline-block mt-2 px-3 py-2 bg-surface border border-border rounded font-mono font-semibold tracking-[0.06em] select-all [overflow-wrap:anywhere]">{mode.secret}</code>
            </div>
          </li>
          <li className="grid grid-cols-[40px_1fr] gap-x-4 py-4 border-t-2 border-ink">
            <StepNumber n={2} />
            <div className="min-w-0">
              {codeField(<span className="text-lg">Enter the 6-digit code the app shows</span>, 'It changes every 30 seconds. Use the one on screen now.')}
              <div className="mt-4">
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy ? <><Spinner />Checking…</> : 'Turn on two-step sign-in'}
                </Button>
              </div>
            </div>
          </li>
        </ol>
      </form>
      {signOutLink}
    </PublicShell>
  )
}
