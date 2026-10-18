import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface InterviewSlot {
  id: string
  slot_datetime: string
  duration_minutes: number
  notes: string | null
  created_at: string
  booking: InterviewBooking | null
  // The slot's private meeting link (interview_slot_links, admin-only; spec 35).
  meeting_url: string | null
}

export interface InterviewBooking {
  id: string
  slot_id: string
  application_id: string
  admin_notes: string | null
  created_at: string
  application?: {
    first_name: string
    last_name: string
    email: string
    status: string
  } | null
}

export function useInterviews() {
  const [slots, setSlots] = useState<InterviewSlot[]>([])
  // True only until the first load finishes: refetches (after adding or booking a slot) keep the
  // list mounted, so an open notes editor or half-filled booking isn't thrown away.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchSlots() }, [])

  async function fetchSlots() {
    const { data, error } = await supabase
      .from('interview_slots')
      .select(`
        *,
        booking:interview_bookings (
          id, slot_id, application_id, admin_notes, created_at,
          application:volunteer_applications ( first_name, last_name, email, status )
        ),
        link:interview_slot_links ( meeting_url )
      `)
      .order('slot_datetime', { ascending: true })

    setError(error?.message ?? null)
    if (error) { setLoading(false); return }
    setSlots(
      ((data ?? []) as unknown as (Omit<InterviewSlot, 'booking' | 'meeting_url'> & {
        booking: InterviewBooking | InterviewBooking[] | null
        link: { meeting_url: string } | { meeting_url: string }[] | null
      })[]).map(({ link, ...s }) => ({
        ...s,
        booking: Array.isArray(s.booking)
          ? (s.booking[0] ?? null)
          : (s.booking ?? null),
        meeting_url: (Array.isArray(link) ? link[0] : link)?.meeting_url ?? null,
      }))
    )
    setLoading(false)
  }

  async function createSlot(payload: {
    slot_datetime: string
    duration_minutes?: number
    notes?: string
    meeting_url?: string
  }) {
    const { data, error } = await supabase.from('interview_slots').insert({
      slot_datetime: payload.slot_datetime,
      duration_minutes: payload.duration_minutes ?? 15,
      notes: payload.notes ?? null,
    }).select('id').single()
    if (error) throw new Error(error.message)
    if (payload.meeting_url) {
      const { error: linkError } = await supabase.from('interview_slot_links').insert({ slot_id: data.id, meeting_url: payload.meeting_url })
      if (linkError) { await fetchSlots(); throw new Error(`The slot was added, but its link wasn't saved: ${linkError.message}`) }
    }
    await fetchSlots()
  }

  // Set or clear a slot's meeting link (spec 35). Only the applicant booked into it sees it.
  async function setLink(slotId: string, url: string | null) {
    const { error } = url
      ? await supabase.from('interview_slot_links').upsert({ slot_id: slotId, meeting_url: url })
      : await supabase.from('interview_slot_links').delete().eq('slot_id', slotId)
    if (error) throw new Error(error.message)
    await fetchSlots()
  }

  async function deleteSlot(id: string) {
    const { error } = await supabase.from('interview_slots').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setSlots(s => s.filter(x => x.id !== id))
  }

  async function bookSlot(slotId: string, applicationId: string, adminNotes?: string) {
    const { error } = await supabase.from('interview_bookings').insert({
      slot_id: slotId,
      application_id: applicationId,
      admin_notes: adminNotes ?? null,
    })
    if (error) throw new Error(error.message)
    await fetchSlots()
  }

  async function unbookSlot(bookingId: string) {
    const { error } = await supabase.from('interview_bookings').delete().eq('id', bookingId)
    if (error) throw new Error(error.message)
    await fetchSlots()
  }

  async function updateNotes(bookingId: string, adminNotes: string) {
    const { error } = await supabase
      .from('interview_bookings')
      .update({ admin_notes: adminNotes })
      .eq('id', bookingId)
    if (error) throw new Error(error.message)
    await fetchSlots()
  }

  return { slots, loading, error, createSlot, deleteSlot, bookSlot, unbookSlot, updateNotes, setLink, refetch: fetchSlots }
}
