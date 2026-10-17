import { useEffect, useState } from 'react'
import { TriangleAlert, Gauge, Users, Mic, List, ClipboardCheck, UserX, Copy, MailWarning, MessageSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAdminClasses } from './useAdminClasses'
import { useAdminStudents } from './useAdminStudents'
import { useVolunteerApplications } from './useVolunteerApplications'
import { useInterviews } from './useInterviews'
import { useAttendanceBoard } from './useAttendanceBoard'
import { rollCallLabel, localDateISO } from '../lib/campDay'
import { useSessions } from './useSessions'
import { supabase } from '../lib/supabase'

// One pair from possible_duplicate_campers() (spec 14b).
interface DuplicatePair { a_id: string; a_name: string; a_parent: string | null; b_id: string; b_name: string; b_parent: string | null; reason: string }

// A single row in the "Needs attention" work queue. The hook hands the component fully-resolved
// presentation data (classes + copy + CTA) so AdminDashboard stays a declarative renderer (§2).
export interface AttentionItem {
  key: string
  icon: LucideIcon
  iconWrap: string // e.g. 'bg-danger-soft text-danger'
  cardCls: string // danger edge for the full-class item; '' otherwise
  badge: string | null
  badgeCls: string | null
  title: string
  detail: string
  ctaLabel: string
  to: string
  wide: boolean // danger item spans both columns
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)))
}

