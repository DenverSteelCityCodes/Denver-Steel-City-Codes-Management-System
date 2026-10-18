import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCampInfo } from '../hooks/useCampInfo'
import PublicShell, { AsideLine, PageHead } from '../components/PublicShell'
import { FormError, FormField, Spinner } from '../components/PublicForm'
import { Input } from '../components/Field'
import Button from '../components/Button'
import SignBand from '../components/SignBand'
import RegistrationCountdown from '../components/RegistrationCountdown'
import NotifyMeSwitch from '../components/NotifyMeSwitch'
import { Schedule, Sect, StatusWord, framedCls, h2Cls, rowCls } from './parent/parts'
import { ageSpan, listNames, sameSchedule, weekDates } from '../lib/campInfo'
import type { CampCourse, CampInfo, CampWeek } from '../lib/campInfo'
import { ruleSummary } from '../lib/courseRules'
import { formatTimeRange } from '../lib/campDay'
import { CONTACT_EMAIL, GENERIC_ERROR, emailProblem } from '../lib/authErrors'
import { focusOnMount } from '../lib/focus'
import { buttonClass } from '../lib/ui'
import { DEMO_ACCOUNTS } from '../lib/demo'
import type { UserRole, ScheduleItem } from '../types/database'
import { LAPTOP_DEVICES, LAPTOP_ON_SITE } from '../lib/laptopLoans'

// The public camp page (spec 30): what a family asks before registering, answered from the
// database so it is always current: whether registration is open, the weeks with their dates,
// hours and place, the daily schedule, the classes with their ages, and a short FAQ. Signed-out
// visitors land here from /. Nothing on it is invented: every date, place, class and status comes
// from public_camp_info(), and the FAQ says only what the registration form and the camp-day
// tools already do.
// The demo (scc.haanie.com) shows a fictional camp, and its notify form never takes an address.
const DEMO = DEMO_ACCOUNTS.length > 0

// While the opening minute turns over: ask again every 5 seconds, at most 6 times.
const RECHECK_MS = 5000
const RECHECKS = 6

export default function CampPage() {
  const { info, error, loading, retry } = useCampInfo()
  const { session, role } = useAuth()
  const signedIn = !!session && !!role
  const barLink = 'min-h-11 inline-flex items-center px-1 font-bold text-on-shell underline underline-offset-[3px] hover:text-brand focus-visible:outline-brand!'

  // The opening time, as this page has seen it pass: from the countdown's onOpen, or already
  // behind us when the page loaded. Kept in state so the status slot never goes blank.
  const [loadedAt] = useState(() => Date.now())
  const [passed, setPassed] = useState(false)
  const [rechecks, setRechecks] = useState(0)
  const opens = info?.registration_opens_at ? new Date(info.registration_opens_at).getTime() : null
  const ahead = opens !== null && opens > loadedAt && !passed
  // The time has passed and classes exist, but the server hasn't said "open" yet.
  const waiting = info?.status === 'upcoming' && opens !== null && !ahead && info.courses.length > 0

  useEffect(() => {
    if (!waiting || rechecks >= RECHECKS) return
    const id = window.setTimeout(() => { setRechecks(n => n + 1); void retry() }, RECHECK_MS)
    return () => window.clearTimeout(id)
  }, [waiting, rechecks, retry])

  return (
    <PublicShell bar={signedIn
      ? <Link to="/" className={barLink}>Your account</Link>
      : <Link to="/login" className={barLink}>Sign in</Link>}>
      {info ? (
        <Camp info={info} role={role} signedIn={signedIn}
          opening={{ ahead, waiting, gaveUp: waiting && rechecks >= RECHECKS }}
          onOpen={() => { setPassed(true); void retry() }} />
      )
        : loading ? <Loading />
        : (
          <>
            <PageHead title="Coding camp" />
            <FormError actions={<button type="button" onClick={() => { void retry() }} className={buttonClass('text')}>Try again</button>}>
              {error ? "We couldn't load the camp details. Check your connection and try again." : GENERIC_ERROR}
            </FormError>
          </>
        )}
    </PublicShell>
  )
}

