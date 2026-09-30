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
    // Resolve the applicant's account. Applications normally carry user_id from signup; if not
    // (the email already had an account), look it up by email (admin-only RPC).
    let userId = app.user_id
    if (!userId) {
      const { data, error } = await supabase.rpc('admin_user_id_for_email', { p_email: app.email })
      if (error) throw new Error(error.message)
      if (!data) {
        throw new Error(
          `No account exists for ${app.email} yet. Ask the applicant to sign up at /apply or /signup ` +
          'with that email, then accept again.'
        )
      }
      userId = data as string
    }

    // Grant access first; only mark the application accepted once that has worked, so the
    // admin never sees "accepted" for someone who can't actually use the volunteer area.
    const { error: roleError } = await supabase
      .from('profiles').update({ role: 'volunteer' }).eq('id', userId)
    if (roleError) throw new Error(`Couldn't set the volunteer role: ${roleError.message}`)

    const { error: volError } = await supabase.from('volunteers').upsert({
      id: userId,
      experience_level: expLevel,
      availability_week_1: app.availability_week_1,
      availability_week_2: app.availability_week_2,
    })
    if (volError) throw new Error(`Couldn't create the volunteer record: ${volError.message}`)

    const { error: statusError } = await supabase
      .from('volunteer_applications')
      .update({ status: 'accepted', user_id: userId })
      .eq('id', app.id)
    if (statusError) throw new Error(statusError.message)

    setApplications(prev =>
      prev.map(a => a.id === app.id ? { ...a, status: 'accepted', user_id: userId } : a)
    )
  }

  async function rejectApplication(appId: string, notes?: string) {
    const { error } = await supabase
      .from('volunteer_applications')
      .update({ status: 'rejected', ...(notes ? { admin_notes: notes } : {}) })
      .eq('id', appId)
    if (error) throw new Error(error.message)
    setApplications(prev =>
      prev.map(a => a.id === appId ? { ...a, status: 'rejected', admin_notes: notes ?? a.admin_notes } : a)
    )
  }

  return { applications, loading, acceptApplication, rejectApplication }
}
