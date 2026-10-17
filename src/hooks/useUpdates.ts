import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRefetchOnFocus } from './useRefetchOnFocus'
import type { Update, UpdateAudience } from '../types/database'

export interface UpdateWithSection extends Update {
  sections: { label: string; week: number | null; classes: { name: string } | null } | null
}

// Updates the signed-in user may read (RLS decides), newest first. Any role can call this.
export function useUpdates(limit = 50) {
  const [updates, setUpdates] = useState<UpdateWithSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUpdates = useCallback(() => supabase
    .from('updates')
    .select('*, sections ( label, week, classes ( name ) )')
    .order('created_at', { ascending: false })
    .limit(limit)
    .then(({ data, error }) => {
      if (error) setError(error.message)
      else setUpdates((data ?? []) as unknown as UpdateWithSection[])
      setLoading(false)
    }), [limit])

  useEffect(() => { void fetchUpdates() }, [fetchUpdates])
  useRefetchOnFocus(fetchUpdates, 120_000)

  async function postUpdate(input: { audience: UpdateAudience; section_id?: string | null; body: string }) {
    const { data, error } = await supabase
      .from('updates')
      .insert({ audience: input.audience, section_id: input.audience === 'section' ? input.section_id : null, body: input.body.trim() })
      .select('*, sections ( label, week, classes ( name ) )')
      .single()
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

// Email addresses for an audience (admins: any; a section's crew: that section's families).
export async function fetchRecipientEmails(audience: UpdateAudience, sectionId?: string | null): Promise<string[]> {
  const { data, error } = await supabase.rpc('update_recipient_emails', {
    p_audience: audience, p_section_id: audience === 'section' ? sectionId ?? null : null,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as string[]
}

// Human label for where an update went.
export function audienceLabel(u: Pick<UpdateWithSection, 'audience' | 'sections'>): string {
  switch (u.audience) {
    case 'everyone': return 'Everyone'
    case 'parents': return 'All parents'
    case 'volunteers': return 'Volunteers'
    case 'section': {
      const cls = u.sections?.classes?.name
      const label = u.sections?.label
      return cls ? `${cls}${label ? ` · ${label}` : ''}${u.sections?.week ? ` · Week ${u.sections.week}` : ''}` : 'One section'
    }
  }
}
