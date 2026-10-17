import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface AssignedStudent {
  id: string
  full_name: string
  age: number
  medical_info: string | null
  allergies: string | null
  medical_conditions: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  parent_phone: string | null
}

export interface AssignedSection {
  id: string
  label: string
  age_min: number
  age_max: number
  capacity: number
  week: 1 | 2 | null
  session_id: string | null
  days: string
  start_time: string | null
  end_time: string | null
  room: string | null
  class_id: string
  class_name: string
  students: AssignedStudent[]
}

// Row shape of the sections select used for both lead and support assignments.
interface RawSection {
  id: string
  label: string
  age_min: number
  age_max: number
  capacity: number
  week: 1 | 2 | null
  session_id: string | null
  days: string
  start_time: string | null
  end_time: string | null
  room: string | null
  class_id: string
  classes: { name: string } | null
}

const SECTION_COLS = 'id, label, age_min, age_max, capacity, week, session_id, days, start_time, end_time, room, class_id, classes ( name )'

export function useAssignedClass() {
  const { user } = useAuth()
  const [assignedSections, setAssignedSections] = useState<AssignedSection[]>([])
  const [isAccepted, setIsAccepted] = useState(false)
  // Latest application status, so a rejected applicant isn't told "under review" forever.
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchAssignedSections()
  }, [user])

  async function fetchAssignedSections() {
    setLoading(true)

    const [leadRes, supportRes, volunteerRes, appRes] = await Promise.all([
      // Sections where volunteer is the lead
      supabase
        .from('sections')
        .select(SECTION_COLS)
        .eq('lead_id', user!.id),
      // Section IDs where volunteer is a support
      supabase
        .from('section_supports')
        .select('section_id')
        .eq('volunteer_id', user!.id),
      supabase.from('volunteers').select('id').eq('id', user!.id).maybeSingle(),
      supabase.from('volunteer_applications').select('status')
        .eq('user_id', user!.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    setIsAccepted(!!volunteerRes.data)
    setApplicationStatus(appRes.data?.status ?? null)

    if (leadRes.error) { setError(leadRes.error.message); setLoading(false); return }
    if (supportRes.error) { setError(supportRes.error.message); setLoading(false); return }

    // Fetch full section data for support assignments, avoiding duplicates with lead sections
    const leadSections = (leadRes.data ?? []) as unknown as RawSection[]
    const leadIds = new Set(leadSections.map(s => s.id))
    const supportSectionIds = (supportRes.data ?? [])
      .map(r => r.section_id as string)
      .filter(id => !leadIds.has(id))

    let supportSections: RawSection[] = []
    if (supportSectionIds.length > 0) {
      const { data, error } = await supabase
        .from('sections')
        .select(SECTION_COLS)
        .in('id', supportSectionIds)
      if (error) { setError(error.message); setLoading(false); return }
      supportSections = (data ?? []) as unknown as RawSection[]
    }

    const allSections = [...leadSections, ...supportSections]

    if (allSections.length === 0) {
      setAssignedSections([])
      setLoading(false)
      return
    }

    const result: AssignedSection[] = await Promise.all(
      allSections.map(async sec => {
        const { data: regs } = await supabase
          .from('registrations')
          .select('students(id, full_name, age, medical_info, allergies, medical_conditions, emergency_contact_name, emergency_contact_phone, parent_phone)')
          .eq('section_id', sec.id)
          .in('status', ['confirmed', 'pending'])

        const students: AssignedStudent[] = (regs ?? [])
          .flatMap((r: { students: AssignedStudent | AssignedStudent[] | null }) =>
            Array.isArray(r.students) ? r.students : r.students ? [r.students] : []
          )

        return {
          id: sec.id,
          label: sec.label,
          age_min: sec.age_min,
          age_max: sec.age_max,
          capacity: sec.capacity,
          week: sec.week,
          session_id: sec.session_id,
          days: sec.days,
          start_time: sec.start_time,
          end_time: sec.end_time,
          room: sec.room,
          class_id: sec.class_id,
          class_name: sec.classes?.name ?? '',
          students,
        }
      })
    )

    setAssignedSections(result)
    setLoading(false)
  }

  return { assignedSections, isAccepted, applicationStatus, loading, error, refetch: fetchAssignedSections }
}
