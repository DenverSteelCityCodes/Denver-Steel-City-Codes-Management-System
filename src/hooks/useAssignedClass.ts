import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface AssignedStudent {
  id: string
  full_name: string
  age: number
  medical_info: string | null
}

export interface AssignedSection {
  id: string
  label: string
  age_min: number
  age_max: number
  capacity: number
  week: 1 | 2 | null
  class_id: string
  class_name: string
  students: AssignedStudent[]
}

export function useAssignedClass() {
  const { user } = useAuth()
  const [assignedSections, setAssignedSections] = useState<AssignedSection[]>([])
  const [isAccepted, setIsAccepted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchAssignedSections()
  }, [user])

  async function fetchAssignedSections() {
    setLoading(true)

    const [leadRes, supportRes, volunteerRes] = await Promise.all([
      // Sections where volunteer is the lead
      supabase
        .from('sections')
        .select(`id, label, age_min, age_max, capacity, week, class_id, classes ( name )`)
        .eq('lead_id', user!.id),
      // Section IDs where volunteer is a support
      supabase
        .from('section_supports')
        .select('section_id')
        .eq('volunteer_id', user!.id),
      supabase.from('volunteers').select('id').eq('id', user!.id).maybeSingle(),
    ])

    setIsAccepted(!!volunteerRes.data)

    if (leadRes.error) { setError(leadRes.error.message); setLoading(false); return }
    if (supportRes.error) { setError(supportRes.error.message); setLoading(false); return }

    // Fetch full section data for support assignments, avoiding duplicates with lead sections
    const leadIds = new Set((leadRes.data ?? []).map((s: any) => s.id))
    const supportSectionIds = (supportRes.data ?? [])
      .map((r: any) => r.section_id as string)
      .filter(id => !leadIds.has(id))

    let supportSections: any[] = []
    if (supportSectionIds.length > 0) {
      const { data, error } = await supabase
        .from('sections')
        .select(`id, label, age_min, age_max, capacity, week, class_id, classes ( name )`)
        .in('id', supportSectionIds)
      if (error) { setError(error.message); setLoading(false); return }
      supportSections = data ?? []
    }

    const allSections = [...(leadRes.data ?? []), ...supportSections]

    if (allSections.length === 0) {
      setAssignedSections([])
      setLoading(false)
      return
    }

    const result: AssignedSection[] = await Promise.all(
      allSections.map(async (sec: any) => {
        const { data: regs } = await supabase
          .from('registrations')
          .select('students(id, full_name, age, medical_info)')
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
          class_id: sec.class_id,
          class_name: (sec.classes as { name: string })?.name ?? '',
          students,
        }
      })
    )

    setAssignedSections(result)
    setLoading(false)
  }

  return { assignedSections, isAccepted, loading, error, refetch: fetchAssignedSections }
}
