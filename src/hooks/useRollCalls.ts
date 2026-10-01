import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRefetchOnFocus } from './useRefetchOnFocus'
import type { RollCallKind, RollCallMark } from '../types/database'

// Roll-call marks for one section on one day. Writes are upserts keyed on
// (section, student, day, roll_call); the DB stamps marked_by = the caller via RLS.
export function useRollCalls(sectionId: string | undefined, day: string) {
  const { user } = useAuth()
  const [marks, setMarks] = useState<RollCallMark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMarks = useCallback(() => {
    if (!sectionId) return Promise.resolve()
    return supabase
      .from('roll_call_marks')
      .select('*')
      .eq('section_id', sectionId)
      .eq('day', day)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setMarks((data ?? []) as RollCallMark[])
        setLoading(false)
      })
  }, [sectionId, day])

  useEffect(() => { void fetchMarks() }, [fetchMarks])
  useRefetchOnFocus(fetchMarks, 60_000, !!sectionId)

  function getMark(studentId: string, rollCall: RollCallKind): RollCallMark | null {
    return marks.find(m => m.student_id === studentId && m.roll_call === rollCall) ?? null
  }

  // Has this roll call been taken at all (any mark for the section today)?
  function taken(rollCall: RollCallKind): boolean {
    return marks.some(m => m.roll_call === rollCall)
  }

  async function setMarks_(rows: { student_id: string; roll_call: RollCallKind; present: boolean }[]) {
    if (!sectionId || !user || rows.length === 0) return
    const payload = rows.map(r => ({
      section_id: sectionId, student_id: r.student_id, day, roll_call: r.roll_call,
      present: r.present, marked_by: user.id, marked_at: new Date().toISOString(),
    }))
    // Optimistic: apply locally first so a phone tap feels instant.
    setMarks(prev => {
      const next = prev.filter(m => !rows.some(r => r.student_id === m.student_id && r.roll_call === m.roll_call))
      return [...next, ...payload.map(p => ({ ...p, id: crypto.randomUUID(), note: null }))]
    })
    const { error } = await supabase
      .from('roll_call_marks')
      .upsert(payload, { onConflict: 'section_id,student_id,day,roll_call' })
    if (error) {
      await fetchMarks()
      throw new Error(error.message)
    }
    await fetchMarks()
  }

  // One camper, one roll call.
  async function setMark(studentId: string, rollCall: RollCallKind, present: boolean) {
    await setMarks_([{ student_id: studentId, roll_call: rollCall, present }])
  }

  // "Mark all present": every camper not yet marked for this roll call becomes present.
  async function markAllPresent(studentIds: string[], rollCall: RollCallKind) {
    const missing = studentIds.filter(id => !getMark(id, rollCall))
    await setMarks_(missing.map(id => ({ student_id: id, roll_call: rollCall, present: true })))
  }

  return { marks, loading: sectionId ? loading : false, error, getMark, taken, setMark, markAllPresent, refetch: fetchMarks }
}
