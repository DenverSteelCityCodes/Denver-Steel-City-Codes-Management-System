import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROLL_CALLS, localDateISO, sessionOnDay } from '../lib/campDay'
import { realNote } from '../lib/campers'
import { useRefetchOnFocus } from './useRefetchOnFocus'
import type { RollCallKind, Session } from '../types/database'

export interface BoardStudent {
  id: string
  full_name: string
  age: number
  parent_name: string | null
  parent_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  medicalNote: string | null
  marks: Partial<Record<RollCallKind, boolean>>
}

export interface RollCallSummary {
  taken: boolean
  present: number
  absent: number
  unmarked: number
  takenAt: string | null
}

export interface BoardSection {
  id: string
  label: string
  week: number | null
  className: string
  leadName: string | null
  room: string | null
  roster: BoardStudent[]
  rollCalls: Record<RollCallKind, RollCallSummary>
  latest: RollCallKind | null
  unaccounted: BoardStudent[]
}

interface StudentRow {
  id: string
  full_name: string
  age: number
  allergies: string | null
  medical_conditions: string | null
  medical_info: string | null
  parent_name: string | null
  parent_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

interface SectionRow {
  id: string
  label: string
  week: number | null
  room: string | null
  classes: { name: string } | null
  lead: { profile: { display_name: string } | null } | null
  registrations: { status: string; students: StudentRow | null }[] | null
}

interface MarkRow {
  section_id: string
  student_id: string
  roll_call: RollCallKind
  present: boolean
  marked_at: string
}

export function useAttendanceBoard() {
  const [today] = useState(() => localDateISO())
  const [session, setSession] = useState<Session | null>(null)
  const [nextSession, setNextSession] = useState<Session | null>(null)
  const [sections, setSections] = useState<BoardSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refetch = useCallback(async () => {
    const day = localDateISO()
    const { data: sessionRows, error: sErr } = await supabase
      .from('sessions').select('*').order('start_date', { ascending: true })
    if (sErr) { setError(sErr.message); setLoading(false); return }
    const all = (sessionRows ?? []) as Session[]
    const current = sessionOnDay(all, day)
    setSession(current)
    setNextSession(all.find(s => s.is_active && s.start_date > day) ?? null)

    if (!current) {
      setSections([])
      setError(null)
      setLastUpdated(new Date())
      setLoading(false)
      return
    }

    const [secRes, markRes] = await Promise.all([
      supabase
        .from('sections')
        .select(`
          id, label, week, room,
          classes ( name ),
          lead:volunteers!sections_lead_id_fkey ( profile:profiles ( display_name ) ),
          registrations ( status, students ( id, full_name, age, allergies, medical_conditions, medical_info, parent_name, parent_phone, emergency_contact_name, emergency_contact_phone ) )
        `)
        .eq('session_id', current.id),
      supabase
        .from('roll_call_marks')
        .select('section_id, student_id, roll_call, present, marked_at')
        .eq('day', day),
    ])
    if (secRes.error || markRes.error) {
      setError((secRes.error ?? markRes.error)?.message ?? 'Could not load attendance.')
      setLoading(false)
      return
    }

    const marks = (markRes.data ?? []) as MarkRow[]
    const marksBySection = new Map<string, MarkRow[]>()
    for (const m of marks) {
      const list = marksBySection.get(m.section_id) ?? []
      list.push(m)
      marksBySection.set(m.section_id, list)
    }

    const built: BoardSection[] = ((secRes.data ?? []) as unknown as SectionRow[]).map(sec => {
      const secMarks = marksBySection.get(sec.id) ?? []
      const roster: BoardStudent[] = (sec.registrations ?? [])
        .filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.students)
        .map(r => {
          const s = r.students as StudentRow
          const allergies = realNote(s.allergies)
          const medical = realNote(s.medical_conditions) ?? realNote(s.medical_info)
          const medicalNote = [allergies && `Allergies: ${allergies}`, medical && `Medical: ${medical}`]
            .filter(Boolean).join(' · ') || null
          const marksFor: Partial<Record<RollCallKind, boolean>> = {}
          for (const m of secMarks) if (m.student_id === s.id) marksFor[m.roll_call] = m.present
          return {
            id: s.id,
            full_name: s.full_name,
            age: s.age,
            parent_name: s.parent_name,
            parent_phone: s.parent_phone,
            emergency_contact_name: s.emergency_contact_name,
            emergency_contact_phone: s.emergency_contact_phone,
            medicalNote,
            marks: marksFor,
          }
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name))

      const rollCalls = {} as Record<RollCallKind, RollCallSummary>
      let latest: RollCallKind | null = null
      for (const { key } of ROLL_CALLS) {
        const ids = new Set(roster.map(s => s.id))
        const kindMarks = secMarks.filter(m => m.roll_call === key && ids.has(m.student_id))
        const present = kindMarks.filter(m => m.present).length
        const absent = kindMarks.length - present
        const takenAt = kindMarks.reduce<string | null>(
          (max, m) => (max === null || m.marked_at > max ? m.marked_at : max), null)
        rollCalls[key] = {
          taken: kindMarks.length > 0,
          present,
          absent,
          unmarked: Math.max(roster.length - kindMarks.length, 0),
          takenAt,
        }
        if (kindMarks.length > 0) latest = key
      }
      const unaccounted = latest ? roster.filter(s => s.marks[latest] !== true) : []

      return {
        id: sec.id,
        label: sec.label,
        week: sec.week,
        className: sec.classes?.name ?? 'Class',
        leadName: sec.lead?.profile?.display_name ?? null,
        room: sec.room,
        roster,
        rollCalls,
        latest,
        unaccounted,
      }
    })
    built.sort((a, b) => a.className.localeCompare(b.className) || a.label.localeCompare(b.label))

    setSections(built)
    setError(null)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    Promise.resolve().then(refetch)
  }, [refetch])

  const silentRefetch = useCallback(() => { void refetch() }, [refetch])
  useRefetchOnFocus(silentRefetch, 60_000)

  return { today, session, nextSession, sections, loading, error, refetch: silentRefetch, lastUpdated }
}
