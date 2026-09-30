import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types/database'

export function useAdminUsers() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setUsers(data ?? [])
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
