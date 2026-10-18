import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { CAMP_TIME_ZONE, formatCampDateTime, timeUntil } from '../lib/denverTime'
import ParentSign from './ParentSign'

// "Registration opens Saturday, February 6 at 9:00 AM · in 3 days, 4 hours" (spec 13).
// Renders nothing once the opening has passed, and calls onOpen at that moment so the page can
// re-enable sign-ups without a reload. The database refuses early sign-ups regardless.
// `sign` renders it as parent Home's sign band (the one next decision before opening).
export default function RegistrationCountdown({ opensAt, onOpen, sign = false }: { opensAt: string | null | undefined; onOpen?: () => void; sign?: boolean }) {
  const target = opensAt ? new Date(opensAt).getTime() : 0
  const [now, setNow] = useState(() => Date.now())
  const open = !opensAt || now >= target

  useEffect(() => {
    if (open) return
    // Tick every second in the last minute, otherwise every 30 s.
    const remaining = target - now
    const id = window.setTimeout(() => {
      const t = Date.now()
      setNow(t)
      if (t >= target) onOpen?.()
    }, Math.max(250, Math.min(remaining, remaining < 60_000 ? 1000 : 30_000)))
    return () => window.clearTimeout(id)
  }, [now, open, target, onOpen])

  if (open || !opensAt) return null
  if (sign) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).formatToParts(new Date(opensAt))
    const time = parts.filter(p => p.type === 'hour' || p.type === 'minute' || p.type === 'literal').map(p => p.value).join('').trim()
    const period = parts.find(p => p.type === 'dayPeriod')?.value
    const day = new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(opensAt))
    return (
      <ParentSign
        id="opening"
        ctx={<>Registration opens {day} · Denver time</>}
        fig={{ value: time, unit: period }}
        msg={<>
          {/* Screen readers hear the time once a minute, not every tick (L6a). */}
          <span aria-hidden="true">Opens in {timeUntil(target - now)}</span>
          <span className="sr-only">Opens in {timeUntil(Math.ceil((target - now) / 60_000) * 60_000)}</span>
        </>}
        sub="Seats go first come, first served. Have each camper's grade, school, allergies and an emergency contact ready."
      />
    )
  }
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="bg-brand-soft border border-brand/30 rounded-xl px-4 sm:px-5 py-4 mb-6 flex items-start gap-3">
      <span aria-hidden="true" className="w-9 h-9 rounded-full bg-brand text-brand-on flex items-center justify-center shrink-0">
        <CalendarClock size={18} />
      </span>
      <div className="min-w-0">
        <p className="font-sans font-semibold text-ink">Registration opens {formatCampDateTime(opensAt)} (Denver time)</p>
        <p className="font-sans text-sm text-ink-muted">
          {/* Screen readers hear the time once a minute, not every tick (L6a). */}
          <span aria-hidden="true">In {timeUntil(target - now)}.</span>
          <span className="sr-only">In {timeUntil(Math.ceil((target - now) / 60_000) * 60_000)}.</span>
          {' '}Spots are first come, first served. You can add your campers now so you're ready.
        </p>
      </div>
    </div>
  )
}
