import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ScheduleItem } from '../types/database'

// The daily schedule for every session (small table; filter by session_id in the component).
export function useScheduleItems() {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(() => supabase
    .from('schedule_items')
    .select('*')
    .order('start_time', { ascending: true })
    .then(({ data, error }) => {
      if (error) setError(error.message)
      else setItems((data ?? []) as ScheduleItem[])
      setLoading(false)
    }), [])

  useEffect(() => { void fetchItems() }, [fetchItems])

  async function createItem(payload: Omit<ScheduleItem, 'id' | 'created_at'>) {
    const { error } = await supabase.from('schedule_items').insert(payload)
    if (error) throw new Error(error.message)
    await fetchItems()
  }

  async function updateItem(id: string, payload: Partial<Omit<ScheduleItem, 'id' | 'created_at' | 'session_id'>>) {
    const { error } = await supabase.from('schedule_items').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await fetchItems()
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from('schedule_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // Copy one session's schedule onto another (e.g. Week 1 → Week 2).
  async function copyTo(fromSessionId: string, toSessionId: string) {
    const rows = items.filter(i => i.session_id === fromSessionId)
      .map(i => ({ session_id: toSessionId, start_time: i.start_time, end_time: i.end_time, title: i.title, location: i.location }))
    if (rows.length === 0) return
    const { error } = await supabase.from('schedule_items').insert(rows)
    if (error) throw new Error(error.message)
    await fetchItems()
  }

  return { items, loading, error, createItem, updateItem, deleteItem, copyTo, refetch: fetchItems }
}
