import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Class } from '../types/database'

export interface ClassWithVolunteers extends Class {
  lead: { display_name: string } | null
  support: { display_name: string } | null
  registered_count: number
}

export function useAdminClasses() {
  const [classes, setClasses] = useState<ClassWithVolunteers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchClasses() }, [])

  async function fetchClasses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        lead:profiles!classes_lead_id_fkey(display_name),
        support:profiles!classes_support_id_fkey(display_name),
        registrations(count)
      `)
      .order('name', { ascending: true })

    if (error) { setError(error.message); setLoading(false); return }

    const withCounts = (data ?? []).map((c: ClassWithVolunteers & { registrations: { count: number }[] }) => ({
      ...c,
      registered_count: c.registrations?.[0]?.count ?? 0,
    }))

    setClasses(withCounts)
    setLoading(false)
  }

  async function createClass(payload: Pick<Class, 'name' | 'age_group' | 'capacity'>) {
    const { data, error } = await supabase
      .from('classes')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await fetchClasses()
    return data
  }

  async function updateClass(id: string, payload: Partial<Pick<Class, 'name' | 'age_group' | 'capacity' | 'lead_id' | 'support_id'>>) {
    const { error } = await supabase.from('classes').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await fetchClasses()
  }

  async function deleteClass(id: string) {
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setClasses(prev => prev.filter(c => c.id !== id))
  }

  return { classes, loading, error, createClass, updateClass, deleteClass, refetch: fetchClasses }
}
