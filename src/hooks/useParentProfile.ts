import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { ParentProfile } from '../types/database'

export function useParentProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ParentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('parent_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (error) { setError(error.message) } else { setProfile(data) }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function saveProfile(payload: Omit<ParentProfile, 'id' | 'updated_at'>) {
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('parent_profiles')
      .upsert({ id: user.id, ...payload, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setProfile(data)
    return data as ParentProfile
  }

  return { profile, loading, error, saveProfile, refetch: fetchProfile }
}
