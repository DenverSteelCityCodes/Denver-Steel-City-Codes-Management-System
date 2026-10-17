import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BrandBar } from '../components/Wordmark'
import { focusOnMount } from '../lib/focus'

type Mode =
  | { kind: 'loading' }
  | { kind: 'verify'; factorId: string }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'error'; message: string }

// Two-step sign-in for admins (spec 27): set up an authenticator app the first time, then enter
// its 6-digit code after each password sign-in. MfaGate sends admins here; the database refuses
// admin data until the code is verified.
export default function MfaPage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
  const [mode, setMode] = useState<Mode>({ kind: 'loading' })
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
      if (error) { setMode({ kind: 'error', message: error.message }); return }
      const verified = data.totp.find(f => f.status === 'verified')
      if (verified) { setMode({ kind: 'verify', factorId: verified.id }); return }
      // Leftovers from an unfinished setup would block a new one.
      for (const f of data.all.filter(f => f.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data: en, error: enErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
      })
      if (!alive) return
      if (enErr || !en) { setMode({ kind: 'error', message: enErr?.message ?? 'Could not start the setup' }); return }
      setMode({ kind: 'enroll', factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret })
    })()
    return () => { alive = false }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode.kind !== 'verify' && mode.kind !== 'enroll') return
    const clean = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(clean)) { setErr('Enter the 6-digit code from your authenticator app.'); return }
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code: clean })
    setBusy(false)
    if (error) { setErr(/invalid|expired/i.test(error.message) ? "That code didn't work. Codes change every 30 seconds: try the current one." : error.message); setCode(''); return }
    navigate(next, { replace: true })
  }

  const input = 'w-full h-12 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-xl tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-brand'
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-sm p-8">
          <div className="w-12 h-12 rounded-full bg-role-admin-soft flex items-center justify-center mb-4">
            <ShieldCheck size={22} className="text-role-admin" aria-hidden="true" />
          </div>
          {mode.kind === 'loading' && <div className="h-40 bg-surface-sunken rounded-[10px] animate-pulse" />}
          {mode.kind === 'error' && (
            <>
              <h1 className="font-sans font-bold text-2xl text-ink mb-2">Two-step sign-in</h1>
              <p role="alert" className="font-sans text-sm text-danger mb-4">{mode.message}</p>
            </>
          )}
          {(mode.kind === 'verify' || mode.kind === 'enroll') && (
            <form onSubmit={submit} noValidate>
              <h1 ref={focusOnMount} tabIndex={-1} className="font-sans font-bold text-2xl text-ink mb-1 focus:outline-none">
                {mode.kind === 'enroll' ? 'Set up two-step sign-in' : 'Enter your code'}
              </h1>
              {mode.kind === 'enroll' ? (
                <>
                  <p className="font-sans text-sm text-ink-muted mb-4">
                    Admins can see every camper's medical details, so admin accounts need a second step. Scan this code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).
                  </p>
                  <img src={mode.qr} alt="QR code for your authenticator app" className="w-44 h-44 mx-auto bg-white p-2 rounded-[10px] border border-border" />
                  <p className="mt-3 font-sans text-xs text-ink-muted">
                    Can't scan? Enter this key in the app instead:{' '}
                    <code className="block mt-1 font-mono text-sm text-ink break-all select-all">{mode.secret}</code>
                  </p>
                </>
              ) : (
                <p className="font-sans text-sm text-ink-muted mb-4">Open your authenticator app and enter the 6-digit code for Steel City Codes.</p>
              )}
              <label htmlFor="mfa-code" className="block mt-4 mb-1 font-sans text-sm font-semibold text-ink">6-digit code</label>
              <input ref={inputRef} id="mfa-code" className={input} inputMode="numeric" autoComplete="one-time-code" maxLength={7}
                value={code} onChange={e => setCode(e.target.value)} aria-invalid={err ? true : undefined}
                aria-describedby={err ? 'mfa-error' : undefined} autoFocus={mode.kind === 'verify'} />
              {err && <p id="mfa-error" role="alert" className="mt-2 font-sans text-sm text-danger">{err}</p>}
              <button type="submit" disabled={busy}
                className="mt-4 w-full h-11 rounded-[10px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm transition disabled:opacity-50">
                {busy ? 'Checking…' : mode.kind === 'enroll' ? 'Turn on two-step sign-in' : 'Continue'}
              </button>
              <p className="mt-4 font-sans text-xs text-ink-muted">
                Lost your phone? Ask another admin to reset your two-step sign-in on the Users page.
              </p>
            </form>
          )}
          <button type="button" onClick={() => { void signOut() }}
            className="mt-6 font-sans font-semibold text-sm text-ink-muted hover:text-ink hover:underline">
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}
