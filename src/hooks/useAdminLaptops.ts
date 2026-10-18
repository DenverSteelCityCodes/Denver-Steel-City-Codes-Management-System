import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { countBySession, type LaptopCounts } from '../lib/laptopLoans'
import type { LaptopLoanStatus } from '../types/database'

// Admin reads of loaner laptops (spec 29). Admins can read laptop_loans directly (RLS); every
// write goes through admin_set_laptop_status() (or the sessions cap, for the queue).

// Per-week counts for the Sessions page; null until the first load (so nothing reads "0 reserved"
// before the counts arrive).
export function useLaptopCounts(version: unknown) {
  const [counts, setCounts] = useState<Map<string, LaptopCounts> | null>(null)
  useEffect(() => {
    let alive = true
    void supabase
      .from('laptop_loans')
      .select('status, registrations!inner ( sections!inner ( session_id ) )')
      .in('status', ['reserved', 'handed_out', 'queued'])
      .then(({ data, error }) => {
        if (!alive || error) return
        const rows = (data ?? []) as unknown as { status: LaptopLoanStatus; registrations: { sections: { session_id: string | null } } }[]
        setCounts(countBySession(rows.map(r => ({ status: r.status, session_id: r.registrations?.sections?.session_id ?? null }))))
      })
    return () => { alive = false }
  }, [version])
  return counts
}

export interface HandoutLoan {
  registration_id: string
  status: LaptopLoanStatus
  requested_at: string
  section_id: string
  full_name: string
}

// One week's loans for the camp-day hand-out checklist.
async function fetchHandout(sessionId: string): Promise<{ loans: HandoutLoan[] } | { error: string }> {
  const { data, error } = await supabase
    .from('laptop_loans')
    .select('registration_id, status, requested_at, registrations!inner ( section_id, students ( full_name ), sections!inner ( session_id ) )')
    .eq('registrations.sections.session_id', sessionId)
    .in('status', ['reserved', 'handed_out', 'returned', 'queued'])
    .order('requested_at')
  if (error) return { error: error.message }
  return {
    loans: ((data ?? []) as unknown as {
      registration_id: string; status: LaptopLoanStatus; requested_at: string
      registrations: { section_id: string; students: { full_name: string } | null }
    }[]).map(l => ({
      registration_id: l.registration_id, status: l.status, requested_at: l.requested_at,
      section_id: l.registrations.section_id, full_name: l.registrations.students?.full_name ?? 'Camper',
    })),
  }
}

export function useLaptopHandout(sessionId: string | null) {
  const [loans, setLoans] = useState<HandoutLoan[]>([])
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((r: { loans: HandoutLoan[] } | { error: string }) => {
    if ('error' in r) setError(r.error)
    else { setError(null); setLoans(r.loans) }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    let alive = true
    void fetchHandout(sessionId).then(r => { if (alive) apply(r) })
    return () => { alive = false }
  }, [sessionId, apply])

  // Tick (handed out) or untick (back to reserved, undoing a mistaken tick).
  async function setHandedOut(registrationId: string, handedOut: boolean) {
    const { error: err } = await supabase.rpc('admin_set_laptop_status', {
      p_registration_id: registrationId, p_status: handedOut ? 'handed_out' : 'reserved',
    })
    if (err) throw new Error(err.message)
    if (sessionId) apply(await fetchHandout(sessionId))
  }

  return { loans, error, setHandedOut }
}
