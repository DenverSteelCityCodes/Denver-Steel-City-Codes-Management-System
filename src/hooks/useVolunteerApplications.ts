import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import type { VolunteerApplication, ExperienceLevel } from '../types/database'

// Paged past the API's 1,000-row cap (spec 18).
function loadApplications() {
  return fetchAll<VolunteerApplication>(async (from, to) => supabase
    .from('volunteer_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to))
}

export function useVolunteerApplications() {
  const [applications, setApplications] = useState<VolunteerApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadApplications()
      .catch(() => [] as VolunteerApplication[])
      .then(data => {
        if (cancelled) return
        setApplications(data)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // A quiet reload: the list stays on screen, and a failed reload keeps the last good copy.
  const refetch = useCallback(async () => {
    try { setApplications(await loadApplications()) } catch { /* keep what's shown */ }
  }, [])

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

      // The email on an application isn't verified (anyone can type any address), so matching by
      // email must never change what an existing parent or admin account can do.
      const { data: existing, error: profError } = await supabase
        .from('profiles').select('role').eq('id', userId).maybeSingle()
      if (profError) throw new Error(profError.message)
      if (!existing) throw new Error(`The account for ${app.email} has no profile yet. Ask them to sign in once, then accept again.`)
      if (existing.role !== 'volunteer') {
        throw new Error(
          `${app.email} already belongs to ${existing.role === 'admin' ? 'an admin' : `a ${existing.role}`} account. ` +
          'Accepting would replace that role. If this person should become a volunteer, change their role under Users first.'
        )
      }
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

  return { applications, loading, acceptApplication, rejectApplication, refetch }
}
