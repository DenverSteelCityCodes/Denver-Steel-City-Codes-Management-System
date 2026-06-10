import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { VolunteerApplication, ExperienceLevel } from '../types/database'

export function useVolunteerApplications() {
  const [applications, setApplications] = useState<VolunteerApplication[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchApplications() {
    const { data } = await supabase
      .from('volunteer_applications')
      .select('*')
      .order('created_at', { ascending: false })
    setApplications((data as VolunteerApplication[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchApplications() }, [])

  async function acceptApplication(app: VolunteerApplication, expLevel: ExperienceLevel) {
    // Always mark the application accepted first
    const { error: statusError } = await supabase
      .from('volunteer_applications')
      .update({ status: 'accepted' })
      .eq('id', app.id)
    if (statusError) throw new Error(statusError.message)

    setApplications(prev =>
      prev.map(a => a.id === app.id ? { ...a, status: 'accepted' } : a)
    )

    if (!app.user_id) {
      // Applicant's email may already have an account or they haven't confirmed yet.
      // Application is marked accepted; their profile will carry role: 'volunteer' from
      // signup metadata. The volunteers row will be created when they sign in.
      throw new Error(
        'Application accepted, but no linked account found. ' +
        'Ask the applicant to confirm their email and sign in — then re-accept to create the volunteers row.'
      )
    }

    // Upgrade role to volunteer (handles pre-migration accounts that were auto-created as parent)
    await supabase.from('profiles').upsert({
      id: app.user_id,
      display_name: `${app.first_name} ${app.last_name}`,
      role: 'volunteer',
    })

    await supabase.from('volunteers').insert({
      id: app.user_id,
      experience_level: expLevel,
      availability_week_1: app.availability_week_1,
      availability_week_2: app.availability_week_2,
    })
  }

  async function rejectApplication(appId: string, notes?: string) {
    await supabase
      .from('volunteer_applications')
      .update({ status: 'rejected', ...(notes ? { admin_notes: notes } : {}) })
      .eq('id', appId)

    setApplications(prev =>
      prev.map(a => a.id === appId ? { ...a, status: 'rejected', admin_notes: notes ?? a.admin_notes } : a)
    )
  }

  return { applications, loading, acceptApplication, rejectApplication }
}
