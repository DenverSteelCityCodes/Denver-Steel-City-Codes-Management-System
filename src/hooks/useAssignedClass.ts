import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { PickupAdult } from '../lib/pickups'

export interface AssignedStudent {
  id: string
  full_name: string
  age: number
  medical_info: string | null
  allergies: string | null
  medical_conditions: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  parent_name: string | null
  parent_phone: string | null
  // 'reserved' or 'handed_out' when the camper borrows a camp laptop that week (spec 29), else null.
  laptop_loan?: string | null
  // Spec 36: today's pickup list (phones for the section's lead only) and the parent's consent to
  // leave on their own today ('walk' / 'bike' / 'transit' / 'other').
  pickup_adults?: PickupAdult[] | null
  may_leave_alone_today?: boolean
  leave_alone_mode?: string | null
  leave_alone_note?: string | null
}

export interface AssignedSection {
  id: string
  label: string
  age_min: number
  age_max: number
  capacity: number
  week: 1 | 2 | null
  session_id: string | null
  days: string
  start_time: string | null
  end_time: string | null
  room: string | null
  class_id: string
  class_name: string
  // True when the volunteer leads the section (may post updates); false for supports.
  is_lead: boolean
  students: AssignedStudent[]
}

// Row shape of the sections select used for both lead and support assignments.
interface RawSection {
  id: string
  label: string
  age_min: number
  age_max: number
  capacity: number
  week: 1 | 2 | null
  session_id: string | null
  days: string
  start_time: string | null
  end_time: string | null
  room: string | null
  class_id: string
  classes: { name: string } | null
}

const SECTION_COLS = 'id, label, age_min, age_max, capacity, week, session_id, days, start_time, end_time, room, class_id, classes ( name )'

export function useAssignedClass() {
  const { user } = useAuth()
  const [assignedSections, setAssignedSections] = useState<AssignedSection[]>([])
  const [isAccepted, setIsAccepted] = useState(false)
  // Latest application status, so a rejected applicant isn't told "under review" forever.
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
  const [appliedAt, setAppliedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchAssignedSections()
  }, [user])

  async function fetchAssignedSections() {
    setLoading(true)
    setError(null)

    const [leadRes, supportRes, volunteerRes, appRes] = await Promise.all([
      // Sections where volunteer is the lead
      supabase
        .from('sections')
        .select(SECTION_COLS)
        .eq('lead_id', user!.id)
        .is('cancelled_at', null),
      // Section IDs where volunteer is a support
      supabase
        .from('section_supports')
        .select('section_id')
        .eq('volunteer_id', user!.id),
      supabase.from('volunteers').select('id').eq('id', user!.id).maybeSingle(),
      // RPC, not a table read: applicants can't SELECT volunteer_applications (admin notes).
      supabase.rpc('my_volunteer_application').maybeSingle(),
    ])

    // A failed lookup must not read as "not accepted" / "under review" — surface it instead.
    const lookupErr = volunteerRes.error ?? appRes.error
    if (lookupErr) { setError(lookupErr.message); setLoading(false); return }
    setIsAccepted(!!volunteerRes.data)
    const app = appRes.data as { status: string; created_at: string } | null
    setApplicationStatus(app?.status ?? null)
    setAppliedAt(app?.created_at ?? null)

    if (leadRes.error) { setError(leadRes.error.message); setLoading(false); return }
    if (supportRes.error) { setError(supportRes.error.message); setLoading(false); return }

    // Fetch full section data for support assignments, avoiding duplicates with lead sections
    const leadSections = (leadRes.data ?? []) as unknown as RawSection[]
    const leadIds = new Set(leadSections.map(s => s.id))
    const supportSectionIds = (supportRes.data ?? [])
      .map(r => r.section_id as string)
      .filter(id => !leadIds.has(id))

    let supportSections: RawSection[] = []
    if (supportSectionIds.length > 0) {
      const { data, error } = await supabase
        .from('sections')
        .select(SECTION_COLS)
        .in('id', supportSectionIds)
        .is('cancelled_at', null)
      if (error) { setError(error.message); setLoading(false); return }
      supportSections = (data ?? []) as unknown as RawSection[]
    }

    const allSections = [...leadSections, ...supportSections]
    const leadIdSet = new Set(leadSections.map(s => s.id))

    if (allSections.length === 0) {
      setAssignedSections([])
      setLoading(false)
      return
    }

    let rosterErr: string | null = null
    const result: AssignedSection[] = await Promise.all(
      allSections.map(async sec => {
        // Crew can't read students directly; section_roster returns only roster fields, only for
        // campers holding a seat in this section.
        const { data, error: rosterRpcErr } = await supabase.rpc('section_roster', { p_section_id: sec.id })
        if (rosterRpcErr) rosterErr = rosterRpcErr.message
        const students = (data ?? []) as AssignedStudent[]

        return {
          id: sec.id,
          label: sec.label,
          age_min: sec.age_min,
          age_max: sec.age_max,
          capacity: sec.capacity,
          week: sec.week,
          session_id: sec.session_id,
          days: sec.days,
          start_time: sec.start_time,
          end_time: sec.end_time,
          room: sec.room,
          class_id: sec.class_id,
          class_name: sec.classes?.name ?? '',
          is_lead: leadIdSet.has(sec.id),
          students,
        }
      })
    )

    // An empty roster from a failed query would read as "no students enrolled".
    if (rosterErr) { setError(rosterErr); setLoading(false); return }
    setAssignedSections(result)
    setLoading(false)
  }

  return { assignedSections, isAccepted, applicationStatus, appliedAt, loading, error, refetch: fetchAssignedSections }
}
