import { TriangleAlert, Gauge, Users, Mic, List, ClipboardCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAdminClasses } from './useAdminClasses'
import { useAdminStudents } from './useAdminStudents'
import { useVolunteerApplications } from './useVolunteerApplications'
import { useInterviews } from './useInterviews'
import { useAttendanceBoard } from './useAttendanceBoard'
import { rollCallLabel } from '../lib/campDay'

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

  const loading = classesLoading || studentsLoading || appsLoading || interviewsLoading || boardLoading

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
