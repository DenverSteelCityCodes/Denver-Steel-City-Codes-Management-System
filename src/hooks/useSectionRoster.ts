import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface RosterSection {
  id: string
  label: string
  week: number | null
  days: string
  start_time: string | null
  end_time: string | null
  room: string | null
  class_name: string
  lead_name: string | null
}

export interface RosterStudent {
  id: string
  full_name: string
  age: number | null
  grade: string | null
  allergies: string | null
  medical_conditions: string | null
  medical_info: string | null
  parent_name: string | null
  parent_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  email: string | null
}

interface SectionRow {
  id: string
  label: string
  week: number | null
  days: string
  start_time: string | null
  end_time: string | null
  room: string | null
  classes: { name: string } | null
}

const STUDENT_COLS =
  'id, full_name, age, grade, allergies, medical_conditions, medical_info, parent_name, parent_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, email'

interface State {
  forId: string | undefined
  section: RosterSection | null
  students: RosterStudent[]
  error: string | null
}

export function useSectionRoster(sectionId: string | undefined) {
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    if (!sectionId) return
    let cancelled = false
    ;(async () => {
      const { data: sec, error: secErr } = await supabase
        .from('sections')
        .select('id, label, week, days, start_time, end_time, room, classes ( name )')
        .eq('id', sectionId)
        .maybeSingle()
      if (cancelled) return
      if (secErr) { setState({ forId: sectionId, section: null, students: [], error: secErr.message }); return }
      if (!sec) { setState({ forId: sectionId, section: null, students: [], error: null }); return }
      const row = sec as unknown as SectionRow

      const [regRes, leadRes] = await Promise.all([
        supabase
          .from('registrations')
          .select(`students ( ${STUDENT_COLS} )`)
          .eq('section_id', sectionId)
          .in('status', ['confirmed', 'pending']),
        // Admin-only join (volunteers can't read other volunteers' profiles); errors are ignored.
        supabase
          .from('sections')
          .select('lead:volunteers!sections_lead_id_fkey ( profile:profiles ( display_name ) )')
          .eq('id', sectionId)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (regRes.error) { setState({ forId: sectionId, section: null, students: [], error: regRes.error.message }); return }

      const students = ((regRes.data ?? []) as unknown as { students: RosterStudent | RosterStudent[] | null }[])
        .flatMap(r => (Array.isArray(r.students) ? r.students : r.students ? [r.students] : []))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))

      let leadName: string | null = null
      if (!leadRes.error && leadRes.data) {
        const lead = (leadRes.data as unknown as { lead: { profile: { display_name: string } | null } | null }).lead
        leadName = lead?.profile?.display_name ?? null
      }

      setState({
        forId: sectionId,
        error: null,
        students,
        section: {
          id: row.id, label: row.label, week: row.week, days: row.days,
          start_time: row.start_time, end_time: row.end_time, room: row.room,
          class_name: row.classes?.name ?? '', lead_name: leadName,
        },
      })
    })()
    return () => { cancelled = true }
  }, [sectionId])

  const ready = !!sectionId && state?.forId === sectionId
  return {
    section: ready ? state!.section : null,
    students: ready ? state!.students : [],
    loading: !!sectionId && !ready,
    error: ready ? state!.error : null,
  }
}
