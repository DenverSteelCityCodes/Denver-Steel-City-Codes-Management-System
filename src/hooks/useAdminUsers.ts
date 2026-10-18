import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import type { Profile, UserRole } from '../types/database'

export interface AdminUser extends Profile {
  email: string | null
  last_sign_in_at: string | null
}

// Sections a volunteer is on, as "Python · PY-B (W1)" labels.
export interface CrewAssignments { lead: string[]; support: string[] }

type SectionRef = { label: string; week: 1 | 2 | null; classes: { name: string } | null } | null
const sectionName = (s: SectionRef) =>
  s ? `${s.classes?.name ? `${s.classes.name} · ` : ''}${s.label}${s.week ? ` (W${s.week})` : ''}` : 'a deleted section'

export async function fetchCrewAssignments(volunteerId: string): Promise<CrewAssignments> {
  const [leads, supports] = await Promise.all([
    supabase.from('sections').select('label, week, classes ( name )').eq('lead_id', volunteerId),
    supabase.from('section_supports').select('sections ( label, week, classes ( name ) )').eq('volunteer_id', volunteerId),
  ])
  const err = leads.error ?? supports.error
  if (err) throw new Error(err.message)
  return {
    lead: ((leads.data ?? []) as unknown as SectionRef[]).map(sectionName),
    support: ((supports.data ?? []) as unknown as { sections: SectionRef }[]).map(r => sectionName(r.sections)),
  }
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    // Paged past the API's 1,000-row cap (spec 18).
    let data: Profile[] | null = null
    let error: { message: string } | null = null
    let emails: { id: string; email: string; last_sign_in_at: string | null }[] = []
    try {
      ;[data, emails] = await Promise.all([
        fetchAll<Profile>(async (from, to) => supabase.from('profiles').select('*')
          .order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
        // Admin-only RPC: profiles has no email, and display names alone can't tell accounts apart.
        fetchAll<{ id: string; email: string; last_sign_in_at: string | null }>(async (from, to) =>
          supabase.rpc('admin_user_emails').order('id', { ascending: true }).range(from, to)),
      ])
    } catch (e) {
      error = { message: e instanceof Error ? e.message : 'unknown error' }
    }
    const byId = new Map(emails.map(e => [e.id, e]))

    setError(error?.message ?? null)
    if (!error) setUsers((data ?? []).map(p => ({
      ...p,
      email: byId.get(p.id)?.email ?? null,
      last_sign_in_at: byId.get(p.id)?.last_sign_in_at ?? null,
    })))
    setLoading(false)
  }

  async function updateRole(userId: string, newRole: UserRole) {
    const current = users.find(u => u.id === userId)
    if (!current) throw new Error('User not found')

    if (current.role === 'admin' && newRole !== 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length
      if (adminCount <= 1) throw new Error('Cannot demote the last admin account')
    }

    // A volunteer moving to another role leaves every crew spot and upcoming duty slot. The
    // database does that in the same transaction as the role change (trigger
    // profiles_release_volunteer, #143), so a failed change leaves the crew untouched.
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw new Error(error.message)
    await fetchUsers()
  }

  return { users, loading, error, updateRole, refetch: fetchUsers }
}
