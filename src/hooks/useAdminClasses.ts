import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Class, Section } from '../types/database'

export interface SectionWithCrew extends Section {
  lead: { display_name: string } | null
  support: { display_name: string } | null
  registered_count: number
}

export interface ClassWithSections extends Class {
  sections: SectionWithCrew[]
  enrolled: number
  total_capacity: number
}

export function useAdminClasses() {
  const [classes, setClasses] = useState<ClassWithSections[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchClasses() }, [])

  async function fetchClasses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        sections (
          *,
          lead:volunteers!sections_lead_id_fkey ( profile:profiles ( display_name ) ),
          support:volunteers!sections_support_id_fkey ( profile:profiles ( display_name ) ),
          registrations(count)
        )
      `)
      .order('name', { ascending: true })

    if (error) { setError(error.message); setLoading(false); return }

    const shaped: ClassWithSections[] = (data ?? []).map((c: any) => {
      const sections: SectionWithCrew[] = (c.sections ?? []).map((s: any) => ({
        ...s,
        lead: s.lead?.profile ?? null,
        support: s.support?.profile ?? null,
        registered_count: s.registrations?.[0]?.count ?? 0,
      }))
      return {
        ...c,
        sections,
        enrolled: sections.reduce((sum, s) => sum + s.registered_count, 0),
        total_capacity: sections.reduce((sum, s) => sum + s.capacity, 0),
      }
    })

    setClasses(shaped)
    setLoading(false)
  }

  async function createClass(payload: Pick<Class, 'name'> & { description?: string }) {
    const { data, error } = await supabase
      .from('classes')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await fetchClasses()
    return data
  }

  async function updateClass(id: string, payload: Partial<Pick<Class, 'name' | 'description'>>) {
    const { error } = await supabase.from('classes').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await fetchClasses()
  }

  async function deleteClass(id: string) {
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setClasses(prev => prev.filter(c => c.id !== id))
  }

  async function createSection(payload: Omit<Section, 'id' | 'created_at'>) {
    const { error } = await supabase.from('sections').insert(payload)
    if (error) throw new Error(error.message)
    await fetchClasses()
  }

  async function updateSection(id: string, payload: Partial<Omit<Section, 'id' | 'class_id' | 'created_at'>>) {
    const { error } = await supabase.from('sections').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await fetchClasses()
  }

  async function deleteSection(id: string) {
    const { error } = await supabase.from('sections').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetchClasses()
  }

  return {
    classes, loading, error,
    createClass, updateClass, deleteClass,
    createSection, updateSection, deleteSection,
    refetch: fetchClasses,
  }
}