function Loading() {
  return (
    <div aria-busy="true" className="grid gap-4">
      <span className="sr-only" role="status">Loading the camp details…</span>
      <div className="h-9 w-2/3 rounded bg-surface-sunken animate-pulse" />
      <div className="h-5 w-full rounded bg-surface-sunken animate-pulse" />
      <div className="h-28 rounded bg-surface-sunken animate-pulse" />
      <div className="h-40 rounded bg-surface-sunken animate-pulse" />
    </div>
  )
}

interface Opening { ahead: boolean; waiting: boolean; gaveUp: boolean }

function Camp({ info, role, signedIn, opening, onOpen }: { info: CampInfo; role: UserRole | null; signedIn: boolean; opening: Opening; onOpen: () => void }) {
  const ages = ageSpan(info.courses)
  const notify = info.status === 'upcoming' || info.status === 'closed'
  return (
    <>
      <PageHead
        title={`Coding camp ${info.year}`}
        lede={`Free, week-long coding classes${ages ? ` for ages ${ages.min} to ${ages.max}` : ''}, taught by volunteers.`}
      />
      {DEMO && (
        <p className="-mt-2 mb-5 text-pretty">
          <strong>This is the demo.</strong> <span className="text-ink-muted">The camp, its dates and its classes are made up, and everything resets every night.</span>
        </p>
      )}
      <Status info={info} role={role} signedIn={signedIn} opening={opening} onOpen={onOpen} />
      {notify && <Notify parent={role === 'parent'} />}
      <Weeks weeks={info.weeks} />
      <Courses courses={info.courses} weekCount={info.weeks.length} />
      <Faq hasSchedule={info.weeks.some(w => w.schedule.length > 0)} />
      <div className="mt-10">
        <AsideLine>Want to teach coding? <Link to="/apply" className={buttonClass('text')}>Apply to volunteer</Link></AsideLine>
      </div>
    </>
  )
}

// ── Where registration stands: the one gold sign when there's something to do now ──

function Status({ info, role, signedIn, opening, onOpen }: { info: CampInfo; role: UserRole | null; signedIn: boolean; opening: Opening; onOpen: () => void }) {
  const opens = info.registration_opens_at
  const label = `Registration for ${info.year}`
  if (info.status === 'upcoming' && opens && opening.ahead) {
    return <RegistrationCountdown opensAt={opens} onOpen={onOpen}
      note={info.courses.length > 0 ? 'Spots are first come, first served.' : "Spots are first come, first served. The classes aren't posted yet."} />
  }
  if (opening.waiting) {
    return <Quiet live label={label} message="Registration is opening…"
      sub={opening.gaveUp ? 'This is taking longer than it should. Reload the page in a minute.' : 'This page updates by itself in a few seconds.'} />
  }
  if (info.status === 'upcoming') {
    return <Quiet label={label} message="Not open yet"
      sub={info.weeks.length === 0 ? "This year's dates aren't set yet."
        : opens ? "The classes aren't posted yet."
        : "The classes and the opening time aren't posted yet."} />
  }
  if (info.status === 'closed') {
    return <Quiet label={label} message="Closed right now"
      sub="The camp isn't taking new sign-ups. Families who registered keep their spots." />
  }

  // Open, or open with every class full. Parents go to their class list; visitors make an account.
  const full = info.status === 'waitlist_only'
  const to = !signedIn ? '/signup' : role === 'parent' ? '/parent/classes' : undefined
  const context = full ? 'Every class is full' : `Registration is open for ${info.year}`
  const message = full ? 'Join a waitlist' : role === 'parent' ? 'Pick a class' : 'Register a camper'
  const sub = full
    ? 'If a spot opens, the next family on the waitlist gets an email offer to claim it.'
    : `Spots are first come, first served.${!signedIn ? ' Make a parent account, then add your camper.' : ''}`
  return (
    <>
      {/* Named by its own text (context, message, sub), so the link's name matches what it shows. */}
      <SignBand context={context} message={message} sub={sub} to={to} />
      {!signedIn && <p className="mt-2 text-ink-muted">Registered before? <Link to="/login" className={buttonClass('text')}>Sign in</Link></p>}
    </>
  )
}

