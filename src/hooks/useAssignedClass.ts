import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface AssignedStudent {
  id: string
  full_name: string
  age: number
  medical_info: string | null
}

export interface AssignedClass {
  id: string
  name: string
  age_group: string
  capacity: number
  students: AssignedStudent[]
}

export function useAssignedClass() {
  const { user } = useAuth()
  const [assignedClass, setAssignedClass] = useState<AssignedClass | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchAssignedClass()
  }, [user])

  async function fetchAssignedClass() {
    setLoading(true)

    // Find class where this volunteer is lead or support
    const { data: cls, error: clsError } = await supabase
      .from('classes')
      .select('id, name, age_group, capacity')
      .or(`lead_id.eq.${user!.id},support_id.eq.${user!.id}`)
      .single()

    if (clsError || !cls) {
      setAssignedClass(null)
      setLoading(false)
      return
    }

    // Fetch enrolled students via registrations
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('students(id, full_name, age, medical_info)')
      .eq('class_id', cls.id)
      .in('status', ['confirmed', 'pending'])

    if (regError) { setError(regError.message); setLoading(false); return }

    const students: AssignedStudent[] = (registrations ?? [])
      .flatMap((r: { students: AssignedStudent | AssignedStudent[] | null }) =>
        Array.isArray(r.students) ? r.students : r.students ? [r.students] : []
      )

    setAssignedClass({ ...cls, students })
    setLoading(false)
  }

  return { assignedClass, loading, error, refetch: fetchAssignedClass }
}
