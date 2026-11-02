import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AdminHoursRow } from '../lib/volunteerHours'

export function useAdminVolunteerHours(sessionId: string | null) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    sessionId: string
    attempt: number
    rows: AdminHoursRow[]
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (sessionId === null) return
    const requestedSessionId = sessionId
    let cancelled = false

    async function load() {
      try {
        const { data, error } = await supabase.rpc('admin_volunteer_hours', { p_session_id: requestedSessionId })
        if (!cancelled) setResult({ sessionId: requestedSessionId, attempt, rows: error ? [] : (data ?? []) as AdminHoursRow[], error: error?.message ?? null })
      } catch (error) {
        if (!cancelled) setResult({ sessionId: requestedSessionId, attempt, rows: [], error: error instanceof Error ? error.message : 'Couldn\'t load the hours.' })
      }
    }

    void load()
    return () => { cancelled = true }
  }, [sessionId, attempt])

  // A different week or retry must never show the previous request's rows or print links.
  const current = sessionId !== null && result?.sessionId === sessionId && result.attempt === attempt ? result : null
  return {
    rows: current?.rows ?? [],
    loading: sessionId !== null && current === null,
    error: current?.error ?? null,
    refetch: () => setAttempt(a => a + 1),
  }
}
