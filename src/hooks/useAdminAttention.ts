import { useCallback, useEffect, useState } from 'react'
import {
  TriangleAlert, Armchair, Inbox, CalendarClock, ListChecks, ClipboardList, UserRoundX, Copy, MailWarning,
  MessageSquareText, CalendarX, BookAlert, ClipboardCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAdminClasses } from './useAdminClasses'
import { useVolunteerApplications } from './useVolunteerApplications'
import { useInterviews } from './useInterviews'
import { useAttendanceBoard } from './useAttendanceBoard'
import { rollCallLabel, localDateISO } from '../lib/campDay'
import { useSessions } from './useSessions'
import { supabase } from '../lib/supabase'

// One pair from possible_duplicate_campers() (spec 14b).
interface DuplicatePair { a_id: string; a_name: string; a_parent: string | null; b_id: string; b_name: string; b_parent: string | null; reason: string }

// A crew member's upcoming absence and a section it leaves short (spec 25).
interface CrewAbsence { absence_id: string; volunteer_name: string; from_date: string; to_date: string; class_name: string; section_label: string; week: number | null; is_lead: boolean; suggestions: string[] }

// A registration whose earlier-week prerequisite was cancelled, or whose camper missed every arrival
// roll call in it so far (admin_prerequisite_at_risk(), spec 31).
interface PrereqAtRisk { registration_id: string; student_id: string; camper_name: string; class_name: string; section_label: string; week: number | null; status: string; required_class_name: string; reason: 'cancelled' | 'absent'; missed_arrivals: number }

// How much an item matters (DESIGN.md › The Meaningful Red Rule):
//  danger    — safety or a failure: campers unaccounted for, emails that never went out. Red.
//  attention — needs a person soon: no lead, no roll call, people waiting on a reply. Ink.
//  info      — worth knowing, nothing broken: sections filling up. Ink, listed last.
export type AttentionTone = 'danger' | 'attention' | 'info'

const TONE_ORDER: Record<AttentionTone, number> = { danger: 0, attention: 1, info: 2 }

// A single row in the To do list (Today) and the bell. The hook hands over finished copy and a
// link; the components only decide how a tone looks.
export interface AttentionItem {
  key: string
  icon: LucideIcon
  tone: AttentionTone
  title: string
  detail: string
  ctaLabel: string
  to: string
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)))
}

// Opens that class on the Classes page (the ?open= deep link the search uses), so its sections show.
function classLink(classId: string | undefined) {
  return classId ? `/admin/classes?open=${encodeURIComponent(classId)}` : '/admin/classes'
}

