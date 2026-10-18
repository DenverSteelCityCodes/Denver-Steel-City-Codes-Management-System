import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRefetchOnFocus } from './useRefetchOnFocus'
import { heldKeys, markKey, mergeMarks } from '../lib/campDay'
import type { RollCallKind, RollCallMark } from '../types/database'

// Roll-call marks for one section on one day. Writes are upserts keyed on
// (section, student, day, roll_call); the DB stamps marked_by = the caller via RLS.
export function useRollCalls(sectionId: string | undefined, day: string) {
  const { user } = useAuth()
  const [marks, setMarks] = useState<RollCallMark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Reads are numbered as they start; a slower, older read never replaces a newer one.
  const reads = useRef({ started: 0, applied: 0 })
  // This screen's own writes by mark key: the first read sure to include each (see heldKeys).
  const guards = useRef(new Map<string, number>())

  const fetchMarks = useCallback(() => {
    if (!sectionId) return Promise.resolve()
    const seq = ++reads.current.started
    return supabase
      .from('roll_call_marks')
      .select('*')
      .eq('section_id', sectionId)
      .eq('day', day)
      .then(({ data, error }) => {
        if (seq < reads.current.applied) return
        reads.current.applied = seq
        if (error) setError(error.message)
        else {
          const held = heldKeys(guards.current, seq)
          const fresh = (data ?? []) as RollCallMark[]
          setMarks(prev => mergeMarks(prev, fresh, held))
          setError(null)
        }
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

  // keepExisting: never overwrite a mark that is already in the database, even one this screen
  // has not loaded yet (a co-volunteer's "absent" from the last minute).
  async function setMarks_(
    rows: { student_id: string; roll_call: RollCallKind; present: boolean }[],
    keepExisting = false,
  ) {
    if (!sectionId || !user || rows.length === 0) return
    const payload = rows.map(r => ({
      section_id: sectionId, student_id: r.student_id, day, roll_call: r.roll_call,
      present: r.present, marked_by: user.id, marked_at: new Date().toISOString(),
    }))
    const keys = new Set(rows.map(r => markKey(r.student_id, r.roll_call)))
    const isMine = (m: RollCallMark) => keys.has(markKey(m.student_id, m.roll_call))
    const before = marks.filter(isMine)
    // Optimistic: apply locally first so a phone tap feels instant. Other rows stay live meanwhile,
    // so hold these marks until a read that includes the write.
    for (const k of keys) guards.current.set(k, Infinity)
    setMarks(prev => [...prev.filter(m => !isMine(m)), ...payload.map(p => ({ ...p, id: crypto.randomUUID(), note: null }))])
    const { error } = await supabase
      .from('roll_call_marks')
      .upsert(payload, { onConflict: 'section_id,student_id,day,roll_call', ignoreDuplicates: keepExisting })
    if (error) {
      // Show what the screen had before the tap, then read the truth.
      for (const k of keys) guards.current.delete(k)
      setMarks(prev => [...prev.filter(m => !isMine(m)), ...before])
      await fetchMarks()
      throw new Error(error.message)
    }
    // Every read that starts from here on includes this write.
    for (const k of keys) guards.current.set(k, reads.current.started + 1)
    await fetchMarks()
  }

  // One camper, one roll call.
  async function setMark(studentId: string, rollCall: RollCallKind, present: boolean) {
    await setMarks_([{ student_id: studentId, roll_call: rollCall, present }])
  }

  // "Mark all present": every camper not yet marked for this roll call becomes present.
  // "Not yet marked" is decided by the database, not by this screen's copy of the marks.
  async function markAllPresent(studentIds: string[], rollCall: RollCallKind) {
    const missing = studentIds.filter(id => !getMark(id, rollCall))
    await setMarks_(missing.map(id => ({ student_id: id, roll_call: rollCall, present: true })), true)
  }

  return { marks, loading: sectionId ? loading : false, error, getMark, taken, setMark, markAllPresent, refetch: fetchMarks }
}
