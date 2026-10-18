import { formatCampDay, formatCampTime, isSameCampDay, timeUntil } from './denverTime'

// Whether parents can register right now, read the way the database decides it
// (register_student trigger, migration_one_class_per_week.sql): the camper registration form must
// be on, and a scheduled opening time, if any, must have passed.

export type RegistrationPhase = 'closed' | 'scheduled' | 'open'

export function registrationPhase(formEnabled: boolean, opensAt: string | null | undefined, now: number): RegistrationPhase {
  if (!formEnabled) return 'closed'
  if (opensAt && new Date(opensAt).getTime() > now) return 'scheduled'
  return 'open'
}

interface SectionSeats {
  capacity: number
  registered_count: number
  waitlist_count: number
  cancelled_at?: string | null
}

export interface SeatTotals {
  sections: number       // sections taking sign-ups (cancelled ones are left out)
  withSeats: number      // of those, how many still have a free seat
  seatsLeft: number
  taken: number          // seats held (confirmed + pending)
  waitlisted: number
}

// Season-wide seat counts from the per-section fill (section_fill_counts()).
export function seatTotals(sections: SectionSeats[]): SeatTotals {
  const live = sections.filter(s => !s.cancelled_at)
  let seatsLeft = 0, withSeats = 0, taken = 0, waitlisted = 0
  for (const s of live) {
    const left = Math.max(0, s.capacity - s.registered_count)
    seatsLeft += left
    if (left > 0) withSeats++
    taken += s.registered_count
    waitlisted += s.waitlist_count
  }
  return { sections: live.length, withSeats, seatsLeft, taken, waitlisted }
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const join = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(' · ')

export interface SignContent {
  context: string
  figure?: string | number
  unit?: string
  message: string
  sub: string
  to: string
  label: string
}

// What the sign says in each phase (issue #171): "Opens Sat, Feb 6 · 7:00 PM (Denver)" /
// "Open since 7:00 PM · seats left · taken · waitlisted · Updated h:mm" / "Closed" — and, when
// the switch or the opening time couldn't be read, that it couldn't check, never a guess.
export function registrationSign({ formEnabled, opensAt, openingUnknown, seats, updatedAt, now }: {
  formEnabled: boolean | null // null when the registration form's settings couldn't be read
  opensAt: string | null
  openingUnknown: boolean     // the season settings (opening time) couldn't be read
  seats: SeatTotals | null    // null when the seat counts couldn't be read
  updatedAt: string | null    // "7:14", the last refresh where everything read
  now: number
}): SignContent {
  if (formEnabled === null || (formEnabled && openingUnknown)) {
    const sub = join(['It tries again when you come back to this tab', updatedAt && `Last updated ${updatedAt}`])
    return {
      context: 'Registration',
      message: "Couldn't check whether registration is open",
      sub,
      to: '/admin/sessions',
      label: `Couldn't check whether registration is open. ${sub}. Open Sessions to see the switch.`,
    }
  }
  const updated = updatedAt && `Updated ${updatedAt}`
  const phase = registrationPhase(formEnabled, opensAt, now)
  const at = (iso: string) => (isSameCampDay(iso, now) ? formatCampTime(iso) : `${formatCampDay(iso)}, ${formatCampTime(iso)}`)

  if (phase === 'closed') {
    const wontOpen = !openingUnknown && opensAt && new Date(opensAt).getTime() > now
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
