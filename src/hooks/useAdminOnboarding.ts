import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { OnboardingTask, VolunteerTask } from '../types/database'

export interface OnboardingVolunteer {
  id: string
  name: string
  preferred_name: string | null
  accepted_at: string | null
  removed_at: string | null
  removed_reason: string | null
}

export interface OverdueItem { volunteer_id: string; volunteer_name: string; task_key: string; task_label: string; due_at: string }

type VolunteerRow = Omit<OnboardingVolunteer, 'name'> & { profiles: { display_name: string } | { display_name: string }[] }

async function fetchOnboarding() {
  const [t, v, d, o, due] = await Promise.all([
    supabase.from('onboarding_tasks').select('*').order('sort_order').order('label'),
    supabase.from('volunteers').select('id, preferred_name, accepted_at, removed_at, removed_reason, profiles!inner(display_name, role)')
      .eq('profiles.role', 'volunteer').order('created_at'),
    supabase.from('volunteer_tasks').select('*'),
    supabase.rpc('admin_onboarding_overdue'),
    supabase.rpc('admin_onboarding_due'),
  ])
  return { t, v, d, o, due }
}

// Admin: the onboarding checklist (spec 35). The items, every current volunteer's ticks, the overdue
// list (admin_onboarding_overdue(), the database's rule) and the removed-this-season list.
export function useAdminOnboarding() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<OnboardingTask[]>([])
  const [volunteers, setVolunteers] = useState<OnboardingVolunteer[]>([])
  const [done, setDone] = useState<VolunteerTask[]>([])
  const [overdue, setOverdue] = useState<OverdueItem[]>([])
  // "volunteer:task" → when it's due (null: accepted in an earlier season, or before checklists).
  const [dueAt, setDueAt] = useState<Map<string, string | null>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((x: Awaited<ReturnType<typeof fetchOnboarding>>) => {
    const { t, v, d, o, due } = x
    const err = t.error ?? v.error ?? d.error ?? o.error ?? due.error
    setError(err?.message ?? null)
    if (!err) {
      setTasks((t.data ?? []) as OnboardingTask[])
      setVolunteers(((v.data ?? []) as unknown as VolunteerRow[]).map(({ profiles, ...rest }) => ({
        ...rest, name: (Array.isArray(profiles) ? profiles[0] : profiles)?.display_name ?? 'A volunteer',
      })).sort((a, b) => a.name.localeCompare(b.name)))
      setDone((d.data ?? []) as VolunteerTask[])
      setOverdue((o.data ?? []) as OverdueItem[])
      setDueAt(new Map(((due.data ?? []) as { volunteer_id: string; task_key: string; due_at: string | null }[])
        .map(r => [`${r.volunteer_id}:${r.task_key}`, r.due_at])))
    }
    setLoading(false)
  }, [])
  const load = useCallback(async () => apply(await fetchOnboarding()), [apply])

  useEffect(() => {
    let alive = true
    void fetchOnboarding().then(x => { if (alive) apply(x) })
    return () => { alive = false }
  }, [apply])

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p
    if (error) throw new Error(error.message)
    await load()
  }

  return {
    tasks, volunteers, done, overdue, dueAt, loading, error, reload: load,
    // An admin ticks an item for a volunteer (and so has checked it), or confirms the volunteer's tick.
    markDone: (volunteerId: string, key: string) =>
      run(supabase.from('volunteer_tasks').upsert({ volunteer_id: volunteerId, task_key: key, verified_by: user!.id }, { onConflict: 'volunteer_id,task_key', ignoreDuplicates: false })),
    undo: (volunteerId: string, key: string) =>
      run(supabase.from('volunteer_tasks').delete().eq('volunteer_id', volunteerId).eq('task_key', key)),
    addTask: (t: { label: string; help_url: string | null; due_hours_after_accept: number }) =>
      run(supabase.from('onboarding_tasks').insert({ ...t, sort_order: Math.max(0, ...tasks.map(x => x.sort_order)) + 1 })),
    updateTask: (key: string, patch: { label: string; help_url: string | null; due_hours_after_accept: number }) =>
      run(supabase.from('onboarding_tasks').update(patch).eq('key', key)),
    deleteTask: (key: string) => run(supabase.from('onboarding_tasks').delete().eq('key', key)),
    // Returns how many crew spots it freed.
    removeFromSeason: async (volunteerId: string, reason: string) => {
      const { data, error } = await supabase.rpc('remove_from_season', { p_volunteer_id: volunteerId, p_reason: reason })
      if (error) throw new Error(error.message)
      await load()
      return (data as number | null) ?? 0
    },
  }
}
