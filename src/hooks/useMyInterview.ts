import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface MyInterview {
  slot_id: string
  slot_datetime: string
  duration_minutes: number
}

// The signed-in applicant's own interview booking (RLS: volunteer_read_own_booking), plus a
// rebook action that goes through book_my_interview().
export function useMyInterview() {
  const { user } = useAuth()
  const [interview, setInterview] = useState<MyInterview | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('interview_bookings')
      .select('slot_id, slot:interview_slots ( slot_datetime, duration_minutes )')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const row = data as unknown as { slot_id: string; slot: { slot_datetime: string; duration_minutes: number } | null } | null
        setInterview(row?.slot ? { slot_id: row.slot_id, ...row.slot } : null)
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
