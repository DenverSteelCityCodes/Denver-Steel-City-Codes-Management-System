import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Session {
  id: string
  name: string
  year: number
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchSessions() }, [])

  async function fetchSessions() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) setError(error.message)
    else setSessions(data ?? [])
    setLoading(false)
  }

  async function createSession(payload: Omit<Session, 'id' | 'created_at'>) {
    const { error } = await supabase.from('sessions').insert(payload)
    if (error) throw error
    await fetchSessions()
  }

  async function updateSession(id: string, payload: Partial<Omit<Session, 'id' | 'created_at'>>) {
    const { error } = await supabase.from('sessions').update(payload).eq('id', id)
    if (error) throw error
    await fetchSessions()
  }

  async function deleteSession(id: string) {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) throw error
    setSessions(s => s.filter(x => x.id !== id))
  }

  return { sessions, loading, error, createSession, updateSession, deleteSession, refetch: fetchSessions }
}
