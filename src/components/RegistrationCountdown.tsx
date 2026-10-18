import { useEffect, useState } from 'react'
import { formatCampDateTime, timeUntil } from '../lib/denverTime'

// "Registration opens Saturday, February 6 at 9:00 AM · in 3 days, 4 hours" (spec 13).
// Renders nothing once the opening has passed, and calls onOpen at that moment so the page can
// re-enable sign-ups without a reload. The database refuses early sign-ups regardless.
export default function RegistrationCountdown({ opensAt, onOpen }: { opensAt: string | null | undefined; onOpen?: () => void }) {
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
  // A quiet sign (DESIGN.md › Sign Band, quiet): a 2px ink frame, so it never competes with the one
  // gold band on the page. Honest about what can be done before the opening: the details, not the class.
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="rounded border-2 border-ink p-4 mb-5">
      <p className="text-sm font-bold text-ink-muted">Registration opens (Denver time)</p>
      <p className="mt-1 text-[1.375rem] font-extrabold leading-[1.15] text-balance">{formatCampDateTime(opensAt)}</p>
      <p className="mt-1 text-ink-muted text-pretty">
        {/* Screen readers hear the time once a minute, not every tick (L6a). */}
        <span aria-hidden="true">In {timeUntil(target - now)}.</span>
        <span className="sr-only">In {timeUntil(Math.ceil((target - now) / 60_000) * 60_000)}.</span>
        {' '}Spots are first come, first served. You can fill in a new camper's details now and pick the class when it opens.
      </p>
    </div>
  )
}
