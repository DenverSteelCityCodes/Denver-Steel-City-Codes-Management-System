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
import { registrationSign, seatTotals } from '../lib/registrationStatus'
import { formatCampTime } from '../lib/denverTime'

const h2 = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em]'

// Admin home. The sign answers "is registration open?"; To do lists what needs a person, most
// serious first; Seats shows every section's fill. Refreshes on tab focus and every minute.
export default function AdminDashboard() {
  const attention = useAdminAttention()
  const { classes, loading: classesLoading, error: classesError, fillError, refetch: refetchClasses } = useAdminClasses()
  const { sessions, loading: sessionsLoading } = useSessions()
  const { settings: season, loading: seasonLoading, error: seasonError, refetch: refetchSeason } =
    useSeasonSettings(sessionsLoading ? null : activeCampYear(sessions))
  const { configs, loading: formsLoading, error: formsError, refetch: refetchForms } = useFormConfigs()

  // The clock the sign reads (the opening countdown, the phase), ticking every 30 seconds.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // Skeletons only until the first load; refreshes keep what's on screen. "Updated" is the last
  // time everything read, so a failed read never looks fresh.
  const firstLoad = classesLoading || seasonLoading || formsLoading
  const anyError = !!(classesError || fillError || seasonError || formsError)
  const [loaded, setLoaded] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  if (!firstLoad && !loaded) {
    setLoaded(true)
    if (!anyError) setUpdatedAt(now)
  }

  // Hook refetchers are new functions every render; the focus listener reads the latest ones.
  const refetchers = useRef([attention.refetch, refetchClasses, refetchSeason, refetchForms])
  useEffect(() => { refetchers.current = [attention.refetch, refetchClasses, refetchSeason, refetchForms] })
  const refresh = useCallback(() => {
    // A refetcher resolves false when its read failed.
    void Promise.all(refetchers.current.map(fn => fn())).then(results => {
      const t = Date.now()
      setNow(t)
      if (results.every(ok => ok !== false)) setUpdatedAt(t)
    })
  }, [])
  useRefetchOnFocus(refresh, 60_000)

  const regForm = configs.find(c => c.form_key === 'student_registration')
  const sign = registrationSign({
    // A failed read is unknown, never open. After a good read, no row means the database doesn't
    // block on it (it only refuses when enabled is false).
    formEnabled: formsError ? null : regForm ? regForm.config.enabled !== false : true,
    opensAt: season?.registration_opens_at ?? null,
    openingUnknown: !!seasonError,
    seats: classesError || fillError ? null : seatTotals(classes.flatMap(c => c.sections)),
    updatedAt: updatedAt ? formatCampTime(updatedAt).replace(/\s?[AP]M$/, '') : null,
    now,
  })

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">Today</h1>

      <div className="mt-5">
        {loaded
          ? <SignBand {...sign} />
          : <div role="status" className="h-[172px] rounded bg-surface-sunken animate-pulse"><span className="sr-only">Loading registration status</span></div>}
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
              ? <SeatGrid classes={classes} weeks={campSessions(sessions)} countsMissing={!!fillError} error={classesError} />
              : <div aria-hidden="true" className="h-64 rounded bg-surface-sunken animate-pulse" />}
          </div>
        </section>
      </div>
    </div>
  )
}
