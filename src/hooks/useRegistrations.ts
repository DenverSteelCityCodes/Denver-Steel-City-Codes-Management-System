import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Registration, RegistrationStatus } from '../types/database'

export interface RegistrationWithSection extends Registration {
  sections: {
    class_id: string
    label: string
    age_min: number
    age_max: number
    capacity: number
    week: number | null
    session_id: string | null
    days: string
    start_time: string | null
    end_time: string | null
    room: string | null
    classes: { name: string }
  }
}

// Every column a client may read (spec 31): place_with is withheld from direct reads, so the crew
// can't see a family's placement request; the parent's own come from my_place_with().
const REG_COLUMNS = 'id, student_id, section_id, status, year, cancelled_at, cancel_reason, cancelled_by, displaced_from_section, offered_at, offer_expires_at, created_at'
const SECTION_SELECT = 'sections ( class_id, label, age_min, age_max, capacity, week, session_id, days, start_time, end_time, room, classes ( name ) )'

export function useRegistrations() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState<RegistrationWithSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchRegistrations()
  }, [user])

  async function fetchRegistrations() {
    setLoading(true)
    const [{ data, error }, placed] = await Promise.all([
      supabase
        .from('registrations')
        .select(`${REG_COLUMNS}, students!inner(parent_id), ${SECTION_SELECT}`)
        .eq('students.parent_id', user!.id)
        .order('created_at', { ascending: false }),
      supabase.rpc('my_place_with'),
    ])
    const placeWith = new Map(((placed.data ?? []) as { registration_id: string; place_with: string }[]).map(p => [p.registration_id, p.place_with]))

    if (error) setError(error.message)
    else setRegistrations(((data ?? []) as unknown as RegistrationWithSection[]).map(r => ({ ...r, place_with: placeWith.get(r.id) ?? null })))
    setLoading(false)
  }

  async function registerStudent(studentId: string, sectionId: string, currentCount: number, capacity: number) {
    // The database decides the status (confirmed, or waitlisted when full); this is only a hint.
    const status: RegistrationStatus = currentCount >= capacity ? 'waitlisted' : 'confirmed'

    const { data, error } = await supabase
      .from('registrations')
      .insert({ student_id: studentId, section_id: sectionId, status })
      .select(`${REG_COLUMNS}, ${SECTION_SELECT}`)
      .single()

    // Keep the database's hint: 'course_rule' means the family may ask for an exception (spec 31).
    if (error) throw Object.assign(new Error(error.message), { hint: error.hint })
    setRegistrations(prev => [data as unknown as RegistrationWithSection, ...prev])
    return data as unknown as RegistrationWithSection
  }

  function isRegistered(studentId: string, sectionId: string) {
    return registrations.some(
      r => r.student_id === studentId && r.section_id === sectionId
    )
  }

  function getRegistration(studentId: string, sectionId: string) {
    return registrations.find(
      r => r.student_id === studentId && r.section_id === sectionId
    ) ?? null
  }

  return { registrations, loading, error, registerStudent, isRegistered, getRegistration, refetch: fetchRegistrations }
}
