import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Student } from '../types/database'

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

  async function addStudent(payload: Pick<Student, 'full_name' | 'age' | 'medical_info'>) {
    const { data, error } = await supabase
      .from('students')
      .insert({ ...payload, parent_id: user!.id })
      .select()
      .single()

    if (error) throw new Error(error.message)
    setStudents(prev => [...prev, data])
    return data
  }

  async function updateStudent(id: string, payload: Pick<Student, 'full_name' | 'age' | 'medical_info'>) {
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

  return { students, loading, error, addStudent, updateStudent, refetch: fetchStudents }
}
