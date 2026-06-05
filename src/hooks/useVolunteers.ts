import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Volunteer, Profile } from '../types/database'

export interface VolunteerWithProfile extends Volunteer {
  profiles: Pick<Profile, 'display_name'>
}

export function useVolunteers() {
  const [volunteers, setVolunteers] = useState<VolunteerWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchVolunteers() }, [])

  async function fetchVolunteers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('volunteers')
      .select('*, profiles(display_name)')
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setVolunteers((data ?? []) as VolunteerWithProfile[])
    setLoading(false)
  }

  return { volunteers, loading, error, refetch: fetchVolunteers }
}
