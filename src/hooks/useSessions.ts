import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { guardedUpdate, EditConflictError } from '../lib/editConflict'

export interface Session {
  id: string
  name: string
  year: number
  start_date: string
  end_date: string
  is_active: boolean
  // Building and address (migration_public_camp_page.sql, spec 30). Null until an admin sets it.
  location?: string | null
  updated_at?: string
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
    if (error) throw new Error(error.message)
    await fetchSessions()
  }

  async function updateSession(id: string, payload: Partial<Omit<Session, 'id' | 'created_at'>>) {
    const original = sessions.find(s => s.id === id)
    try {
      if (original) await guardedUpdate('sessions', original as unknown as { id: string } & Record<string, unknown>, payload)
      else {
        const { error } = await supabase.from('sessions').update(payload).eq('id', id)
        if (error) throw new Error(error.message)
      }
    } catch (e) {
      // Reload so the form's next save is checked against the version that won.
      if (e instanceof EditConflictError) await fetchSessions()
      throw e
    }
    await fetchSessions()
  }

  async function deleteSession(id: string) {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setSessions(s => s.filter(x => x.id !== id))
  }

  return { sessions, loading, error, createSession, updateSession, deleteSession, refetch: fetchSessions }
}

export { activeCampYear, campSessions } from '../lib/campYear'

// "June 7 – June 11, 2027"
export function formatSessionDates(session: Session, withYear = true): string {
  const fmt = (d: string, year: boolean) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', ...(year ? { year: 'numeric' } : {}),
    })
  return `${fmt(session.start_date, false)} – ${fmt(session.end_date, withYear)}`
}