// A quiet sign (DESIGN.md › Sign Band, quiet): a 2px ink frame when there's nothing to do yet.
// `live` announces it (the opening minute's "Registration is opening…").
function Quiet({ label, message, sub, live = false }: { label: string; message: string; sub: string; live?: boolean }) {
  return (
    <div role={live ? 'status' : undefined} className="rounded border-2 border-ink p-4 mb-5">
      <p className="text-sm font-bold text-ink-muted">{label}</p>
      <p className="mt-1 text-[1.375rem] font-extrabold leading-[1.15] text-balance">{message}</p>
      <p className="mt-1 text-ink-muted text-pretty">{sub}</p>
    </div>
  )
}

// ── Notify me (double opt-in; signed-in parents get the switch instead) ──

function Notify({ parent }: { parent: boolean }) {
  return (
    <section aria-labelledby="notify-h" className="mt-6">
      <h2 id="notify-h" className={h2Cls}>Get an email when registration opens</h2>
      {parent ? <NotifyMeSwitch /> : <NotifyForm demo={DEMO} />}
    </section>
  )
}

function NotifyForm({ demo }: { demo: boolean }) {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (demo) return
    setError(null)
    const problem = emailProblem(email)
    setFieldError(problem)
    if (problem) { inputRef.current?.focus(); return }
    setBusy(true)
    const { error } = await supabase.rpc('join_interest_list', { p_email: email.trim() })
    setBusy(false)
    if (error) {
      // The database's own sentences (a bad address, a busy minute) name the fix.
      if (error.code === '22023') setFieldError(error.message)
      else setError(error.code === 'P0001' ? error.message : GENERIC_ERROR)
      inputRef.current?.focus()
      return
    }
    setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <div className="mt-3">
        <p ref={focusOnMount} tabIndex={-1} className="text-lg font-bold focus:outline-none">Check your inbox</p>
        <p className="mt-1 text-pretty">
          We sent a link to <strong className="[overflow-wrap:anywhere]">{sentTo}</strong>. Open it to confirm, and you're on the list.
          {' '}Already confirmed? Then you're set.
        </p>
        <button type="button" onClick={() => { setSentTo(null); setEmail('') }} className={buttonClass('text', 'text-ink-muted')}>Use a different email</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 grid gap-4">
      <p className="text-ink-muted text-pretty">
        First we send a link to confirm it's you. After that, one email with the opening time and one when registration opens. Each has an unsubscribe link.
      </p>
      <FormField id="notify-email" label="Email" error={fieldError}
        hint={demo ? "The demo doesn't collect email addresses, so this form is switched off." : undefined}>
        {a => <Input {...a} ref={inputRef} type="email" autoComplete="email" inputMode="email" value={email} disabled={demo} onChange={e => setEmail(e.target.value)} />}
      </FormField>
      {error && <FormError>{error}</FormError>}
      <Button type="submit" variant="primary" disabled={busy || demo} className="justify-self-start max-[479px]:w-full">
        {busy ? <><Spinner />Sending…</> : 'Notify me'}
      </Button>
    </form>
  )
}

// ── When and where ──

