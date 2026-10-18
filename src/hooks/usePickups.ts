import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PickupDraft } from '../lib/pickups'
import type { AuthorizedPickup, LeaveMode, ReleaseConsent } from '../types/database'

// One camper's pickup list and walk-home consents (spec 36), for the parent's camper card. RLS
// lets a parent read and change their own campers' rows; consents only until their week ends.
export function usePickups(studentId: string, enabled: boolean) {
  const [pickups, setPickups] = useState<AuthorizedPickup[] | null>(null)
  const [consents, setConsents] = useState<ReleaseConsent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from('authorized_pickups').select('*').eq('student_id', studentId).order('created_at'),
      supabase.from('release_consents').select('*').eq('student_id', studentId),
    ])
    const err = p.error ?? c.error
    // A failed reload keeps what's on screen.
    if (err) { setError(err.message); return }
    setPickups((p.data ?? []) as AuthorizedPickup[])
    setConsents((c.data ?? []) as ReleaseConsent[])
    setError(null)
  }, [studentId])

  useEffect(() => {
    if (!enabled) return
    void Promise.resolve().then(load)
  }, [enabled, load])

  const done = async (res: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await res
    if (error) throw new Error(error.message)
    await load()
  }

  return {
    pickups, consents, error, reload: load,
    // id null adds a new adult.
    savePickup: (id: string | null, d: PickupDraft, days: string[] | null) => {
      const row = { name: d.name.trim(), relation: d.relation.trim(), phone: d.phone.trim(), days }
      return done(id
        ? supabase.from('authorized_pickups').update(row).eq('id', id)
        : supabase.from('authorized_pickups').insert({ ...row, student_id: studentId }))
    },
    removePickup: (id: string) => done(supabase.from('authorized_pickups').delete().eq('id', id)),
    saveConsent: (sessionId: string, mode: LeaveMode, days: string[] | null, note: string) =>
      done(supabase.from('release_consents').upsert(
        { student_id: studentId, session_id: sessionId, mode, days, note: note.trim() || null },
        { onConflict: 'student_id,session_id' })),
    removeConsent: (id: string) => done(supabase.from('release_consents').delete().eq('id', id)),
  }
}

// The registration wizard's pickup step (spec 36), saved once the camper exists. "Only I will pick
// up" (`onlyMe`) clears the camper's whole list, dated adults included. Otherwise the wizard edits
// the any-day adults: `keep` are the ids it loaded (a returning camper), and any of them no longer
// in `adults` is removed; dated adults are left alone (they're changed on Home). A consent covers
// every day of each week in `sessionIds`. Returns what failed, or null.
export async function saveWizardPickups(studentId: string, onlyMe: boolean, adults: (PickupDraft & { id?: string })[], keep: string[],
  consent: { mode: LeaveMode; note: string } | null, sessionIds: string[]): Promise<string | null> {
  const kept = new Set(adults.map(a => a.id).filter(Boolean))
  const gone = keep.filter(id => !kept.has(id))
  const row = (a: PickupDraft) => ({ name: a.name.trim(), relation: a.relation.trim(), phone: a.phone.trim() })
  const steps: PromiseLike<{ error: { message: string } | null }>[] = [
    ...(onlyMe ? [supabase.from('authorized_pickups').delete().eq('student_id', studentId)]
      : gone.length ? [supabase.from('authorized_pickups').delete().in('id', gone)] : []),
    ...adults.filter(a => a.id).map(a => supabase.from('authorized_pickups').update(row(a)).eq('id', a.id!)),
  ]
  const fresh = adults.filter(a => !a.id)
  if (fresh.length) steps.push(supabase.from('authorized_pickups').insert(fresh.map(a => ({ ...row(a), student_id: studentId }))))
  if (consent && sessionIds.length) {
    steps.push(supabase.from('release_consents').upsert(
      sessionIds.map(session_id => ({ student_id: studentId, session_id, mode: consent.mode, days: null, note: consent.note.trim() || null })),
      { onConflict: 'student_id,session_id' }))
  }
  const results = await Promise.all(steps)
  return results.find(r => r.error)?.error?.message ?? null
}
