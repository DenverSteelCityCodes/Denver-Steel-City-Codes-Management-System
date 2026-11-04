import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { WeekRole } from '../types/database'

export function useMyWeekRoles() {
  const { user } = useAuth()
  const [roles, setRoles] = useState<WeekRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    let alive = true
    void supabase.from('week_roles').select('*').eq('volunteer_id', user.id).then(({ data, error }) => {
      if (!alive) return
      setRoles((data ?? []) as WeekRole[])
      setError(error?.message ?? null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [user])
  return { roles, loading, error }
}
