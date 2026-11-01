import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DutySettings, DutyShortfall, MyDutyWeek } from '../types/database'

export interface DutyType {
  id: string
  name: string
  description: string | null
  minutes: number
  created_at: string
}

export interface DutySlot {
  id: string
  duty_type_id: string
  session_id: string | null
  slot_date: string
  capacity: number
  locked: boolean
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchTypes() }, [])

  async function fetchTypes() {
    const { data, error } = await supabase.from('duty_types').select('*').order('name')
    setError(error?.message ?? null)
    if (!error) setTypes(data ?? [])
    setLoading(false)
  }

  async function createType(name: string, description?: string, minutes?: number) {
    const { error } = await supabase.from('duty_types').insert({ name, description: description || null, ...(minutes ? { minutes } : {}) })
    if (error) throw new Error(error.message)
    await fetchTypes()
  }

  async function setTypeMinutes(id: string, minutes: number) {
    const { error } = await supabase.from('duty_types').update({ minutes }).eq('id', id)
    if (error) throw new Error(error.message)
    setTypes(t => t.map(x => x.id === id ? { ...x, minutes } : x))
  }

  async function deleteType(id: string) {
    const { error } = await supabase.from('duty_types').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setTypes(t => t.filter(x => x.id !== id))
  }

  return { types, loading, error, createType, setTypeMinutes, deleteType, refetch: fetchTypes }
}

export function useDutySlots(sessionId?: string) {
  const [slots, setSlots] = useState<DutySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Only the latest request may write state, so a slow response for an old filter can't
  // overwrite the slots for the filter now selected.
  const latestRequest = useRef(0)

  useEffect(() => { fetchSlots() }, [sessionId])

  // After a write the list re-reads quietly, so the page doesn't swap to the loading skeleton
  // (and lose the focus) on every sign-up or assignment.
  async function fetchSlots(quiet = false) {
    const requestId = ++latestRequest.current
    if (!quiet) setLoading(true)
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

    const { data, error } = await q
    if (requestId !== latestRequest.current) return
    setError(error?.message ?? null)
    if (error) { setLoading(false); return }
    setSlots(
      ((data ?? []) as Omit<DutySlot, 'assigned_count'>[]).map(s => ({
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
    if (error) throw new Error(error.message)
    await fetchSlots(true)
  }

  async function deleteSlot(id: string) {
    const { error } = await supabase.from('duty_slots').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setSlots(s => s.filter(x => x.id !== id))
  }

  async function setSlotLocked(id: string, locked: boolean) {
    const { error } = await supabase.from('duty_slots').update({ locked }).eq('id', id)
    if (error) throw new Error(error.message)
    setSlots(s => s.map(x => x.id === id ? { ...x, locked } : x))
  }

  async function claimSlot(slotId: string, volunteerId: string) {
    const { error } = await supabase.from('duty_assignments').insert({ duty_slot_id: slotId, volunteer_id: volunteerId })
    if (error) throw new Error(error.message)
    await fetchSlots(true)
  }

  async function unclaimSlot(slotId: string, volunteerId: string) {
    const { error } = await supabase
      .from('duty_assignments')
      .delete()
      .eq('duty_slot_id', slotId)
      .eq('volunteer_id', volunteerId)
    if (error) throw new Error(error.message)
    await fetchSlots(true)
  }

  return { slots, loading, error, createSlot, deleteSlot, setSlotLocked, claimSlot, unclaimSlot, refetch: () => fetchSlots() }
}

// Every year's duty rules (specs 37, 38). A year without a row uses the defaults, like the database.
export const DEFAULT_DROP_LOCK_DAYS = 3
export const DUTY_SETTING_DEFAULTS = { drop_lock_days: DEFAULT_DROP_LOCK_DAYS, minutes_per_week: 0, signup_deadline_days: 7 }

export function useDutySettings() {
  const [rows, setRows] = useState<DutySettings[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchRows() }, [])

  async function fetchRows() {
    const { data } = await supabase.from('duty_settings').select('*')
    setRows(data ?? [])
    setLoading(false)
  }

  const forYear = (year: number) => rows.find(r => r.year === year)
  const lockDays = (year: number) => forYear(year)?.drop_lock_days ?? DEFAULT_DROP_LOCK_DAYS
  const rulesFor = (year: number) => ({ ...DUTY_SETTING_DEFAULTS, ...forYear(year) })

  // Admins only (RLS). Writes the whole row for the year.
  async function save(year: number, values: typeof DUTY_SETTING_DEFAULTS) {
    const { error } = await supabase.from('duty_settings').upsert({ year, ...values })
    if (error) throw new Error(error.message)
    await fetchRows()
  }

  return { rows, loading, forYear, lockDays, rulesFor, save, refetch: fetchRows }
}

// The signed-in volunteer's crewed weeks with a duty minimum (spec 38). Empty when there's none.
export function useMyDutyWeeks() {
  const [weeks, setWeeks] = useState<MyDutyWeek[]>([])

  useEffect(() => { fetchWeeks() }, [])

  async function fetchWeeks() {
    const { data } = await supabase.rpc('my_duty_weeks')
    setWeeks((data ?? []) as MyDutyWeek[])
  }

  return { weeks, refetch: fetchWeeks }
}

// Admins: who is under a week's duty minimum (spec 38).
export function useDutyShortfall(sessionId: string) {
  const [rows, setRows] = useState<DutyShortfall[]>([])
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)

  useEffect(() => { fetchRows() }, [sessionId])

  async function fetchRows() {
    const id = ++latest.current
    if (!sessionId) { setRows([]); return }
    const { data, error } = await supabase.rpc('admin_duty_shortfall', { p_session_id: sessionId })
    if (id !== latest.current) return
    setError(error?.message ?? null)
    setRows((data ?? []) as DutyShortfall[])
  }

  return { rows, error, refetch: fetchRows }
}
