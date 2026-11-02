import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { HoursWeek } from '../lib/volunteerHours'

// The signed-in volunteer's service hours, one row per week of this camp year they're crewed in or
// hold a duty in (spec B2). The database counts them: my_volunteer_hours().
export function useMyVolunteerHours() {
  const [weeks, setWeeks] = useState<HoursWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('my_volunteer_hours').then(({ data, error: err }) => {
      if (cancelled) return
      setError(err?.message ?? null)
      if (!err) setWeeks((data ?? []) as HoursWeek[])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [attempt])

  function retry() {
    setLoading(true)
    setAttempt(a => a + 1)
  }

  return { weeks, loading, error, retry }
}
