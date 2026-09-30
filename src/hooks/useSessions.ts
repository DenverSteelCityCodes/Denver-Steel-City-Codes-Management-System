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

// The active camp year: the latest year with an active session (else this calendar year).
export function activeCampYear(sessions: Session[]): number {
  return sessions.filter(s => s.is_active).reduce((max, s) => Math.max(max, s.year), 0) ||
    new Date().getFullYear()
}

// That year's active sessions in date order. Session N maps to sections.week = N (1 or 2).
export function campSessions(sessions: Session[]): Session[] {
  const year = activeCampYear(sessions)
  return sessions
    .filter(s => s.is_active && s.year === year)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 2)
}

// "June 7 – June 11, 2027"
export function formatSessionDates(session: Session, withYear = true): string {
  const fmt = (d: string, year: boolean) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', ...(year ? { year: 'numeric' } : {}),
    })
  return `${fmt(session.start_date, false)} – ${fmt(session.end_date, withYear)}`
}
