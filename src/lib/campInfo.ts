// The public camp page's data (public_camp_info(), migration_public_camp_page.sql, spec 30) and
// the pure helpers that word it. Kept apart from the page so the wording is testable.

export type CampStatus = 'upcoming' | 'open' | 'waitlist_only' | 'closed'

export interface CampScheduleItem {
  title: string
  start_time: string
  end_time: string | null
  location: string | null
}

export interface CampWeek {
  name: string
  start_date: string
  end_date: string
  location: string | null
  days: string | null
  starts: string | null
  ends: string | null
  schedule: CampScheduleItem[]
}

export interface CampCourse {
  name: string
  description: string | null
  age_min: number
  age_max: number
  weeks: { week: string; full: boolean }[]
}

export interface CampInfo {
  year: number
  status: CampStatus
  registration_opens_at: string | null
  weeks: CampWeek[]
  courses: CampCourse[]
}

const MONTH = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long' })
const DAY = (iso: string) => Number(iso.slice(8, 10))

// "June 8 – 12" · "June 29 – July 3" (dates are calendar dates, never shifted by time zone).
export function weekDates(start: string, end: string): string {
  if (start === end) return `${MONTH(start)} ${DAY(start)}`
  return MONTH(start) === MONTH(end)
    ? `${MONTH(start)} ${DAY(start)} – ${DAY(end)}`
    : `${MONTH(start)} ${DAY(start)} – ${MONTH(end)} ${DAY(end)}`
}

// "Week 1" · "Week 1 and Week 2" · "Week 1, Week 2 and Week 3"
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// The youngest and oldest ages any course takes, or null with no courses yet.
export function ageSpan(courses: Pick<CampCourse, 'age_min' | 'age_max'>[]): { min: number; max: number } | null {
  if (courses.length === 0) return null
  return { min: Math.min(...courses.map(c => c.age_min)), max: Math.max(...courses.map(c => c.age_max)) }
}

// True when every week runs the same daily schedule, so the page shows it once.
export function sameSchedule(weeks: Pick<CampWeek, 'schedule'>[]): boolean {
  const key = (w: Pick<CampWeek, 'schedule'>) =>
    JSON.stringify(w.schedule.map(i => [i.title, i.start_time, i.end_time, i.location]))
  return weeks.every(w => key(w) === key(weeks[0]))
}
