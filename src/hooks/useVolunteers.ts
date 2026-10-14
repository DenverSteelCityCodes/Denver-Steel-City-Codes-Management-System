import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Volunteer, Profile } from '../types/database'

export interface VolunteerWithProfile extends Volunteer {
  profiles: Pick<Profile, 'display_name'>
  // From the admin-only volunteer_notes table (a volunteer can read their own volunteers row).
  interview_notes: string | null
}

type VolunteerRow = Volunteer & {
  profiles: Pick<Profile, 'display_name'>
  volunteer_notes: { notes: string } | { notes: string }[] | null
}

export function useVolunteers() {
  const [volunteers, setVolunteers] = useState<VolunteerWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchVolunteers() }, [])

  async function fetchVolunteers() {
    setLoading(true)
    // The volunteers row outlives a role change, so only count people whose role is still
    // 'volunteer' (otherwise a demoted parent/admin stays assignable and gets auto-matched).
    const { data, error } = await supabase
      .from('volunteers')
      .select('*, profiles!inner(display_name, role), volunteer_notes(notes)')
      .eq('profiles.role', 'volunteer')
      .order('created_at', { ascending: true })

    setError(error?.message ?? null)
    if (!error) setVolunteers(((data ?? []) as unknown as VolunteerRow[]).map(({ volunteer_notes, ...v }) => ({
      ...v,
      interview_notes: (Array.isArray(volunteer_notes) ? volunteer_notes[0] : volunteer_notes)?.notes ?? null,
    })))
    setLoading(false)
  }

  return { volunteers, loading, error, refetch: fetchVolunteers }
}
