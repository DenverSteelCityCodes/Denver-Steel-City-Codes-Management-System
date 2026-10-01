import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Student, OnboardingConfirmation } from '../types/database'
import { gradeToAge } from '../lib/campers'

export function useStudents() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchStudents()
  }, [user])

  async function fetchStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', user!.id)
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setStudents(data ?? [])
    setLoading(false)
  }


  async function updateStudent(id: string, payload: Partial<Omit<Student, 'id' | 'parent_id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    setStudents(prev => prev.map(s => (s.id === id ? data : s)))
    return data
  }

  // Per-summer re-confirmation (#42): persist the reviewed/edited onboarding fields, re-sign the
  // waiver, and stamp registration_year to the active camp year — which is what unlocks session
  // registration for that year. Also mirrors medical_conditions into the legacy medical_info column.
  async function confirmOnboarding(id: string, fields: OnboardingConfirmation, campYear: number) {
    const { data, error } = await supabase
      .from('students')
      .update({
        ...fields,
        // Grade moves up each summer; age drives section eligibility, so keep them in step.
        ...(gradeToAge(fields.grade) ? { age: gradeToAge(fields.grade) } : {}),
        medical_info: fields.medical_conditions ?? null,
        registration_year: campYear,
        waiver_signed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    setStudents(prev => prev.map(s => (s.id === id ? data : s)))
    return data as Student
  }

  return { students, loading, error, updateStudent, confirmOnboarding, refetch: fetchStudents }
}
