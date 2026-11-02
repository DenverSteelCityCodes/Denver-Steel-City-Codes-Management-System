// Volunteer service hours and their letters (spec B2). The database counts the minutes
// (migration_volunteer_hours.sql); this file words them, for the volunteer's Profile, the admin's
// Hours tab and the printed letter, so all three say the same number.

import { parseLocalDate } from './campDay'

// A row from my_volunteer_hours() / admin_volunteer_hours(): one volunteer's week.
export interface HoursWeek {
  session_id: string
  week_number: number
  session_name: string
  start_date: string
  end_date: string
  crew_days: number
  crew_minutes: number
  duty_minutes: number
  letter_ready: boolean
  letter_name: string
  has_legal_name: boolean
  signer_name: string | null
  signer_title: string | null
}

// admin_volunteer_hours(p_session_id) is already one week's rows, so it has no session_id.
export interface AdminHoursRow extends Omit<HoursWeek, 'session_id'> {
  volunteer_id: string
  display_name: string
  untimed_sections: number
}

export const totalMinutes = (w: Pick<HoursWeek, 'crew_minutes' | 'duty_minutes'>) => w.crew_minutes + w.duty_minutes

// Minutes as hours to the nearest quarter hour: 1950 → "32.5", 45 → "0.75", 0 → "0".
export function formatHours(minutes: number): string {
  const quarters = Math.round(minutes / 15)
  return String(quarters / 4)
}

export const hoursWord = (minutes: number) => `${formatHours(minutes)} ${formatHours(minutes) === '1' ? 'hour' : 'hours'}`

// "June 2–6, 2026", "June 29 – July 3, 2026", "Dec 29, 2026 – Jan 2, 2027".
export function formatWeekDates(start: string, end: string): string {
  const a = parseLocalDate(start)
  const b = parseLocalDate(end)
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'long' })
  if (a.getFullYear() !== b.getFullYear()) {
    const full = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    return `${full(a)} – ${full(b)}`
  }
  if (a.getMonth() === b.getMonth()) return `${month(a)} ${a.getDate()}–${b.getDate()}, ${b.getFullYear()}`
  return `${month(a)} ${a.getDate()} – ${month(b)} ${b.getDate()}, ${b.getFullYear()}`
}

// "November 1, 2026". A calendar date (a week's last day) is shown as it is; the date printed on
// a letter is today in Denver, the same "today" the hours were counted to.
export const letterDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
export const todayInDenver = (now: Date = new Date()) =>
  now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' })

// The certifying sentence, as on the 2026 hand-written letters.
export function letterSentence(w: HoursWeek): string {
  return `This is to certify that ${w.letter_name} has completed ${hoursWord(totalMinutes(w))} of service during `
    + `Week ${w.week_number} (${formatWeekDates(w.start_date, w.end_date)}) at Steel City Codes Denver.`
}
