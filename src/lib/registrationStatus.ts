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
