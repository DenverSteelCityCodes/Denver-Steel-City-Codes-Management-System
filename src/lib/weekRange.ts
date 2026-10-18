import { parseLocalDate } from './campDay'

// "Oct 19–23", or "Oct 29 – Nov 2" across a month: a camp week in a tab, a column head or a summary.
export function shortRange(start: string, end: string): string {
  const a = parseLocalDate(start), b = parseLocalDate(end)
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${month(a)} ${a.getDate()}–${b.getDate()}`
  return `${month(a)} ${a.getDate()} – ${month(b)} ${b.getDate()}`
}

// The Monday of the week a YYYY-MM-DD day falls in, as YYYY-MM-DD (for grouping days by week).
export function mondayOf(day: string): string {
  const d = parseLocalDate(day)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
