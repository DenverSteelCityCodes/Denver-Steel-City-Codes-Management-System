import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface InterviewSlot {
  id: string
  slot_datetime: string
  duration_minutes: number
  notes: string | null
  created_at: string
  booking: InterviewBooking | null
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
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSlots() }, [])

  async function fetchSlots() {
    setLoading(true)
    const { data } = await supabase
      .from('interview_slots')
      .select(`
        *,
        booking:interview_bookings (
          id, slot_id, application_id, admin_notes, created_at,
          application:volunteer_applications ( first_name, last_name, email, status )
        )
      `)
      .order('slot_datetime', { ascending: true })

    setSlots(
      (data ?? []).map((s: any) => ({
        ...s,
        booking: Array.isArray(s.booking)
          ? (s.booking[0] ?? null)
          : (s.booking ?? null),
      }))
    )
    setLoading(false)
  }

  async function createSlot(payload: {
    slot_datetime: string
    duration_minutes?: number
    notes?: string
  }) {
    const { error } = await supabase.from('interview_slots').insert({
      slot_datetime: payload.slot_datetime,
      duration_minutes: payload.duration_minutes ?? 15,
      notes: payload.notes ?? null,
    })
    if (error) throw error
    await fetchSlots()
  }

  async function deleteSlot(id: string) {
    const { error } = await supabase.from('interview_slots').delete().eq('id', id)
    if (error) throw error
    setSlots(s => s.filter(x => x.id !== id))
  }

  async function bookSlot(slotId: string, applicationId: string, adminNotes?: string) {
    const { error } = await supabase.from('interview_bookings').insert({
      slot_id: slotId,
      application_id: applicationId,
      admin_notes: adminNotes ?? null,
    })
    if (error) throw error
    await supabase
      .from('volunteer_applications')
      .update({ interview_confirmed: true })
      .eq('id', applicationId)
    await fetchSlots()
  }

  async function unbookSlot(bookingId: string, applicationId: string) {
    const { error } = await supabase.from('interview_bookings').delete().eq('id', bookingId)
    if (error) throw error
    await supabase
      .from('volunteer_applications')
      .update({ interview_confirmed: false })
      .eq('id', applicationId)
    await fetchSlots()
  }

  async function updateNotes(bookingId: string, adminNotes: string) {
    const { error } = await supabase
      .from('interview_bookings')
      .update({ admin_notes: adminNotes })
      .eq('id', bookingId)
    if (error) throw error
    await fetchSlots()
  }

  return { slots, loading, createSlot, deleteSlot, bookSlot, unbookSlot, updateNotes, refetch: fetchSlots }
}
