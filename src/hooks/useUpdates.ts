import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRefetchOnFocus } from './useRefetchOnFocus'
import type { Update, UpdateAudience } from '../types/database'

export interface UpdateWithSection extends Update {
  sections: { label: string; week: number | null; classes: { name: string } | null } | null
  // The week of a week audience (spec 34).
  sessions?: { name: string } | null
}

const SELECT = '*, sections ( label, week, classes ( name ) ), sessions ( name )'

// Updates the signed-in user may read (RLS decides), newest first. Any role can call this.
export function useUpdates(limit = 50) {
  const [updates, setUpdates] = useState<UpdateWithSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUpdates = useCallback(() => supabase
    .from('updates')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
    .then(({ data, error }) => {
      if (error) setError(error.message)
      else setUpdates((data ?? []) as unknown as UpdateWithSection[])
      setLoading(false)
    }), [limit])

  useEffect(() => { void fetchUpdates() }, [fetchUpdates])
  useRefetchOnFocus(fetchUpdates, 120_000)

  async function postUpdate(input: PostInput) {
    const week = input.audience === 'week_families' || input.audience === 'week_crew'
    const { data, error } = await supabase
      .from('updates')
      .insert({
        // The composer names the post, so a retry after a lost answer can't post (or email) twice.
        ...(input.id ? { id: input.id } : {}),
        audience: input.audience,
        section_id: input.audience === 'section' ? input.section_id : null,
        body: input.body.trim(),
        // The spec 34 columns are only named when used: a lead's ordinary post looks as it always did.
        ...(week ? { session_id: input.session_id } : {}),
        ...(input.urgent ? { urgent: true } : {}),
      })
      .select(SELECT)
      .single()
    // 23505: this id is already saved, so an earlier try went through. That's a success.
    if (error?.code === '23505' && input.id) {
      const { data: saved } = await supabase.from('updates').select(SELECT).eq('id', input.id).maybeSingle()
      if (saved) setUpdates(prev => (prev.some(u => u.id === input.id) ? prev : [saved as unknown as UpdateWithSection, ...prev]))
      return saved as unknown as UpdateWithSection
    }
    if (error) throw new Error(error.message)
    setUpdates(prev => [data as unknown as UpdateWithSection, ...prev])
    return data as unknown as UpdateWithSection
  }

  async function deleteUpdate(id: string) {
    const { error } = await supabase.from('updates').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setUpdates(prev => prev.filter(u => u.id !== id))
  }

  return { updates, loading, error, postUpdate, deleteUpdate, refetch: fetchUpdates }
}

export interface PostInput {
  // Chosen by the composer once per message (spec 34), so a retried post is the same row.
  id?: string
  audience: UpdateAudience
  section_id?: string | null
  session_id?: string | null
  body: string
  urgent?: boolean
}

// Email addresses for an audience (admins: any; a section's crew: that section's families).
export async function fetchRecipientEmails(audience: UpdateAudience, sectionId?: string | null, sessionId?: string | null): Promise<string[]> {
  if (audience === 'week_families' || audience === 'week_crew') {
    const { data, error } = await supabase.rpc('week_recipient_emails', { p_audience: audience, p_session_id: sessionId ?? null })
    if (error) throw new Error(error.message)
    return (data ?? []) as string[]
  }
  const { data, error } = await supabase.rpc('update_recipient_emails', {
    p_audience: audience, p_section_id: audience === 'section' ? sectionId ?? null : null,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as string[]
}

// Human label for where an update went.
export function audienceLabel(u: Pick<UpdateWithSection, 'audience' | 'sections' | 'sessions'>): string {
  switch (u.audience) {
    case 'week_families': return `Families in ${u.sessions?.name ?? 'one week'}`
    case 'week_crew': return `Crew in ${u.sessions?.name ?? 'one week'}`
    case 'everyone': return 'Everyone'
    case 'parents': return 'Parents'
    case 'volunteers': return 'Volunteers'
    case 'section': {
      const cls = u.sections?.classes?.name
      const label = u.sections?.label
      return cls ? `${cls}${label ? ` · ${label}` : ''}${u.sections?.week ? ` · Week ${u.sections.week}` : ''}` : 'One section'
    }
  }
}