// Composes the existing admin hooks into a work queue, most serious first. Every item is derived
// from real data and only produced when its count is > 0, so an empty list means nothing is waiting.
// `refetch` reloads quietly: the list stays on screen while it refreshes.
export function useAdminAttention(): { items: AttentionItem[]; loading: boolean; refetch: () => Promise<void> } {
  const { classes, loading: classesLoading, fillError, refetch: refetchClasses } = useAdminClasses()
  const { applications, loading: appsLoading, refetch: refetchApps } = useVolunteerApplications()
  const { slots, loading: interviewsLoading, refetch: refetchSlots } = useInterviews()
  // Polls on focus by itself (useRefetchOnFocus inside).
  const { sections: boardSections, session: todaySession, loading: boardLoading, refetch: refetchBoard } = useAttendanceBoard()
  const { sessions, loading: sessionsLoading, refetch: refetchSessions } = useSessions()
  // Possible duplicate campers (same name, different accounts); an error just hides the item.
  const [dupes, setDupes] = useState<DuplicatePair[] | null>(null)
  // Emails that failed for good (3 attempts) — spec 09.
  const [failedEmails, setFailedEmails] = useState(0)
  // Open change requests: parents (spec 11) and volunteer switches (spec 25).
  const [openRequests, setOpenRequests] = useState(0)
  // Volunteers who can't make it (spec 25).
  const [absences, setAbsences] = useState<CrewAbsence[]>([])
  // Campers who may not have the class their next class needs (spec 31).
  const [atRisk, setAtRisk] = useState<PrereqAtRisk[]>([])
  // Onboarding checklist items past due (spec 35).
  const [lateOnboarding, setLateOnboarding] = useState<{ volunteer_id: string; volunteer_name: string; task_label: string }[]>([])

  const loadExtras = useCallback(async () => {
    const [abs, dup, failed, requests, risk, onboarding] = await Promise.all([
      supabase.rpc('admin_crew_absences'),
      supabase.rpc('possible_duplicate_campers'),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('attempts', 3),
      supabase.from('change_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.rpc('admin_prerequisite_at_risk'),
      supabase.rpc('admin_onboarding_overdue'),
    ])
    return {
      absences: abs.error ? null : ((abs.data ?? []) as CrewAbsence[]),
      dupes: dup.error ? [] : ((dup.data ?? []) as DuplicatePair[]),
      failed: failed.count ?? 0,
      requests: requests.count ?? 0,
      atRisk: risk.error ? null : ((risk.data ?? []) as PrereqAtRisk[]),
      onboarding: onboarding.error ? null : ((onboarding.data ?? []) as { volunteer_id: string; volunteer_name: string; task_label: string }[]),
    }
  }, [])

  const applyExtras = useCallback((x: Awaited<ReturnType<typeof loadExtras>>) => {
    if (x.absences) setAbsences(x.absences)
    setDupes(x.dupes)
    setFailedEmails(x.failed)
    setOpenRequests(x.requests)
    if (x.atRisk) setAtRisk(x.atRisk)
    if (x.onboarding) setLateOnboarding(x.onboarding)
  }, [])

  useEffect(() => {
    let alive = true
    void loadExtras().then(x => { if (alive) applyExtras(x) })
    return () => { alive = false }
  }, [loadExtras, applyExtras])

  async function refetch() {
    // The roll-call board too, so the rail, the bell and Today agree right after a roll call.
    refetchBoard()
    const [x] = await Promise.all([loadExtras(), refetchClasses(), refetchApps(), refetchSlots(), refetchSessions()])
    applyExtras(x)
  }

  // Loading means "nothing to show yet". Once the first load lands, a refresh keeps the current
  // list on screen instead of dropping back to skeletons.
  const firstLoad = classesLoading || appsLoading || interviewsLoading || boardLoading || sessionsLoading || dupes === null
  const [settled, setSettled] = useState(false)
  if (!firstLoad && !settled) setSettled(true)
  const loading = !settled && firstLoad

  const items: AttentionItem[] = []
  if (loading) return { items, loading, refetch }

  const classIdByName = new Map(classes.map(c => [c.name, c.id]))

  // ── Camp day: campers unaccounted for right now ──────────────────────────
  if (todaySession) {
    const missing = boardSections.flatMap(s => s.unaccounted.map(st => ({ st, s })))
    const untaken = boardSections.filter(s => s.latest === null)
    if (missing.length > 0) {
      const first = missing[0]
      items.push({
        key: 'unaccounted',
        icon: TriangleAlert,
        tone: 'danger',
        title: `${missing.length} ${plural(missing.length, 'camper is', 'campers are')} unaccounted for`,
        detail: `${first.st.full_name} · ${first.s.className} ${first.s.label} · missed ${rollCallLabel(first.s.latest!)}${missing.length > 1 ? ` · ${missing.length - 1} more` : ''}`,
        ctaLabel: 'Open attendance',
        to: '/admin/attendance',
      })
    } else if (untaken.length > 0) {
      items.push({
        key: 'no-roll-call',
        icon: ClipboardList,
        tone: 'attention',
        title: `${untaken.length} ${plural(untaken.length, 'section has', 'sections have')} no roll call yet today`,
        detail: untaken.map(s => `${s.className} ${s.label}`).slice(0, 3).join(' · '),
        ctaLabel: 'Open attendance',
        to: '/admin/attendance',
      })
    }
  }

  // ── Emails that couldn't be sent (spec 09) ───────────────────────────────
  if (failedEmails > 0) {
    items.push({
      key: 'failed-emails',
      icon: MailWarning,
      tone: 'danger',
      title: `${failedEmails} ${plural(failedEmails, "email couldn't", "emails couldn't")} be sent`,
      detail: 'Families may not know about a confirmation or change. Check the email log.',
      ctaLabel: 'Open email log',
      to: '/admin/updates?tab=emails',
    })
  }

  // ── Sections with no lead in a session that hasn't ended (spec 14) ───────
  const today = localDateISO()
  const liveSessionIds = new Set(sessions.filter(se => se.is_active && se.end_date >= today).map(se => se.id))
  const noLead = classes.flatMap(c => c.sections
    .filter(sec => !sec.cancelled_at && !sec.lead_id
      // A both-weeks section (no session) counts while any session is still to come.
      && (sec.session_id ? liveSessionIds.has(sec.session_id) : liveSessionIds.size > 0))
    .map(sec => ({
      classId: c.id, className: c.name, room: sec.room, taken: sec.registered_count,
      name: `${sec.label}${sec.week ? ` Week ${sec.week}` : ''}`,
    })))
  if (noLead.length > 0) {
    const first = noLead[0]
    items.push({
      key: 'no-lead',
      icon: UserRoundX,
      tone: 'attention',
      title: noLead.length === 1 ? `${first.name} has no lead` : `${noLead.length} sections have no lead`,
      detail: noLead.length === 1
        ? [first.className, first.room, fillError ? null : `${first.taken} ${plural(first.taken, 'camper', 'campers')} so far`].filter(Boolean).join(' · ')
        : noLead.slice(0, 3).map(n => n.name).join(' · ') + (noLead.length > 3 ? ` · ${noLead.length - 3} more` : ''),
      ctaLabel: 'Assign a lead',
      to: classLink(first.classId),
    })
  }

  // ── Crew absences coming up (spec 25) ────────────────────────────────────
  if (absences.length > 0) {
    const first = absences[0]
    const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const when = first.from_date === first.to_date ? day(first.from_date) : `${day(first.from_date)}–${day(first.to_date)}`
    items.push({
      key: 'crew-absence',
      icon: CalendarX,
      tone: 'attention',
      title: absences.length === 1
        ? `${first.volunteer_name} can't make it ${when}`
        : `${absences.length} crew absences coming up`,
      detail: `${first.is_lead ? 'Lead' : 'Crew'} of ${first.class_name} · ${first.section_label}${first.week ? ` (Week ${first.week})` : ''}`
        + (first.suggestions.length > 0 ? ` · could cover: ${first.suggestions.slice(0, 3).join(', ')}` : ' · no free senior that week'),
      ctaLabel: 'Find cover',
      to: classLink(classIdByName.get(first.class_name)),
    })
  }

  // ── Change requests from families (spec 11) and volunteers (spec 25) ─────
  if (openRequests > 0) {
    items.push({
      key: 'change-requests',
      icon: MessageSquareText,
      tone: 'attention',
      title: `${openRequests} open change ${plural(openRequests, 'request', 'requests')}`,
      detail: 'Families past the online deadline or asking for an exception, or volunteers asking to switch sections.',
      ctaLabel: 'Review requests',
      to: '/admin/students#requests',
    })
  }

  // ── Prerequisite at risk (spec 31) ──────────────────────────────────────
  if (atRisk.length > 0) {
    const first = atRisk[0]
    const why = first.reason === 'cancelled'
      ? `their ${first.required_class_name} spot was cancelled`
      : `absent at ${first.missed_arrivals === 1 ? 'the' : `all ${first.missed_arrivals}`} ${first.required_class_name} arrival roll ${plural(first.missed_arrivals, 'call', 'calls')} so far`
    items.push({
      key: 'prereq-at-risk',
      icon: BookAlert,
      tone: 'attention',
      title: atRisk.length === 1
        ? `${first.camper_name} may not be ready for ${first.class_name}`
        : `${atRisk.length} campers may not have the class their next class needs`,
      detail: `${first.camper_name} · ${first.class_name} ${first.section_label}${first.week ? ` (Week ${first.week})` : ''} needs ${first.required_class_name}: ${why}`
        + (atRisk.length > 1 ? ` · ${atRisk.length - 1} more` : ''),
      ctaLabel: 'Review camper',
      to: `/admin/students?q=${encodeURIComponent(first.camper_name)}`,
    })
  }

  // ── Seats: from the same fill counts as the Classes page and Today's seat grid ──
  // Skipped when the counts didn't load, rather than reporting zeros as fact.
  const sectionRows = fillError ? [] : classes.flatMap(c =>
    c.sections.filter(s => !s.cancelled_at).map(s => ({
      classId: c.id, className: c.name, label: s.label, capacity: s.capacity,
      taken: s.registered_count, waitlisted: s.waitlist_count,
    })),
  )

  // Waitlisted campers who could take a free seat now.
  const placeable = sectionRows.filter(s => s.capacity > 0 && s.taken < s.capacity && s.waitlisted > 0)
  if (placeable.length > 0) {
    items.push({
      key: 'waitlist',
      icon: ListChecks,
      tone: 'attention',
      title: 'Waitlist spots opened up',
      detail: `Open seats in ${placeable.length} ${plural(placeable.length, 'section', 'sections')} with campers waiting`,
      ctaLabel: 'Place campers',
      to: '/admin/students',
    })
  }

  // ── Possible duplicate campers (spec 14b) ────────────────────────────────
  if (dupes && dupes.length > 0) {
    const first = dupes[0]
    items.push({
      key: 'duplicates',
      icon: Copy,
      tone: 'attention',
      title: `${dupes.length} possible duplicate ${plural(dupes.length, 'camper', 'campers')}`,
      detail: `${first.a_name} (${first.a_parent ?? 'one account'}) and ${first.b_name} (${first.b_parent ?? 'another account'}): ${first.reason}`,
      ctaLabel: 'Review campers',
      to: `/admin/students?q=${encodeURIComponent(first.a_name)}`,
    })
  }

  // ── Volunteer applications pending review ────────────────────────────────
  const pending = applications.filter(a => a.status === 'pending')
  if (pending.length > 0) {
    const oldest = Math.max(...pending.map(a => daysSince(a.created_at)))
    items.push({
      key: 'volunteers',
      icon: Inbox,
      tone: 'attention',
      title: `${pending.length} volunteer ${plural(pending.length, 'application', 'applications')} pending`,
      detail: `Oldest is ${oldest} ${plural(oldest, 'day', 'days')} old.`,
      ctaLabel: 'Review applications',
      to: '/admin/volunteers?tab=applications',
    })
  }

  // ── Applicants awaiting review who haven't picked an interview time ──────
  // (the interview comes before a decision, so this is about pending applications)
  const bookedAppIds = new Set(slots.filter(s => s.booking).map(s => s.booking!.application_id))
  const unscheduled = applications.filter(a => a.status === 'pending' && !bookedAppIds.has(a.id))
  if (unscheduled.length > 0) {
    items.push({
      key: 'interviews',
      icon: CalendarClock,
      tone: 'attention',
      title: `${unscheduled.length} ${plural(unscheduled.length, 'applicant has', 'applicants have')} no interview yet`,
      detail: "They haven't picked a time. Post more slots or book them in.",
      ctaLabel: 'Book interviews',
      to: '/admin/interviews',
    })
  }

  // ── Onboarding checklist items past due (spec 35) ────────────────────────
  if (lateOnboarding.length > 0) {
    const people = new Set(lateOnboarding.map(o => o.volunteer_id)).size
    const first = lateOnboarding[0]
    items.push({
      key: 'onboarding',
      icon: ClipboardCheck,
      tone: 'attention',
      title: `${lateOnboarding.length} onboarding ${plural(lateOnboarding.length, 'item', 'items')} overdue`,
      detail: `${people} ${plural(people, 'volunteer', 'volunteers')}, starting with ${first.volunteer_name}: ${first.task_label}.`,
      ctaLabel: 'See onboarding',
      to: '/admin/volunteers?tab=onboarding',
    })
  }

  // ── Full and nearly full sections: worth knowing, not a fault ────────────
  const fullSecs = sectionRows.filter(s => s.capacity > 0 && s.taken >= s.capacity)
  const nearSecs = sectionRows.filter(s => s.capacity > 0 && s.taken < s.capacity && s.taken / s.capacity >= 0.9)
  if (fullSecs.length > 0 || nearSecs.length > 0) {
    const anyFull = fullSecs.length > 0
    // The most pressing section: a full one with the longest waitlist, else the fullest.
    const focus = anyFull
      ? [...fullSecs].sort((a, b) => b.waitlisted - a.waitlisted)[0]
      : [...nearSecs].sort((a, b) => b.taken / b.capacity - a.taken / a.capacity)[0]
    const waiting = fullSecs.reduce((n, s) => n + s.waitlisted, 0)
    const nearNote = anyFull && nearSecs.length > 0 ? ` · ${nearSecs.length} nearly full` : ''
    items.push({
      key: 'capacity',
      icon: Armchair,
      tone: 'info',
      title: anyFull
        ? `${fullSecs.length} ${plural(fullSecs.length, 'section', 'sections')} full · ${waiting} waitlisted`
        : `${nearSecs.length} ${plural(nearSecs.length, 'section is', 'sections are')} nearly full`,
      detail: `${focus.className} · ${focus.label} has ${focus.taken} of ${focus.capacity} seats taken${focus.waitlisted > 0 ? `, ${focus.waitlisted} waitlisted` : ''}${nearNote}`,
      ctaLabel: 'See seats',
      to: classLink(focus.classId),
    })
  }

  // Most serious first; the order above breaks ties.
  items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
  return { items, loading, refetch }
}
