import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { ChecklistItem } from '../lib/onboarding'

// The signed-in volunteer's onboarding checklist (my_onboarding(), spec 35). Ticking goes through
// set_my_onboarding_task(); the row flips at once and goes back if the save fails.
export function useMyOnboarding() {
  const { user } = useAuth()
  const [items, setItems] = useState<ChecklistItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_onboarding')
    setError(error?.message ?? null)
    if (!error) setItems((data ?? []) as ChecklistItem[])
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    void supabase.rpc('my_onboarding').then(({ data, error }) => {
      if (!alive) return
      setError(error?.message ?? null)
      if (!error) setItems((data ?? []) as ChecklistItem[])
    })
    return () => { alive = false }
  }, [user])

  async function setDone(key: string, done: boolean) {
    const before = items
    setItems(list => list?.map(i => i.key === key ? { ...i, done_at: done ? new Date().toISOString() : null, verified: done ? i.verified : false } : i) ?? list)
    const { data, error } = await supabase.rpc('set_my_onboarding_task', { p_key: key, p_done: done })
    if (error) { setItems(before); throw new Error(error.message) }
    setItems(list => list?.map(i => i.key === key ? { ...i, done_at: (data as string | null) ?? null } : i) ?? list)
  }

  return { items, error, setDone, reload: load }
}
