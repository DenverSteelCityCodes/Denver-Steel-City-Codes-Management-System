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

// Row shape of the students → parent profile / registrations → section → class select.
interface RawStudent {
  id: string
  full_name: string
  age: number
  medical_info: string | null
  grade: string | null
  school_name: string | null
  allergies: string | null
  medical_conditions: string | null
  parent_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  registration_year: number | null
  created_at: string
  parent_id: string
  profiles: { display_name: string } | null
  registrations: {
    id: string
    status: RegistrationStatus
    section_id: string
    sections: { id: string; label: string; week: 1 | 2 | null; class_id: string; classes: { id: string; name: string } | null } | null
  }[] | null
}

export interface AdminStudent {
  id: string
  full_name: string
  age: number
  medical_info: string | null
  grade: string | null
  school_name: string | null
  allergies: string | null
  medical_conditions: string | null
  parent_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  registration_year: number | null
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
        grade, school_name, allergies, medical_conditions, parent_phone,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation, registration_year,
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

    const shaped: AdminStudent[] = ((data ?? []) as unknown as RawStudent[]).map(s => ({
      id: s.id,
      full_name: s.full_name,
      age: s.age,
      medical_info: s.medical_info,
      grade: s.grade,
      school_name: s.school_name,
      allergies: s.allergies,
      medical_conditions: s.medical_conditions,
      parent_phone: s.parent_phone,
      emergency_contact_name: s.emergency_contact_name,
      emergency_contact_phone: s.emergency_contact_phone,
      emergency_contact_relation: s.emergency_contact_relation,
      registration_year: s.registration_year,
      created_at: s.created_at,
      parent_id: s.parent_id,
      parent_name: s.profiles?.display_name ?? 'Unknown',
      registrations: (s.registrations ?? []).map(r => ({
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

    if (error) throw new Error(error.message)
    await fetchStudents()
  }

  async function moveStudentToSection(registrationId: string, newSectionId: string) {
    const { error } = await supabase
      .from('registrations')
      .update({ section_id: newSectionId, status: 'pending' })
      .eq('id', registrationId)

    if (error) throw new Error(error.message)
    await fetchStudents()
  }

  async function removeRegistration(registrationId: string) {
    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('id', registrationId)

    if (error) throw new Error(error.message)
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
