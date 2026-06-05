import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Registration, RegistrationStatus } from '../types/database'

export interface RegistrationWithClass extends Registration {
  classes: { name: string; age_group: string; capacity: number }
}

export function useRegistrations() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState<RegistrationWithClass[]>([])
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
        classes(name, age_group, capacity)
      `)
      .eq('students.parent_id', user!.id)
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setRegistrations((data ?? []) as RegistrationWithClass[])
    setLoading(false)
  }

  async function registerStudent(studentId: string, classId: string, currentCount: number, capacity: number) {
    const status: RegistrationStatus = currentCount >= capacity ? 'waitlisted' : 'pending'

    const { data, error } = await supabase
      .from('registrations')
      .insert({ student_id: studentId, class_id: classId, status })
      .select(`*, classes(name, age_group, capacity)`)
      .single()

    if (error) throw new Error(error.message)
    setRegistrations(prev => [data as RegistrationWithClass, ...prev])
    return data as RegistrationWithClass
  }

  function isRegistered(studentId: string, classId: string) {
    return registrations.some(
      r => r.student_id === studentId && r.class_id === classId
    )
  }

  return { registrations, loading, error, registerStudent, isRegistered, refetch: fetchRegistrations }
}
