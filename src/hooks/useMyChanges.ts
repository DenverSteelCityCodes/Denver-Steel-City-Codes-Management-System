import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A same-week class a held seat could switch to (spec 12), with live spots left. Classes the camper
// doesn't fit are listed too, with the reason (spec 31); rule_blocked means the class's own rules
// refuse them, so the family may ask for an exception. next_class_name feeds the repeat warning.
export interface SwapOption {
  section_id: string
  class_id: string
  class_name: string
  label: string
  week: number | null
  days: string | null
  start_time: string | null
  end_time: string | null
  room: string | null
  spots_left: number
  blocked_reason: string | null
  rule_blocked: boolean
  next_class_name: string | null
}

// "student:section" for an open exception request (spec 31).
export const exceptionKey = (studentId: string, sectionId: string) => `${studentId}:${sectionId}`

// Parent self-service changes (spec 11): each registration's change deadline, cancelling a spot,
// and asking the camp for a change once online changes have closed. Spec 31 adds exception
// requests (a class the camper doesn't qualify for) and the "place with" request.
export function useMyChanges(enabled: boolean) {
  const [deadlines, setDeadlines] = useState<Map<string, string>>(new Map())
  const [openRequests, setOpenRequests] = useState<Set<string>>(new Set())
  const [exceptions, setExceptions] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([
      supabase.rpc('my_change_deadlines'),
      supabase.from('change_requests').select('registration_id, kind, student_id, section_id').eq('status', 'open'),
    ])
    const rows = (r.data ?? []) as { registration_id: string | null; kind: string; student_id: string | null; section_id: string | null }[]
    return {
      deadlines: new Map(((d.data ?? []) as { registration_id: string; deadline: string | null }[])
        .filter(x => x.deadline).map(x => [x.registration_id, x.deadline as string])),
      open: new Set(rows.map(x => x.registration_id).filter((x): x is string => !!x)),
      exceptions: new Set(rows.filter(x => x.kind === 'exception' && x.student_id && x.section_id)
        .map(x => exceptionKey(x.student_id as string, x.section_id as string))),
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void load().then(({ deadlines, open, exceptions }) => {
      if (alive) { setDeadlines(deadlines); setOpenRequests(open); setExceptions(exceptions) }
    })
    return () => { alive = false }
  }, [enabled, load])

  async function refresh() {
    const { deadlines, open, exceptions } = await load()
    setDeadlines(deadlines)
    setOpenRequests(open)
    setExceptions(exceptions)
  }

  // Ask the camp to let a camper into a class its rules refuse (spec 31). Lands in the admins'
  // change-request queue as kind 'exception'.
  async function requestException(studentId: string, sectionId: string, message: string) {
    const { error } = await supabase.rpc('request_exception', { p_student_id: studentId, p_section_id: sectionId, p_message: message })
    if (error) throw new Error(error.message)
    await refresh()
  }

  // The family's "place with a friend or sibling" request, until the change deadline (spec 31).
  async function setPlaceWith(registrationId: string, placeWith: string) {
    const { error } = await supabase.rpc('set_place_with', { p_registration_id: registrationId, p_place_with: placeWith })
    if (error) throw new Error(error.message)
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

  // Switching class within the same week (spec 12), with the classes the camper doesn't fit (spec 31).
  async function swapOptions(registrationId: string): Promise<SwapOption[]> {
    const { data, error } = await supabase.rpc('my_swap_choices', { p_registration_id: registrationId })
    if (error) throw new Error(error.message)
    return (data ?? []) as SwapOption[]
  }
  async function swapSpot(registrationId: string, sectionId: string) {
    const { error } = await supabase.rpc('swap_my_registration', { p_registration_id: registrationId, p_target_section_id: sectionId })
    if (error) throw Object.assign(new Error(error.message), { hint: error.hint })
    await refresh()
  }

  return {
    deadlines, openRequests, exceptions, cancelSpot, requestChange, requestException, setPlaceWith,
    acceptOffer, declineOffer, swapOptions, swapSpot,
  }
}
