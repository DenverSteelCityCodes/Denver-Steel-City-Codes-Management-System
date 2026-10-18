// Loaner laptops (spec 29): one per camper-week, a cap per week, and a first-come queue past it.
// The database decides everything (migration_laptop_loans.sql); these helpers only word it.

import type { LaptopLoanStatus } from '../types/database'

// One row of my_laptop_loans(): a registration holding a seat (or with a loan), its loan status
// (null = never asked), its place in the queue, and whether it can still change online.
export interface MyLaptop {
  registration_id: string
  status: LaptopLoanStatus | null
  queue_position: number | null
  changes_open: boolean
}

// Shown before every request (spec 29: say what works, and that loaners stay on site).
export const LAPTOP_DEVICES = 'Any laptop or Chromebook with a web browser works, or an iPad with a keyboard.'
export const LAPTOP_ON_SITE = 'Loaners stay at camp.'

export type LaptopAction = 'request' | 'release' | 'leave'

// What a week's laptop line says on the camper card, its tone, and the one inline action.
export function laptopState(l: MyLaptop | undefined): { word: string; tone: 'ok' | 'wait' | 'plain'; action: LaptopAction | null } {
  const open = !!l?.changes_open
  switch (l?.status) {
    case 'reserved': return { word: 'Reserved', tone: 'ok', action: open ? 'release' : null }
    case 'queued': return { word: l.queue_position ? `In the queue (#${l.queue_position})` : 'In the queue', tone: 'wait', action: open ? 'leave' : null }
    case 'handed_out': return { word: 'Handed out', tone: 'ok', action: null }
    case 'returned': return { word: 'Returned', tone: 'plain', action: null }
    default: return { word: 'Not needed', tone: 'plain', action: open ? 'request' : null }
  }
}

// The crew's roster line: only reserved and handed-out loans reach it (section_roster()).
export function rosterLaptopLabel(loan: string | null | undefined): string | null {
  if (loan === 'reserved') return 'Loaner laptop to hand out'
  if (loan === 'handed_out') return 'Loaner laptop handed out'
  return null
}

// "Week 1", "Week 1 and Week 2", "Week 1, Week 2 and Week 3".
export function joinWeeks(weeks: string[]): string {
  return weeks.length <= 1 ? (weeks[0] ?? '') : `${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`
}

// What the wizard's last screen says about the laptop the parent asked for, one line per outcome.
export interface WizardLaptopResult {
  week: string
  outcome: 'reserved' | 'queued' | 'waitlisted' | 'failed'
  message?: string
}

export function wizardLaptopLines(camper: string, results: WizardLaptopResult[]): string[] {
  const weeks = (o: WizardLaptopResult['outcome']) => results.filter(r => r.outcome === o).map(r => r.week)
  const lines: string[] = []
  const reserved = weeks('reserved'), queued = weeks('queued'), waiting = weeks('waitlisted')
  if (reserved.length) lines.push(`A loaner laptop is reserved for ${camper} in ${joinWeeks(reserved)}. ${LAPTOP_ON_SITE}`)
  if (queued.length) lines.push(`Every loaner for ${joinWeeks(queued)} is spoken for, so ${camper} is in the laptop queue. We'll email you if one frees up.`)
  if (waiting.length) lines.push(`If ${camper} gets a spot in ${joinWeeks(waiting)}, ask for a laptop on Home.`)
  for (const f of results.filter(r => r.outcome === 'failed')) {
    lines.push(f.message ? `We couldn't ask for a laptop for ${f.week}: ${f.message}` : `We couldn't ask for a laptop for ${f.week}. You can ask on Home.`)
  }
  return lines
}
