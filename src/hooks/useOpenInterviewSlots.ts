import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface OpenSlot {
  id: string
  slot_datetime: string
  duration_minutes: number
}

// Open interview times (future, unbooked) from the open_interview_slots() RPC — works signed out.
export function useOpenInterviewSlots() {
  const [slots, setSlots] = useState<OpenSlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('open_interview_slots').then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(error.message)
      else setSlots((data ?? []) as OpenSlot[])
    })
    return () => { cancelled = true }
  }, [version])

  return { slots, error, refetch: () => setVersion(v => v + 1) }
}

export function formatSlot(iso: string) {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
