import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Incident, IncidentKind, IncidentLevel } from '../types/database'

export interface IncidentInput {
  student_id: string | null
  kind: IncidentKind
  level: IncidentLevel
  occurred_at: string
  description: string
}

// A volunteer's own entries in one section's incident log (spec 34): RLS shows only the entries
// they logged. They log for their own section only; campers are named from their roster.
export function useMyIncidents(sectionId: string) {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => supabase
    .from('incidents')
    .select('*')
    .eq('section_id', sectionId)
    .order('occurred_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) setError(error.message)
      else { setIncidents((data ?? []) as Incident[]); setError(null) }
      setLoading(false)
    }), [sectionId])

  useEffect(() => { void refetch() }, [refetch])

  async function logIncident(input: IncidentInput) {
    if (!user) throw new Error('Sign in first')
    const { data, error } = await supabase
      .from('incidents')
      .insert({ ...input, section_id: sectionId, reported_by: user.id, description: input.description.trim() })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    setIncidents(prev => [data as Incident, ...prev])
  }

  return { incidents, loading, error, logIncident }
}

export interface AdminIncident extends Incident {
  students: { full_name: string } | null
  sections: { label: string; week: number | null; classes: { name: string } | null } | null
  reporter: { display_name: string } | null
}

// Every entry, newest first (admins). notifyParent() emails the camper's family through the
// outbox and stamps parent_notified_at, once.
export function useAdminIncidents(limit = 100) {
  const [incidents, setIncidents] = useState<AdminIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => supabase
    .from('incidents')
    .select('*, students ( full_name ), sections ( label, week, classes ( name ) ), reporter:profiles ( display_name )')
    .order('occurred_at', { ascending: false })
    .limit(limit)
    .then(({ data, error }) => {
      if (error) setError(error.message)
      else { setIncidents((data ?? []) as unknown as AdminIncident[]); setError(null) }
      setLoading(false)
    }), [limit])

  useEffect(() => { void refetch() }, [refetch])

  async function notifyParent(id: string, message: string) {
    const { data, error } = await supabase.rpc('notify_incident_parent', { p_incident_id: id, p_message: message.trim() || null })
    if (error) throw new Error(error.message)
    setIncidents(prev => prev.map(i => (i.id === id ? { ...i, parent_notified_at: (data as string) ?? new Date().toISOString() } : i)))
  }

  return { incidents, loading, error, notifyParent, refetch }
}
