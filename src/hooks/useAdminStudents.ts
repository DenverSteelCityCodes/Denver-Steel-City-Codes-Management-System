import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RegistrationStatus } from '../types/database'

export interface StudentRegistration {
  id: string
  status: RegistrationStatus
  section_id: string
  section_label: string
  section_week: 1 | 2 | null
  class_name: string
  class_id: string
}

export interface AdminStudent {
  id: string
  full_name: string
  age: number
  medical_info: string | null
  created_at: string
  parent_id: string
  parent_name: string
  registrations: StudentRegistration[]
}

export function useAdminStudents() {
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchStudents() }, [])

  async function fetchStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select(`
        id, full_name, age, medical_info, created_at, parent_id,
        profiles:parent_id ( display_name ),
        registrations (
          id, status, section_id,
          sections (
            id, label, week, class_id,
            classes ( id, name )
          )
        )
      `)
      .order('full_name', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const shaped: AdminStudent[] = (data ?? []).map((s: any) => ({
      id: s.id,
      full_name: s.full_name,
      age: s.age,
      medical_info: s.medical_info,
      created_at: s.created_at,
      parent_id: s.parent_id,
      parent_name: s.profiles?.display_name ?? 'Unknown',
      registrations: (s.registrations ?? []).map((r: any) => ({
        id: r.id,
        status: r.status,
        section_id: r.section_id,
        section_label: r.sections?.label ?? '—',
        section_week: r.sections?.week ?? null,
        class_name: r.sections?.classes?.name ?? '—',
        class_id: r.sections?.class_id ?? '',
      })),
    }))

    setStudents(shaped)
    setLoading(false)
  }

  async function updateRegistrationStatus(registrationId: string, status: RegistrationStatus) {
    const { error } = await supabase
      .from('registrations')
      .update({ status })
      .eq('id', registrationId)

    if (error) throw error
    await fetchStudents()
  }

  async function moveStudentToSection(registrationId: string, newSectionId: string) {
    const { error } = await supabase
      .from('registrations')
      .update({ section_id: newSectionId, status: 'pending' })
      .eq('id', registrationId)

    if (error) throw error
    await fetchStudents()
  }

  async function removeRegistration(registrationId: string) {
    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('id', registrationId)

    if (error) throw error
    await fetchStudents()
  }

  return {
    students,
    loading,
    error,
    updateRegistrationStatus,
    moveStudentToSection,
    removeRegistration,
    refetch: fetchStudents,
  }
}
