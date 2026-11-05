import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Volunteer, Profile } from '../types/database'

export interface VolunteerWithProfile extends Volunteer {
  profiles: Pick<Profile, 'display_name'>
  // From the admin-only volunteer_notes table (a volunteer can read their own volunteers row).
  interview_notes: string | null
  // False when admin_crew_blocks() could not be read. Null crew_block then means unknown, not vetted.
  crew_known: boolean
  // The database's sentence, or null when this person can be crewed.
  crew_block: string | null
}

type VolunteerRow = Volunteer & {
  profiles: Pick<Profile, 'display_name'>
  volunteer_notes: { notes: string } | { notes: string }[] | null
}

export function useVolunteers() {
  const [volunteers, setVolunteers] = useState<VolunteerWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [crewError, setCrewError] = useState<string | null>(null)

  useEffect(() => { fetchVolunteers() }, [])

  async function fetchVolunteers() {
    setLoading(true)
    // The volunteers row outlives a role change, so only count people whose role is still
    // 'volunteer' (otherwise a demoted parent/admin stays assignable and gets auto-matched).
    const { data, error } = await supabase
      .from('volunteers')
      .select('*, profiles!inner(display_name, role), volunteer_notes(notes)')
      .eq('profiles.role', 'volunteer')
      // Removed from the season (spec 35): off the crew lists and the matcher until accepted again.
      .is('removed_at', null)
      .order('created_at', { ascending: true })

    setError(error?.message ?? null)
    if (error) {
      setLoading(false)
      return
    }
    const rows = (data ?? []) as unknown as VolunteerRow[]
    const blocks = await supabase.rpc('admin_crew_blocks')
    if (blocks.error) {
      // Unknown is not eligible. The save still shows the database's refusal if someone is assigned.
      setCrewError(blocks.error.message)
      setVolunteers(rows.map(row => withNotes(row, false, null)))
    } else {
      setCrewError(null)
      const listed = (blocks.data ?? []) as { volunteer_id: string; reason: string | null }[]
      const byId = new Map(listed.map(b => [b.volunteer_id, b.reason]))
      setVolunteers(rows.map(row => {
        const known = byId.has(row.id)
        return withNotes(row, known, known ? (byId.get(row.id) ?? null) : null)
      }))
    }
    setLoading(false)
  }

  return { volunteers, loading, error, crewError, refetch: fetchVolunteers }
}

function withNotes(row: VolunteerRow, crew_known: boolean, crew_block: string | null): VolunteerWithProfile {
  const { volunteer_notes, ...v } = row
  return {
    ...v,
    interview_notes: (Array.isArray(volunteer_notes) ? volunteer_notes[0] : volunteer_notes)?.notes ?? null,
    crew_known,
    crew_block,
  }
}
