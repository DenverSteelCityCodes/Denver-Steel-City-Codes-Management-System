import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types/database'

export interface AdminUser extends Profile {
  email: string | null
  last_sign_in_at: string | null
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const [{ data, error }, emails] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      // Admin-only RPC: profiles has no email, and display names alone can't tell accounts apart.
      supabase.rpc('admin_user_emails'),
    ])
    const byId = new Map(((emails.data ?? []) as { id: string; email: string; last_sign_in_at: string | null }[])
      .map(e => [e.id, e]))

    if (error) setError(error.message)
    else setUsers((data ?? []).map(p => ({
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

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw new Error(error.message)
    await fetchUsers()
  }

  return { users, loading, error, updateRole, refetch: fetchUsers }
}
