import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Class, Section } from '../types/database'
import { fetchSectionFill } from '../lib/sectionFill'

// Row shape of the nested classes → sections → crew select below.
type ProfileName = { profile: { display_name: string } | null } | null
interface RawSection extends Section {
  lead: ProfileName
  section_supports: { volunteer_id: string; volunteer: ProfileName }[] | null
}

export interface SupportEntry {
  id: string
  display_name: string
}

export interface SectionWithCrew extends Section {
  lead: { display_name: string } | null
  supports: SupportEntry[]
  registered_count: number   // confirmed + pending
  waitlist_count: number
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
    const fillPromise = fetchSectionFill().catch(() => new Map())
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        sections (
          *,
          lead:volunteers!sections_lead_id_fkey ( profile:profiles ( display_name ) ),
          section_supports (
            volunteer_id,
            volunteer:volunteers ( profile:profiles ( display_name ) )
          )
        )
      `)
      .order('name', { ascending: true })

    if (error) { setError(error.message); setLoading(false); return }
    const fill = await fillPromise

    const rows = (data ?? []) as unknown as (Class & { sections: RawSection[] | null })[]
    const shaped: ClassWithSections[] = rows.map(c => {
      const sections: SectionWithCrew[] = (c.sections ?? []).map(({ section_supports, ...s }) => ({
        ...s,
        lead: s.lead?.profile ?? null,
        supports: (section_supports ?? []).map(ss => ({
          id: ss.volunteer_id,
          display_name: ss.volunteer?.profile?.display_name ?? '',
        })),
        registered_count: fill.get(s.id)?.active ?? 0,
        waitlist_count: fill.get(s.id)?.waitlist ?? 0,
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

  async function createSection(
    payload: Omit<Section, 'id' | 'created_at'>,
    supportIds: string[] = [],
  ) {
    const { data: section, error } = await supabase
      .from('sections')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)

    if (supportIds.length > 0) {
      const { error: ssErr } = await supabase.from('section_supports').insert(
        supportIds.map(vid => ({ section_id: section.id, volunteer_id: vid }))
      )
      if (ssErr) throw new Error(ssErr.message)
    }

    await fetchClasses()
  }

  async function updateSection(
    id: string,
    payload: Partial<Omit<Section, 'id' | 'class_id' | 'created_at'>>,
    supportIds?: string[],
  ) {
    const { error } = await supabase.from('sections').update(payload).eq('id', id)
    if (error) throw new Error(error.message)

    if (supportIds !== undefined) {
      const { error: delErr } = await supabase.from('section_supports').delete().eq('section_id', id)
      if (delErr) throw new Error(delErr.message)
      if (supportIds.length > 0) {
        const { error: ssErr } = await supabase.from('section_supports').insert(
          supportIds.map(vid => ({ section_id: id, volunteer_id: vid }))
        )
        if (ssErr) throw new Error(ssErr.message)
      }
    }

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
