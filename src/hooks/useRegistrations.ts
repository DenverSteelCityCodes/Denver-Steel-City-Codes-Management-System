import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Registration, RegistrationStatus } from '../types/database'

export interface RegistrationWithSection extends Registration {
  sections: {
    label: string
    age_min: number
    age_max: number
    capacity: number
    classes: { name: string }
  }
}

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
    const { data, error } = await supabase
      .from('registrations')
      .select(`
        *,
        students!inner(parent_id),
        sections ( label, age_min, age_max, capacity, classes ( name ) )
      `)
      .eq('students.parent_id', user!.id)
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setRegistrations((data ?? []) as RegistrationWithSection[])
    setLoading(false)
  }

  async function registerStudent(studentId: string, sectionId: string, currentCount: number, capacity: number) {
    const status: RegistrationStatus = currentCount >= capacity ? 'waitlisted' : 'pending'

    const { data, error } = await supabase
      .from('registrations')
      .insert({ student_id: studentId, section_id: sectionId, status })
      .select(`*, sections ( label, age_min, age_max, capacity, classes ( name ) )`)
      .single()

    if (error) throw new Error(error.message)
    setRegistrations(prev => [data as RegistrationWithSection, ...prev])
    return data as RegistrationWithSection
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
