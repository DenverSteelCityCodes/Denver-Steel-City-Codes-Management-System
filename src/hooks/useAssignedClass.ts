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

    const [sectionsRes, volunteerRes] = await Promise.all([
      supabase
        .from('sections')
        .select(`id, label, age_min, age_max, capacity, week, class_id, classes ( name )`)
        .or(`lead_id.eq.${user!.id},support_id.eq.${user!.id}`),
      supabase.from('volunteers').select('id').eq('id', user!.id).maybeSingle(),
    ])

    setIsAccepted(!!volunteerRes.data)

    if (sectionsRes.error || !sectionsRes.data?.length) {
      setAssignedSections([])
      setLoading(false)
      if (sectionsRes.error) setError(sectionsRes.error.message)
      return
    }

    const result: AssignedSection[] = await Promise.all(
      sectionsRes.data.map(async (sec: any) => {
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
