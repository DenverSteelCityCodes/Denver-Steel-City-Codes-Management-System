import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Class, Section } from '../types/database'
import { fetchSectionFill } from '../lib/sectionFill'
import { guardedUpdate, EditConflictError } from '../lib/editConflict'

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

// Schedule columns are optional on write so a section can be created before its times are known.
export type SectionInput =
  Omit<Section, 'id' | 'created_at' | 'days' | 'start_time' | 'end_time' | 'room'> &
  Partial<Pick<Section, 'days' | 'start_time' | 'end_time' | 'room'>>

export interface ClassWithSections extends Class {
  sections: SectionWithCrew[]
  enrolled: number
  total_capacity: number
}

// Registrations of every status in the given sections — what a delete would cascade away.
export interface RegistrationTally { active: number; waitlisted: number; cancelled: number }

export function useAdminClasses() {
  const [classes, setClasses] = useState<ClassWithSections[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Set when the seat counts couldn't be loaded: registered_count/waitlist_count then read 0,
  // so callers must not present them as real numbers.
  const [fillError, setFillError] = useState<string | null>(null)

  useEffect(() => { fetchClasses() }, [])

  // Resolves false when the classes couldn't be read (the last good list stays in `classes`).
  async function fetchClasses(): Promise<boolean> {
    setLoading(true)
    const fillPromise = fetchSectionFill().then(
      fill => { setFillError(null); return fill },
      (e: unknown) => { setFillError(e instanceof Error ? e.message : 'unknown error'); return null },
    )
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

    if (error) { setError(error.message); setLoading(false); return false }
    setError(null)
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
        registered_count: fill?.get(s.id)?.active ?? 0,
        waitlist_count: fill?.get(s.id)?.waitlist ?? 0,
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
    return fill !== null
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
    const original = classes.find(c => c.id === id)
    try {
      if (original) await guardedUpdate('classes', { id, updated_at: original.updated_at, name: original.name, description: original.description }, payload)
      else {
        const { error } = await supabase.from('classes').update(payload).eq('id', id)
        if (error) throw new Error(error.message)
      }
    } catch (e) {
      // Reload so the form's next save is checked against the version that won.
      if (e instanceof EditConflictError) await fetchClasses()
      throw e
    }
    await fetchClasses()
  }

  async function deleteClass(id: string) {
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setClasses(prev => prev.filter(c => c.id !== id))
  }

  // Returns a warning (instead of throwing) when the section was created but its supports
  // weren't, so the caller closes the form rather than letting a retry create a duplicate.
  async function createSection(
    payload: SectionInput,
    supportIds: string[] = [],
  ): Promise<{ warning: string | null }> {
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
      if (ssErr) {
        // Undo the half-made section; it's brand new, so nothing else hangs off it yet.
        const { error: undoErr } = await supabase.from('sections').delete().eq('id', section.id)
        if (!undoErr) throw new Error(`Couldn't save the supports, so the section wasn't created: ${ssErr.message}`)
        await fetchClasses()
        return { warning: `${section.label} was created, but its supports couldn't be saved (${ssErr.message}). Edit the section to add them.` }
      }
    }

    await fetchClasses()
    return { warning: null }
  }

  async function updateSection(
    id: string,
    payload: Partial<Omit<SectionInput, 'class_id'>>,
    supportIds?: string[],
  ) {
    const original = classes.flatMap(c => c.sections).find(s => s.id === id)
    try {
      if (original) {
        const { lead: _lead, supports: _supports, registered_count: _r, waitlist_count: _w, ...row } = original  // eslint-disable-line @typescript-eslint/no-unused-vars
        await guardedUpdate('sections', row as unknown as { id: string } & Record<string, unknown>, payload)
      } else {
        const { error } = await supabase.from('sections').update(payload).eq('id', id)
        if (error) throw new Error(error.message)
      }
    } catch (e) {
      if (e instanceof EditConflictError) await fetchClasses()
      throw e
    }

    if (supportIds !== undefined) {
      // Supports are replaced wholesale; keep the old set so a failed insert can put it back.
      const { data: prev, error: prevErr } = await supabase
        .from('section_supports').select('volunteer_id').eq('section_id', id)
      if (prevErr) throw new Error(prevErr.message)
      const { error: delErr } = await supabase.from('section_supports').delete().eq('section_id', id)
      if (delErr) throw new Error(delErr.message)
      if (supportIds.length > 0) {
        const { error: ssErr } = await supabase.from('section_supports').insert(
          supportIds.map(vid => ({ section_id: id, volunteer_id: vid }))
        )
        if (ssErr) {
          const { error: restoreErr } = (prev ?? []).length > 0
            ? await supabase.from('section_supports').insert(
                (prev ?? []).map(p => ({ section_id: id, volunteer_id: p.volunteer_id }))
              )
            : { error: null }
          await fetchClasses()
          throw new Error(restoreErr
            ? `Couldn't save the supports (${ssErr.message}), and the previous supports couldn't be restored (${restoreErr.message}). Re-add them before leaving.`
            : `Couldn't save the supports (${ssErr.message}); the previous supports were kept.`)
        }
      }
    }

    await fetchClasses()
  }

  // Exact counts straight from registrations (admin RLS sees every row), including cancelled
  // ones, which section_fill_counts() doesn't report but a delete cascades away all the same.
  async function countRegistrations(sectionIds: string[]): Promise<RegistrationTally> {
    const tally: RegistrationTally = { active: 0, waitlisted: 0, cancelled: 0 }
    if (sectionIds.length === 0) return tally
    const { data, error } = await supabase.from('registrations').select('status').in('section_id', sectionIds)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      if (r.status === 'waitlisted') tally.waitlisted++
      else if (r.status === 'cancelled') tally.cancelled++
      else tally.active++
    }
    return tally
  }

  // Cancelling keeps the section and its registrations (as cancelled); families keep their history
  // and get first pick of that week's waitlists. Returns how many registrations were cancelled.
  async function cancelSection(id: string, reason?: string): Promise<number> {
    const { data, error } = await supabase.rpc('cancel_section', { p_section_id: id, p_reason: reason ?? null })
    if (error) throw new Error(error.message)
    await fetchClasses()
    return (data as number | null) ?? 0
  }

  async function cancelClass(id: string, reason?: string): Promise<number> {
    const { data, error } = await supabase.rpc('cancel_class', { p_class_id: id, p_reason: reason ?? null })
    if (error) throw new Error(error.message)
    await fetchClasses()
    return (data as number | null) ?? 0
  }

  async function deleteSection(id: string) {
    const { error } = await supabase.from('sections').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetchClasses()
  }

  return {
    classes, loading, error, fillError,
    countRegistrations,
    createClass, updateClass, deleteClass,
    createSection, updateSection, deleteSection, cancelSection, cancelClass,
    refetch: fetchClasses,
  }
}
