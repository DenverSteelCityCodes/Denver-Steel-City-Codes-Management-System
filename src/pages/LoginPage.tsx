import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Wordmark from '../components/Wordmark'
import Button from '../components/Button'
import { Input } from '../components/Field'
import PublicShell, { ContactLink, PageHead } from '../components/PublicShell'
import { FormError, FormField, Spinner } from '../components/PublicForm'
import { authErrorMessage, emailProblem } from '../lib/authErrors'
import { buttonClass } from '../lib/ui'
import { DEMO_ACCOUNTS, type DemoAccount } from '../lib/demo'

const PROFILE_FAILED = "Signed in, but your account couldn't be loaded. Check your connection and try again."
const NO_PROFILE = "Your account isn't set up yet. Email denver@steelcitycodes.org and we'll sort it out."

export default function LoginPage() {
  const { session, role, profileError, loading: authLoading, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [demoBusy, setDemoBusy] = useState<DemoAccount | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)

  // Demo mode: sign in as a prepared account with one click (no typing, no sign-up).
  async function signInDemo(account: DemoAccount) {
    setError(null)
    setDemoError(null)
    setDemoBusy(account)
    const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password })
    if (error) {
      setDemoError("That demo seat couldn't sign in. The demo may be mid-reset: try again in a minute.")
      setDemoBusy(null)
    }
    // AuthContext resolves the role and the redirect below takes over.
  }

  // Signed in but no usable profile: without this the button spins forever (role never arrives).
  // Sign back out and say why, next to whichever way in was used, so the page is usable again.
  useEffect(() => {
    if (!session || authLoading || role) return
    const message = profileError ? PROFILE_FAILED : NO_PROFILE
    const fromDemo = demoBusy !== null
    void signOut().then(() => {
      if (fromDemo) setDemoError(message)
      else setError(message)
      setDemoBusy(null)
      setLoading(false)
    })
  }, [session, authLoading, role, profileError, signOut, demoBusy])

  // Already signed in (or just signed in — AuthContext resolves the role) → go to that area.
  if (role) return <Navigate to={`/${role}`} replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const errs = {
      email: emailProblem(email) ?? undefined,
      password: password ? undefined : 'Enter your password.',
    }
    setFieldErrors(errs)
    if (errs.email || errs.password) {
      document.getElementById(errs.email ? 'email' : 'password')?.focus()
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(authErrorMessage(error))
      setLoading(false)
    }
    // AuthContext listener handles the redirect via role.
  }

  const demo = DEMO_ACCOUNTS.length > 0
  const busy = loading || demoBusy !== null

  const form = (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <FormField id="email" label="Email" error={fieldErrors.email}>
        {a => <Input {...a} type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />}
      </FormField>
      <FormField
        id="password"
        label="Password"
        error={fieldErrors.password}
        aside={<Link to="/forgot" className={buttonClass('text', '-my-2.5 font-semibold text-ink-muted hover:text-ink')}>Forgot password?</Link>}
      >
        {a => <Input {...a} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />}
      </FormField>
      {error && <FormError>{error}</FormError>}
      {/* One gold per view: with the demo sign on screen, Sign in is the ink button. */}
      <Button type="submit" variant={demo ? 'ink' : 'primary'} block disabled={busy}>
        {loading ? <><Spinner />Signing in…</> : 'Sign in'}
      </Button>
    </form>
  )

  const newHere = (
    <>
      <h2 className="mt-8 text-lg font-bold">New here?</h2>
      <div className="mt-3 grid gap-3">
        <Link to="/signup" className={buttonClass('secondary', undefined, true)}>Register a camper (parents)</Link>
        <Link to="/apply" className={buttonClass('secondary', undefined, true)}>Apply to volunteer</Link>
      </div>
      <p className="mt-3 text-ink-muted">When and where is camp? <Link to="/camp" className={buttonClass('text')}>Dates, place and classes</Link></p>
    </>
  )

  if (!demo) {
    return (
      <PublicShell>
        <div className="max-w-[400px]">
          <PageHead title="Sign in" />
          {form}
          {newHere}
        </div>
      </PublicShell>
    )
  }

  // Demo deploy: the junction. Four destinations on one gold sign, then sign-in with email.
  // From 1024px the page splits 5:7, with the sign on the ink column at left.
  return (
    <div className="min-h-dvh bg-bg text-ink lg:grid lg:grid-cols-[5fr_7fr]">
      <header className="bg-shell pt-[env(safe-area-inset-top)] dark:shadow-[inset_0_-1px_0_var(--border)] lg:col-start-1 lg:row-start-1 lg:self-start lg:z-10 lg:bg-transparent lg:dark:shadow-none">
        <div className="h-14 max-w-[640px] mx-auto px-4 md:px-8 flex items-center lg:max-w-none lg:h-24 lg:px-12">
          <Wordmark className="h-7 w-auto lg:h-11" />
        </div>
      </header>

      <main className="lg:col-start-1 lg:col-end-3 lg:row-start-1 lg:grid lg:grid-cols-[5fr_7fr] lg:min-h-dvh">
        <section aria-labelledby="demo-h" className="max-w-[640px] mx-auto px-4 md:px-8 pt-5 lg:max-w-none lg:mx-0 lg:px-12 lg:pt-32 lg:pb-12 lg:bg-shell lg:flex lg:flex-col lg:justify-center lg:dark:shadow-[inset_-1px_0_0_var(--border)]">
          <div className="grid gap-y-1 rounded bg-brand text-brand-on p-4 lg:p-6 [&_:focus-visible]:outline-brand-on">
            <h1 id="demo-h" className="text-[1.375rem] lg:text-[1.75rem] font-extrabold leading-[1.15] text-balance">Try the demo</h1>
            <p className="mt-1 text-brand-on-muted text-pretty">
              Explore a fictional summer camp from any seat. Nothing here is real, and the data resets every night.
            </p>
            {demoError && (
              <p role="alert" className="mt-2 flex gap-1.5 font-bold text-pretty">
                <CircleAlert size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5" />
                <span>{demoError}</span>
              </p>
            )}
            <ul className="mt-3 -mx-4 -mb-4 lg:mt-4 lg:-mx-6 lg:-mb-6 rounded-b overflow-hidden">
              {DEMO_ACCOUNTS.map(account => {
                const mine = demoBusy?.key === account.key
                return (
                  <li key={account.key}>
                    <button
                      type="button"
                      onClick={() => { void signInDemo(account) }}
                      disabled={busy}
                      aria-labelledby={`seat-${account.key}-name seat-${account.key}`}
                      className={`w-full grid grid-cols-[1fr_auto] items-center gap-4 min-h-[72px] px-4 py-3 lg:px-6 border-t-2 border-brand-on text-left transition-colors hover:enabled:bg-brand-hover focus-visible:-outline-offset-4 ${mine ? 'cursor-wait' : 'disabled:opacity-60 disabled:cursor-not-allowed'}`}
                    >
                      <span className="min-w-0">
                        <span id={`seat-${account.key}-name`} className="block text-lg font-extrabold leading-tight">
                          {mine ? <>Signing in as {account.label}…</> : account.label}
                        </span>{' '}
                        {/* The name is everything the seat shows, label first (WCAG 2.5.3), then what the tap does. */}
                        <span id={`seat-${account.key}`} className="block mt-0.5 text-brand-on-muted text-pretty">
                          {account.blurb}{!mine && <span className="sr-only"> Sign in.</span>}
                        </span>
                      </span>
                      <span aria-hidden="true" className="w-12 h-12 grid place-items-center rounded bg-shell text-brand">
                        {mine
                          ? <span className="w-6 h-6 rounded-full border-[3px] border-current border-t-transparent animate-spin" />
                          : <ArrowRight size={26} strokeWidth={2.5} />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p role="status" className="sr-only">{demoBusy ? `Signing in as ${demoBusy.label}…` : ''}</p>
          </div>
        </section>

        <section aria-labelledby="signin-h" className="max-w-[640px] mx-auto px-4 md:px-8 pt-8 pb-10 lg:max-w-none lg:mx-0 lg:p-12 lg:grid lg:place-items-center">
          <div className="w-full lg:max-w-[400px]">
            <h2 id="signin-h" className="mb-4 flex items-center gap-3 text-sm font-bold text-ink-muted after:flex-1 after:h-0.5 after:bg-ink lg:text-[1.375rem] lg:leading-tight lg:text-ink lg:after:hidden">
              <span className="lg:hidden">or sign in with email</span>
              <span className="hidden lg:inline">Sign in</span>
            </h2>
            {form}
            {newHere}
            <p className="mt-6 text-sm text-ink-muted">Questions? <ContactLink /></p>
          </div>
        </section>
      </main>
    </div>
  )
}
