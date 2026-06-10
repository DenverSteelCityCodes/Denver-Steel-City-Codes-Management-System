import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface DutyType {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface DutySlot {
  id: string
  duty_type_id: string
  session_id: string | null
  slot_date: string
  capacity: number
  created_at: string
  duty_type?: { name: string }
  assignments?: DutyAssignment[]
  assigned_count: number
}

export interface DutyAssignment {
  id: string
  duty_slot_id: string
  volunteer_id: string
  created_at: string
  volunteer?: { profiles: { display_name: string } }
}

export function useDutyTypes() {
  const [types, setTypes] = useState<DutyType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTypes() }, [])

  async function fetchTypes() {
    const { data } = await supabase.from('duty_types').select('*').order('name')
    setTypes(data ?? [])
    setLoading(false)
  }

  async function createType(name: string, description?: string) {
    const { error } = await supabase.from('duty_types').insert({ name, description: description || null })
    if (error) throw error
    await fetchTypes()
  }

  async function deleteType(id: string) {
    const { error } = await supabase.from('duty_types').delete().eq('id', id)
    if (error) throw error
    setTypes(t => t.filter(x => x.id !== id))
  }

  return { types, loading, createType, deleteType, refetch: fetchTypes }
}

export function useDutySlots(sessionId?: string) {
  const [slots, setSlots] = useState<DutySlot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSlots() }, [sessionId])

  async function fetchSlots() {
    setLoading(true)
    let q = supabase
      .from('duty_slots')
      .select(`
        *,
        duty_type:duty_types ( name ),
        assignments:duty_assignments (
          id, volunteer_id,
          volunteer:volunteers ( profiles ( display_name ) )
        )
      `)
      .order('slot_date', { ascending: true })

    if (sessionId) q = q.eq('session_id', sessionId)

    const { data } = await q
    setSlots(
      (data ?? []).map((s: any) => ({
        ...s,
        assigned_count: s.assignments?.length ?? 0,
      }))
    )
    setLoading(false)
  }

  async function createSlot(payload: {
    duty_type_id: string
    session_id: string | null
    slot_date: string
    capacity: number
  }) {
    const { error } = await supabase.from('duty_slots').insert(payload)
    if (error) throw error
    await fetchSlots()
  }

  async function deleteSlot(id: string) {
    const { error } = await supabase.from('duty_slots').delete().eq('id', id)
    if (error) throw error
    setSlots(s => s.filter(x => x.id !== id))
  }

  async function claimSlot(slotId: string, volunteerId: string) {
    const { error } = await supabase.from('duty_assignments').insert({ duty_slot_id: slotId, volunteer_id: volunteerId })
    if (error) throw error
    await fetchSlots()
  }

  async function unclaimSlot(slotId: string, volunteerId: string) {
    const { error } = await supabase
      .from('duty_assignments')
      .delete()
      .eq('duty_slot_id', slotId)
      .eq('volunteer_id', volunteerId)
    if (error) throw error
    await fetchSlots()
  }

  return { slots, loading, createSlot, deleteSlot, claimSlot, unclaimSlot, refetch: fetchSlots }
}
