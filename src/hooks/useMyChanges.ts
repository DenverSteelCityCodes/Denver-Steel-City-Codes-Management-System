import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A same-week class a held seat could switch to (spec 12), with live spots left.
export interface SwapOption {
  section_id: string
  class_name: string
  label: string
  week: number | null
  days: string | null
  start_time: string | null
  end_time: string | null
  room: string | null
  spots_left: number
}

// Parent self-service changes (spec 11): each registration's change deadline, cancelling a spot,
// and asking the camp for a change once online changes have closed.
export function useMyChanges(enabled: boolean) {
  const [deadlines, setDeadlines] = useState<Map<string, string>>(new Map())
  const [openRequests, setOpenRequests] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([
      supabase.rpc('my_change_deadlines'),
      supabase.from('change_requests').select('registration_id').eq('status', 'open'),
    ])
    return {
      deadlines: new Map(((d.data ?? []) as { registration_id: string; deadline: string | null }[])
        .filter(x => x.deadline).map(x => [x.registration_id, x.deadline as string])),
      open: new Set(((r.data ?? []) as { registration_id: string | null }[]).map(x => x.registration_id).filter((x): x is string => !!x)),
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void load().then(({ deadlines, open }) => { if (alive) { setDeadlines(deadlines); setOpenRequests(open) } })
    return () => { alive = false }
  }, [enabled, load])

  async function refresh() {
    const { deadlines, open } = await load()
    setDeadlines(deadlines)
    setOpenRequests(open)
  }

  async function cancelSpot(registrationId: string) {
    const { error } = await supabase.rpc('cancel_my_registration', { p_registration_id: registrationId })
    if (error) throw new Error(error.message)
    await refresh()
  }

  async function requestChange(registrationId: string, message: string) {
    const { error } = await supabase.rpc('request_change', { p_registration_id: registrationId, p_kind: 'other', p_message: message })
    if (error) throw new Error(error.message)
    await refresh()
  }

  // Waitlist offers (spec 10).
  async function acceptOffer(registrationId: string) {
    const { error } = await supabase.rpc('accept_offer', { p_registration_id: registrationId })
    if (error) throw new Error(error.message)
    await refresh()
  }
  async function declineOffer(registrationId: string) {
    const { error } = await supabase.rpc('decline_offer', { p_registration_id: registrationId })
    if (error) throw new Error(error.message)
    await refresh()
  }

  // Switching class within the same week (spec 12).
  async function swapOptions(registrationId: string): Promise<SwapOption[]> {
    const { data, error } = await supabase.rpc('my_swap_options', { p_registration_id: registrationId })
    if (error) throw new Error(error.message)
    return (data ?? []) as SwapOption[]
  }
  async function swapSpot(registrationId: string, sectionId: string) {
    const { error } = await supabase.rpc('swap_my_registration', { p_registration_id: registrationId, p_target_section_id: sectionId })
    if (error) throw new Error(error.message)
    await refresh()
  }

  return { deadlines, openRequests, cancelSpot, requestChange, acceptOffer, declineOffer, swapOptions, swapSpot }
}