function Weeks({ weeks }: { weeks: CampWeek[] }) {
  if (weeks.length === 0) return null
  const withSchedule = weeks.filter(w => w.schedule.length > 0)
  const items = (w: CampWeek): ScheduleItem[] =>
    w.schedule.map((it, i) => ({ ...it, id: `${w.name}-${i}`, session_id: w.name, created_at: '' }))
  return (
    <>
      <Sect title="When and where" id="when-h">
        <ul className={framedCls}>
          {weeks.map(w => (
            <li key={w.name} className={`grid grid-cols-[6.5rem_1fr] gap-x-4 py-3 ${rowCls}`}>
              <span className="text-lg font-extrabold leading-snug tracking-[0.02em] break-words min-w-0">{w.name}</span>
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-snug">{weekDates(w.start_date, w.end_date)}</span>
                {w.starts && <span className="block">Classes {w.days ? `${w.days}, ` : ''}<span className="whitespace-nowrap">{formatTimeRange(w.starts, w.ends)}</span></span>}
                <span className="mt-1 flex items-start gap-1.5 text-ink-muted">
                  <MapPin size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-1" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{w.location || 'Place to be announced'}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Sect>
      {withSchedule.length > 0 && (sameSchedule(weeks)
        ? <Schedule items={items(withSchedule[0])} live={false} />
        : withSchedule.map(w => <Schedule key={w.name} items={items(w)} live={false} title={`A day at camp, ${w.name}`} />))}
    </>
  )
}

// ── Classes ──

function Courses({ courses, weekCount }: { courses: CampCourse[]; weekCount: number }) {
  if (courses.length === 0) return null
  return (
    <Sect title="Classes" id="classes-h">
      <ul className={framedCls}>
        {courses.map(c => {
          // The course's rules from the database, in the words the flyers use (spec 31).
          const note = [ruleSummary(c.grades_allowed, c.requires), c.requirement_note?.trim()].filter(Boolean).join(' ')
          const names = listNames(c.weeks.map(w => w.week))
          const full = c.weeks.filter(w => w.full)
          return (
            <li key={c.name} className={`py-4 ${rowCls}`}>
              <h3 className="text-lg font-bold leading-snug">{c.name}</h3>
              {c.description && <p className="mt-1 text-ink-muted text-pretty">{c.description}</p>}
              <p className="mt-2">
                Ages {c.age_min} to {c.age_max} · {c.weeks.length < weekCount ? `${names} only` : names}
              </p>
              {note && <p className="mt-1 text-pretty">{note}</p>}
              {full.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-2">
                  {full.map(w => <StatusWord key={w.week} tone="wait">{w.week} is full: waitlist open</StatusWord>)}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </Sect>
  )
}

// ── Good to know ──
// Each answer says only what the app already does: the registration form's laptop (spec 29) and
// lunch questions, the daily schedule above, and the three roll calls parents see on their dashboard.

function Faq({ hasSchedule }: { hasSchedule: boolean }) {
  const email = <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold underline underline-offset-[3px]">email us</a>
  const items: { q: string; a: ReactNode }[] = [
    { q: 'What does it cost?', a: 'Nothing. Camp is free.' },
    {
      q: 'Does my camper need a laptop?',
      a: <>Campers code on their own device. {LAPTOP_DEVICES} If yours doesn't have one, the camp lends a few loaners each week, first come first served: say so when you register, or ask on your Home page later. {LAPTOP_ON_SITE} Questions? {email}.</>,
    },
    {
      q: 'What about lunch?',
      a: 'There is a lunch break each day, so pack a lunch. If your camper gets free or reduced-price lunch at school, you can ask on the registration form for the camp to provide it.',
    },
    {
      q: 'How do drop-off and pickup work?',
      a: <>
        {hasSchedule ? 'The times are in "A day at camp" above. ' : "Drop-off and pickup times will be on this page once they're set. "}
        Volunteers take roll call when campers arrive, after lunch and at dismissal, and parents see each one on their dashboard.
        {' '}Running late or picking up early? Please {email}.
      </>,
    },
    { q: 'What should my camper bring?', a: "Their laptop, if they have one, and a packed lunch unless you've asked the camp to provide it." },
  ]
  return (
    <Sect title="Good to know" id="faq-h">
      <ul className={framedCls}>
        {items.map(({ q, a }) => (
          <li key={q} className={rowCls}>
            <details className="group">
              <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-[52px] py-2 flex items-center justify-between gap-3 font-bold">
                <span className="min-w-0 text-pretty">{q}</span>
                <ChevronDown size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-4 max-w-[65ch] text-pretty">{a}</p>
            </details>
          </li>
        ))}
      </ul>
    </Sect>
  )
}