// Composes the existing admin hooks into a prioritized work queue. Every item is derived from
// real data; an item is only produced when its count is > 0, so the caller can render the
// all-clear empty state simply by checking `items.length`.
export function useAdminAttention(): { items: AttentionItem[]; loading: boolean } {
  const { classes, loading: classesLoading } = useAdminClasses()
  const { students, loading: studentsLoading } = useAdminStudents()
  const { applications, loading: appsLoading } = useVolunteerApplications()
  const { slots, loading: interviewsLoading } = useInterviews()
  const { sections: boardSections, session: todaySession, loading: boardLoading } = useAttendanceBoard()
  const { sessions, loading: sessionsLoading } = useSessions()
  // Possible duplicate campers (same name, different accounts); an error just hides the item.
  const [dupes, setDupes] = useState<DuplicatePair[] | null>(null)
  // Emails that failed for good (3 attempts) — spec 09.
  const [failedEmails, setFailedEmails] = useState(0)
  // Parents' open change requests (spec 11).
  const [openRequests, setOpenRequests] = useState(0)
  useEffect(() => {
    let alive = true
    supabase.rpc('possible_duplicate_campers').then(({ data, error }) => {
      if (alive) setDupes(error ? [] : ((data ?? []) as DuplicatePair[]))
    })
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('attempts', 3)
      .then(({ count }) => { if (alive) setFailedEmails(count ?? 0) })
    supabase.from('change_requests').select('id', { count: 'exact', head: true }).eq('status', 'open')
      .then(({ count }) => { if (alive) setOpenRequests(count ?? 0) })
    return () => { alive = false }
  }, [])

  const loading = classesLoading || studentsLoading || appsLoading || interviewsLoading || boardLoading
    || sessionsLoading || dupes === null

  const items: AttentionItem[] = []
  if (loading) return { items, loading }

  // ── 0. Camp day: campers unaccounted for right now (top of the list while camp is on) ──
  if (todaySession) {
    const missing = boardSections.flatMap(s => s.unaccounted.map(st => ({ st, s })))
    const untaken = boardSections.filter(s => s.latest === null)
    if (missing.length > 0) {
      const first = missing[0]
      items.push({
        key: 'unaccounted',
        icon: TriangleAlert,
        iconWrap: 'bg-danger-soft text-danger',
        cardCls: 'border-danger ring-1 ring-danger',
        badge: 'Now',
        badgeCls: 'bg-danger-soft text-danger',
        title: `${missing.length} ${plural(missing.length, 'camper is', 'campers are')} unaccounted for`,
        detail: `${first.st.full_name} · ${first.s.className} ${first.s.label} — missed ${rollCallLabel(first.s.latest!)}${missing.length > 1 ? ` · ${missing.length - 1} more` : ''}`,
        ctaLabel: 'Open attendance',
        to: '/admin/attendance',
        wide: true,
      })
    } else if (untaken.length > 0) {
      items.push({
        key: 'no-roll-call',
        icon: ClipboardCheck,
        iconWrap: 'bg-warning-soft text-warning',
        cardCls: '',
        badge: null,
        badgeCls: null,
        title: `${untaken.length} ${plural(untaken.length, 'section has', 'sections have')} no roll call yet today`,
        detail: untaken.map(s => `${s.className} ${s.label}`).slice(0, 3).join(' · '),
        ctaLabel: 'Open attendance',
        to: '/admin/attendance',
        wide: false,
      })
    }
  }

  // ── Per-section seat/waitlist tally from real registrations ──────────────
  const bySection = new Map<string, { taken: number; waitlisted: number }>()
  for (const st of students) {
    for (const r of st.registrations) {
      const e = bySection.get(r.section_id) ?? { taken: 0, waitlisted: 0 }
      if (r.status === 'waitlisted') e.waitlisted++
      else if (r.status !== 'cancelled') e.taken++ // pending/confirmed occupy a seat
      bySection.set(r.section_id, e)
    }
  }

  const sectionRows = classes.flatMap(c =>
    c.sections.map(s => {
      const counts = bySection.get(s.id) ?? { taken: 0, waitlisted: 0 }
      return { className: c.name, label: s.label, capacity: s.capacity, ...counts }
    }),
  )

  // ── 1. Class full / nearly full (highest priority → danger edge) ─────────
  const fullSecs = sectionRows.filter(s => s.capacity > 0 && s.taken >= s.capacity)
  const nearSecs = sectionRows.filter(
    s => s.capacity > 0 && s.taken < s.capacity && s.taken / s.capacity >= 0.9,
  )
  const capacitySecs = [...fullSecs, ...nearSecs]
  if (capacitySecs.length > 0) {
    const anyFull = fullSecs.length > 0
    // Surface the most pressing section: a full one with the longest waitlist, else the fullest.
    const focus = anyFull
      ? [...fullSecs].sort((a, b) => b.waitlisted - a.waitlisted)[0]
      : [...nearSecs].sort((a, b) => b.taken / b.capacity - a.taken / a.capacity)[0]
    const waitNote = focus.waitlisted > 0 ? `, ${focus.waitlisted} waitlisted` : ''
    // Say what the rest are rather than a bare "+N more": other full sections, then nearly full ones.
    const otherFull = anyFull ? fullSecs.length - 1 : 0
    const otherNear = anyFull ? nearSecs.length : nearSecs.length - 1
    const moreNote =
      (otherFull > 0 ? ` · ${otherFull} more full` : '') +
      (otherNear > 0 ? ` · ${otherNear} ${anyFull ? '' : 'more '}nearly full` : '')
    items.push({
      key: 'capacity',
      icon: anyFull ? TriangleAlert : Gauge,
      iconWrap: anyFull ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
      cardCls: anyFull ? 'border-danger ring-1 ring-danger' : '',
      badge: anyFull ? 'Full' : null,
      badgeCls: anyFull ? 'bg-danger-soft text-danger' : null,
      title: anyFull
        ? `${fullSecs.length} ${plural(fullSecs.length, 'section is', 'sections are')} at capacity`
        : `${nearSecs.length} ${plural(nearSecs.length, 'section is', 'sections are')} nearly full`,
      detail: `${focus.className} · ${focus.label} — ${focus.taken}/${focus.capacity}${waitNote}${moreNote}`,
      ctaLabel: 'Review classes',
      to: '/admin/classes',
      wide: anyFull,
    })
  }

  // ── 1b. Sections with no lead in a session that hasn't ended (spec 14) ───
  const today = localDateISO()
  const liveSessionIds = new Set(sessions.filter(se => se.is_active && se.end_date >= today).map(se => se.id))
  const noLead = classes.flatMap(c => c.sections
    .filter(sec => !sec.cancelled_at && !sec.lead_id
      // A both-weeks section (no session) counts while any session is still to come.
      && (sec.session_id ? liveSessionIds.has(sec.session_id) : liveSessionIds.size > 0))
    .map(sec => ({ className: c.name, label: sec.label, week: sec.week })))
  if (noLead.length > 0) {
    const first = noLead[0]
    items.push({
      key: 'no-lead',
      icon: UserX,
      iconWrap: 'bg-danger-soft text-danger',
      cardCls: '',
      badge: null,
      badgeCls: null,
      title: `${noLead.length} ${plural(noLead.length, 'section has', 'sections have')} no lead`,
      detail: `${first.className} · ${first.label}${first.week ? ` (Week ${first.week})` : ''}${noLead.length > 1 ? ` · ${noLead.length - 1} more` : ''}`,
      ctaLabel: 'Assign a lead',
      to: '/admin/classes',
      wide: false,
    })
  }

  // ── 1c. Possible duplicate campers (spec 14b) ────────────────────────────
  if (dupes && dupes.length > 0) {
    const first = dupes[0]
    items.push({
      key: 'duplicates',
      icon: Copy,
      iconWrap: 'bg-warning-soft text-warning',
      cardCls: '',
      badge: null,
      badgeCls: null,
      title: `${dupes.length} possible duplicate ${plural(dupes.length, 'camper', 'campers')}`,
      detail: `${first.a_name} (${first.a_parent ?? 'one account'}) and ${first.b_name} (${first.b_parent ?? 'another account'}): ${first.reason}`,
      ctaLabel: 'Review campers',
      to: `/admin/students?q=${encodeURIComponent(first.a_name)}`,
      wide: false,
    })
  }

  // ── 1c2. Change requests from families (spec 11) ─────────────────────────
  if (openRequests > 0) {
    items.push({
      key: 'change-requests',
      icon: MessageSquare,
      iconWrap: 'bg-warning-soft text-warning',
      cardCls: '',
      badge: null,
      badgeCls: null,
      title: `${openRequests} change ${plural(openRequests, 'request', 'requests')} from families`,
      detail: 'Online changes have closed for these spots, so the family asked the camp.',
      ctaLabel: 'Review requests',
      to: '/admin/students#requests',
      wide: false,
    })
  }

  // ── 1d. Emails that couldn't be sent (spec 09) ───────────────────────────
  if (failedEmails > 0) {
    items.push({
      key: 'failed-emails',
      icon: MailWarning,
      iconWrap: 'bg-danger-soft text-danger',
      cardCls: '',
      badge: null,
      badgeCls: null,
      title: `${failedEmails} ${plural(failedEmails, "email couldn't", "emails couldn't")} be sent`,
      detail: 'Families may not know about a confirmation or change. Check the email log.',
      ctaLabel: 'Open email log',
      to: '/admin/updates',
      wide: false,
    })
  }

  // ── 2. Volunteer applications pending review ─────────────────────────────
  const pending = applications.filter(a => a.status === 'pending')
  if (pending.length > 0) {
    const oldest = Math.max(...pending.map(a => daysSince(a.created_at)))
    items.push({
      key: 'volunteers',
      icon: Users,
      iconWrap: 'bg-role-volunteer-soft text-role-volunteer',
      cardCls: '',
      badge: null,
      badgeCls: null,
      title: `${pending.length} volunteer ${plural(pending.length, 'application', 'applications')} pending`,
      detail: `Awaiting review — oldest is ${oldest} ${plural(oldest, 'day', 'days')} old`,
      ctaLabel: 'Review applications',
      to: '/admin/volunteers?tab=applications',
      wide: false,
    })
  }

  // ── 3. Applicants awaiting review who haven't picked an interview time ────
  // (the interview comes before a decision, so this is about pending applications)
  const bookedAppIds = new Set(slots.filter(s => s.booking).map(s => s.booking!.application_id))
  const unscheduled = applications.filter(a => a.status === 'pending' && !bookedAppIds.has(a.id))
  if (unscheduled.length > 0) {
    items.push({
      key: 'interviews',
      icon: Mic,
      iconWrap: 'bg-info-soft text-info',
      cardCls: '',
      badge: null,
      badgeCls: null,
      title: `${unscheduled.length} ${plural(unscheduled.length, 'applicant has', 'applicants have')} no interview yet`,
      detail: "They haven't picked a time — post more slots or book them in",
      ctaLabel: 'Open interviews',
      to: '/admin/interviews',
      wide: false,
    })
  }

  // ── 4. Waitlisted campers who can now be placed ──────────────────────────
  const placeable = sectionRows.filter(s => s.capacity > 0 && s.taken < s.capacity && s.waitlisted > 0)
  if (placeable.length > 0) {
    items.push({
      key: 'waitlist',
      icon: List,
      iconWrap: 'bg-info-soft text-info',
      cardCls: '',
      badge: null,
      badgeCls: null,
      title: 'Waitlist spots opened up',
      detail: `Open seats in ${placeable.length} ${plural(placeable.length, 'section', 'sections')} with campers waiting`,
      ctaLabel: 'Place campers',
      to: '/admin/students',
      wide: false,
    })
  }

  return { items, loading }
}
