import { useCallback, useEffect, useRef, useState } from 'react'
import SignBand from '../components/SignBand'
import AdminNeedsAttention from '../components/AdminNeedsAttention'
import SeatGrid from '../components/SeatGrid'
import { useAdminAttention } from '../hooks/useAdminAttention'
import { useAdminClasses } from '../hooks/useAdminClasses'
import { useSessions, activeCampYear, campSessions } from '../hooks/useSessions'
import { useSeasonSettings } from '../hooks/useSeasonSettings'
import { useFormConfigs } from '../hooks/useFormConfigs'
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus'
import { registrationPhase, seatTotals } from '../lib/registrationStatus'
import type { SeatTotals } from '../lib/registrationStatus'
import { formatCampDay, formatCampTime, isSameCampDay, timeUntil } from '../lib/denverTime'

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const join = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(' · ')

interface SignContent {
  context: string
  figure: string | number
  unit?: string
  message: string
  sub: string
  to: string
  label: string
}

// What the sign says in each phase (issue #171): "Opens Sat, Feb 6 · 7:00 PM (Denver)" /
// "Open since 7:00 PM · seats left · taken · waitlisted · Updated h:mm" / "Closed".
function registrationSign({ formEnabled, opensAt, openingUnknown, seats, updated, now }: {
  formEnabled: boolean
  opensAt: string | null
  openingUnknown: boolean     // the season settings didn't load
  seats: SeatTotals | null    // null when the seat counts didn't load
  updated: string | null
  now: number
}): SignContent {
  const phase = registrationPhase(formEnabled, opensAt, now)
  const at = (iso: string) => (isSameCampDay(iso, now) ? formatCampTime(iso) : `${formatCampDay(iso)}, ${formatCampTime(iso)}`)

  if (phase === 'closed') {
    const wontOpen = opensAt && new Date(opensAt).getTime() > now
      ? `It won't open on ${formatCampDay(opensAt)} at ${formatCampTime(opensAt)} until you turn it on in Sessions`
      : null
    const sub = join([wontOpen ?? (seats && `${count(seats.taken, 'seat')} taken · ${seats.waitlisted} waitlisted`), updated])
    return {
      context: 'Registration',
      figure: 'Closed',
      message: "Families can't register or join a waitlist",
      sub,
      to: '/admin/sessions',
      label: `Registration is closed. Families can't register or join a waitlist. ${sub}. Open it in Sessions.`,
    }
  }

  if (phase === 'scheduled' && opensAt) {
    const [clock, period] = formatCampTime(opensAt).split(' ')
    const day = isSameCampDay(opensAt, now) ? 'today' : formatCampDay(opensAt)
    const until = timeUntil(new Date(opensAt).getTime() - now)
    const sub = join([seats && `${count(seats.seatsLeft, 'seat')} ready in ${count(seats.sections, 'section')}`, updated])
    return {
      context: `Registration opens ${day} · Denver time`,
      figure: clock,
      unit: period,
      message: `Opens in ${until}`,
      sub,
      to: '/admin/sessions',
      label: `Registration opens ${day} at ${clock} ${period}, Denver time, in ${until}. ${sub}. Change the opening time in Sessions.`,
    }
  }

  const context = openingUnknown
    ? "Registration form is on · the opening time didn't load"
    : opensAt ? `Registration open since ${at(opensAt)}` : 'Registration is open'
  if (!seats) {
    const sub = join(["They'll load again when you come back to this tab", updated])
    return {
      context, figure: 'Open', message: "Seat counts didn't load", sub, to: '/admin/classes',
      label: `${context}. Seat counts didn't load. ${sub}. Open Classes.`,
    }
  }
  const message = seats.seatsLeft === 0
    ? 'seats left. Every section is full'
    : `${seats.seatsLeft === 1 ? 'seat' : 'seats'} left in ${count(seats.withSeats, 'section')}`
  const sub = join([`${count(seats.taken, 'seat')} taken`, `${seats.waitlisted} waitlisted`, updated])
  return {
    context, figure: seats.seatsLeft, message, sub, to: '/admin/classes',
    label: `${context}. ${seats.seatsLeft} ${message}. ${sub}. Open Classes to see every section.`,
  }
}

const h2 = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em]'

// Admin home. The sign answers "is registration open?"; To do lists what needs a person, most
// serious first; Seats shows every section's fill. Refreshes on tab focus and every minute.
export default function AdminDashboard() {
  const attention = useAdminAttention()
  const { classes, loading: classesLoading, fillError, refetch: refetchClasses } = useAdminClasses()
  const { sessions, loading: sessionsLoading } = useSessions()
  const { settings: season, loading: seasonLoading, error: seasonError, refetch: refetchSeason } =
    useSeasonSettings(sessionsLoading ? null : activeCampYear(sessions))
  const { configs, loading: formsLoading, refetch: refetchForms } = useFormConfigs()

  // The clock the sign reads (the opening countdown, the phase), ticking every 30 seconds.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // Skeletons only until the first load; refreshes keep what's on screen.
  const firstLoad = classesLoading || seasonLoading || formsLoading
  const [loaded, setLoaded] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  if (!firstLoad && !loaded) {
    setLoaded(true)
    setUpdatedAt(now)
  }

  // Hook refetchers are new functions every render; the focus listener reads the latest ones.
  const refetchers = useRef([attention.refetch, refetchClasses, refetchSeason, refetchForms])
  useEffect(() => { refetchers.current = [attention.refetch, refetchClasses, refetchSeason, refetchForms] })
  const refresh = useCallback(() => {
    void Promise.all(refetchers.current.map(fn => fn())).then(() => {
      const t = Date.now()
      setNow(t)
      setUpdatedAt(t)
    })
  }, [])
  useRefetchOnFocus(refresh, 60_000)

  const regForm = configs.find(c => c.form_key === 'student_registration')
  const sign = registrationSign({
    // No row means the database doesn't block on it (it only refuses when enabled is false).
    formEnabled: regForm ? regForm.config.enabled !== false : true,
    opensAt: season?.registration_opens_at ?? null,
    openingUnknown: !!seasonError,
    seats: fillError ? null : seatTotals(classes.flatMap(c => c.sections)),
    updated: updatedAt ? `Updated ${formatCampTime(updatedAt).replace(/\s?[AP]M$/, '')}` : null,
    now,
  })

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">Today</h1>

      <div className="mt-5">
        {loaded
          ? <SignBand {...sign} />
          : <div role="status" className="h-[172px] md:h-[188px] rounded bg-surface-sunken animate-pulse"><span className="sr-only">Loading registration status</span></div>}
      </div>

      <div className="mt-10 grid items-start gap-10 xl:grid-cols-[3fr_2fr] xl:gap-8">
        <section aria-labelledby="todo-heading" className="min-w-0">
          <h2 id="todo-heading" className={h2}>To do</h2>
          <div className="mt-3">
            <AdminNeedsAttention items={attention.items} loading={attention.loading} />
          </div>
        </section>

        <section aria-labelledby="seats-heading" className="min-w-0">
          <h2 id="seats-heading" className={h2}>Seats</h2>
          <p className="mt-2 text-sm text-ink-muted">Full sections show their waitlist. Select a section to open its class.</p>
          <div className="mt-3">
            {loaded
              ? <SeatGrid classes={classes} weeks={campSessions(sessions)} countsMissing={!!fillError} />
              : <div aria-hidden="true" className="h-64 rounded bg-surface-sunken animate-pulse" />}
          </div>
        </section>
      </div>
    </div>
  )
}
