import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface MyInterview {
  slot_id: string
  slot_datetime: string
  duration_minutes: number
  // "Tuesday, October 20 at 4:00 PM" (Denver) and the slot's meeting link, only for the booked
  // applicant (spec 35; the links table itself is admin-only).
  denver_time?: string | null
  meeting_url?: string | null
}

// The signed-in applicant's own interview time (my_interview() RPC — applicants can't read
// interview_bookings directly, it holds admin notes), plus a rebook action that goes through
// book_my_interview().
export function useMyInterview() {
  const { user } = useAuth()
  const [interview, setInterview] = useState<MyInterview | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .rpc('my_interview')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setInterview((data as MyInterview | null) ?? null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [user, version])

  async function book(slotId: string) {
    const { error } = await supabase.rpc('book_my_interview', { p_slot_id: slotId })
    if (error) throw new Error(error.message)
    setVersion(v => v + 1)
  }

  return { interview, loading, book }
}
