// The camp year and its weeks, from the sessions table. Pure, so tests and helpers can use it
// without loading the Supabase client.
type YearSession = { year: number; is_active: boolean; start_date: string }

// The active camp year: the latest year with an active session (else this calendar year).
export function activeCampYear(sessions: YearSession[]): number {
  return sessions.filter(s => s.is_active).reduce((max, s) => Math.max(max, s.year), 0) ||
    new Date().getFullYear()
}

// That year's sessions in date order. Session N maps to sections.week = N (1 or 2), so hidden
// sessions keep their place: filtering them out here would renumber the weeks and offer Week 1's
// sections under Week 2. Callers that list sessions for sign-up skip the ones with !is_active.
export function campSessions<T extends YearSession>(sessions: T[]): T[] {
  const year = activeCampYear(sessions)
  return sessions
    .filter(s => s.year === year)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 2)
}
