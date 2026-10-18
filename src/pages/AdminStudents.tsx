import { useState, useMemo, Fragment } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { Search, Download, HeartPulse, ChevronDown, ArrowLeft, ArrowRight } from 'lucide-react'
import InlineConfirm from '../components/InlineConfirm'
import HistoryStrip from '../components/HistoryStrip'
import AdminChangeRequests from '../components/AdminChangeRequests'
import Button from '../components/Button'
import Segmented from '../components/Segmented'
import RegistrationStatusWord from '../components/RegistrationStatusWord'
import { Input, Select } from '../components/Field'
import { supabase } from '../lib/supabase'
import { healthLines, telHref } from '../lib/campers'
import { toCsv, downloadCsv } from '../lib/csv'
import { useAdminStudents, type AdminStudent, type StudentRegistration } from '../hooks/useAdminStudents'
import { useAdminClasses } from '../hooks/useAdminClasses'
import type { RegistrationStatus } from '../types/database'

// Campers (A-admin §9): change requests first, then search and one status filter over a table of
// every camper (age · grade, parent with a phone link, classes in words with only the exceptions
// marked, health wrapped in red and never cut short). A row opens in place: facts and health on the
// left, each registration with a Status and a Move select on the right, history underneath.

// The row a draft or confirm was made against. If the registration has changed since (the
// database withdrew it after another save, a revert, a refresh), the draft no longer applies.
interface Base { baseStatus: RegistrationStatus; baseSection: string }

type RegAction =
  | ({ kind: 'status'; regId: string; status: RegistrationStatus } & Base)
  | ({ kind: 'move'; regId: string; sectionId: string } & Base)
  | null

interface SectionOption {
  id: string
  label: string
  class_name: string
  week: 1 | 2 | null
  age_min: number
  age_max: number
  capacity: number
  registered_count: number   // confirmed + pending
}

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  confirmed: 'Confirmed', offered: 'Offered', waitlisted: 'Waitlisted', cancelled: 'Cancelled', pending: 'Pending',
}

// An open waitlist offer holds its seat too (spec 10).
const holdsSeat = (st: RegistrationStatus) => st === 'confirmed' || st === 'pending' || st === 'offered'

// "PY-B is full (12/12): …" — null when the section has room. Unknown counts are said plainly.
function overfillNote(sec: SectionOption | undefined, fillKnown: boolean, verb: string): string | null {
  if (!sec) return null
  if (!fillKnown) return `Seat counts couldn't be loaded, so ${sec.label} may already be full.`
  if (sec.registered_count < sec.capacity) return null
  return `${sec.label} is full (${sec.registered_count}/${sec.capacity}): ${verb} will over-fill it to ${sec.registered_count + 1}/${sec.capacity}.`
}

// "13 · entering 8th": grades are always the grade the camper enters in the fall.
const ageGrade = (s: AdminStudent) => `${s.age}${s.grade ? ` · entering ${s.grade}` : ''}`
const weekWord = (w: 1 | 2 | null) => (w ? `Week ${w}` : 'both weeks')
const byWeek = (a: StudentRegistration, b: StudentRegistration) =>
  (a.section_week ?? 3) - (b.section_week ?? 3) || a.class_name.localeCompare(b.class_name)

function HealthText({ s }: { s: AdminStudent }) {
  const lines = healthLines(s)
  if (lines.length === 0) return null
  return (
    <span className="grid gap-1">
      {lines.map(h => (
        <span key={h.label} className="flex items-start gap-1.5 font-bold text-danger text-pretty break-words">
          <HeartPulse size={16} strokeWidth={2.5} aria-hidden="true" className="mt-1 shrink-0" />
          <span><span className="font-extrabold">{h.label}:</span> {h.text}</span>
        </span>
      ))}
    </span>
  )
}

// Inline detail under an expanded camper row.
function CamperDetail({
  student,
  allSections,
  fillKnown,
  onStatusChange,
  onMoveSection,
  sectionName,
  onReverted,
}: {
  student: AdminStudent
  allSections: SectionOption[]
  fillKnown: boolean
  sectionName: (id: string) => string
  onReverted: () => Promise<void>
  onStatusChange: (regId: string, status: RegistrationStatus) => Promise<void>
  onMoveSection: (regId: string, sectionId: string, status: RegistrationStatus) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<{ regId: string; text: string } | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, setPending] = useState<RegAction>(null)
  // Choosing in a select only drafts the change (an arrow key or a typed letter fires change on
  // Windows and Linux); the button next to it saves, because every save emails the family.
  const [drafts, setDrafts] = useState<Record<string, { status?: RegistrationStatus; sectionId?: string } & Base>>({})
  const [showHistory, setShowHistory] = useState(false)

  const base = (reg: StudentRegistration): Base => ({ baseStatus: reg.status, baseSection: reg.section_id })
  const fresh = (reg: StudentRegistration, b: Base | null | undefined) =>
    !!b && b.baseStatus === reg.status && b.baseSection === reg.section_id
  const draft = (reg: StudentRegistration): { status?: RegistrationStatus; sectionId?: string } => {
    const d = drafts[reg.id]
    return fresh(reg, d) ? d : {}
  }
  const setDraft = (reg: StudentRegistration, patch: { status?: RegistrationStatus; sectionId?: string }) =>
    setDrafts(d => ({ ...d, [reg.id]: { ...(fresh(reg, d[reg.id]) ? d[reg.id] : {}), ...patch, ...base(reg) } }))
  const clearDraft = (regId: string) => setDrafts(d => { const n = { ...d }; delete n[regId]; return n })
  // Focus goes back to the select that started it once the change is saved or dropped.
  const refocus = (id: string) => document.getElementById(id)?.focus()

  async function run(reg: StudentRegistration, back: string, fn: () => Promise<void>) {
    if (busy) return
    setBusy(reg.id)
    setErr(null)
    setSaved(null)
    try {
      await fn()
      setPending(null)
      clearDraft(reg.id)
      setSaved(reg.id)
      refocus(back)
    }
    catch (e) { setErr({ regId: reg.id, text: e instanceof Error ? e.message : 'Something went wrong' }) }
    finally { setBusy(null) }
  }

  const sectionById = (id: string) => allSections.find(sec => sec.id === id)

  // Every cancel asks first (Cancelled is how a camper is removed: the registration is kept as
  // cancelled, the database stamps it "Removed by an admin", and a freed seat is offered to the
  // next family), so does giving a seat up (it emails two families), and so does giving a seat in
  // a full section. Anything else saves at once.
  function requestStatus(reg: StudentRegistration, st: RegistrationStatus) {
    if (st === reg.status) { clearDraft(reg.id); return }
    const takesSeat = holdsSeat(st) && !holdsSeat(reg.status)
    const givesSeat = holdsSeat(reg.status) && !holdsSeat(st)
    if (st === 'cancelled' || givesSeat || (takesSeat && overfillNote(sectionById(reg.section_id), fillKnown, ''))) {
      setErr(null)
      setSaved(null)
      setPending({ kind: 'status', regId: reg.id, status: st, ...base(reg) })
    } else {
      setPending(null)
      void run(reg, `status-${reg.id}`, () => onStatusChange(reg.id, st))
    }
  }

  // A move keeps a confirmed/pending seat as it is; a waitlisted or cancelled registration
  // becomes pending in the new section (it takes a seat there).
  const moveStatus = (reg: StudentRegistration): RegistrationStatus => holdsSeat(reg.status) ? reg.status : 'pending'

  function confirmProps(reg: StudentRegistration, action: NonNullable<RegAction>) {
    const where = `${reg.class_name} · ${reg.section_label}`
    if (action.kind === 'status') {
      const over = holdsSeat(action.status) && !holdsSeat(reg.status)
        ? overfillNote(sectionById(reg.section_id), fillKnown, `making ${student.full_name} ${action.status}`)
        : null
      if (over) {
        return { message: over, confirmLabel: `Set ${action.status} anyway`, cancelLabel: `Keep ${reg.status}`, tone: 'danger' as const }
      }
      if (action.status === 'cancelled') {
        const kept = 'The registration stays on file as cancelled, attendance already taken stays on file, and the family gets an email.'
        if (reg.status === 'waitlisted') {
          return { message: `Take ${student.full_name} off the waitlist for ${where}? ${kept}`, confirmLabel: 'Take off waitlist', cancelLabel: 'Keep on waitlist', tone: 'danger' as const }
        }
        const seat = reg.status === 'offered' ? 'offered seat' : reg.status === 'pending' ? 'seat' : 'confirmed seat'
        return {
          message: `Cancel ${student.full_name}'s ${seat} in ${where}? The seat is offered to the next family on the waitlist. ${kept}`,
          confirmLabel: 'Cancel seat',
          cancelLabel: 'Keep seat',
          tone: 'danger' as const,
        }
      }
      if (action.status === 'waitlisted' && holdsSeat(reg.status)) {
        return {
          message: `Put ${student.full_name} on the waitlist for ${where}? Their seat is offered to the next family on the waitlist, and both families get an email.`,
          confirmLabel: 'Put on waitlist',
          cancelLabel: 'Keep seat',
          tone: 'danger' as const,
        }
      }
      return { message: `Set ${student.full_name} to ${action.status} in ${where}?`, confirmLabel: 'Set status', tone: 'neutral' as const }
    }
    const target = sectionById(action.sectionId)
    const targetName = target ? `${target.class_name} · ${target.label}` : 'that section'
    const newStatus = moveStatus(reg)
    const over = overfillNote(target, fillKnown, 'the move')
    const notes = [
      over ?? (target ? `${target.label} has ${target.registered_count}/${target.capacity} seats filled.` : null),
      newStatus === reg.status ? `Status stays ${reg.status}.` : `They become pending (now ${reg.status}).`,
      target && (student.age < target.age_min || student.age > target.age_max)
        ? `${target.label} is for ages ${target.age_min}–${target.age_max}; ${student.full_name} is ${student.age}.`
        : null,
      target?.week && student.registrations.some(r => r.id !== reg.id && r.section_week === target.week && holdsSeat(r.status))
        ? `They already have another Week ${target.week} class.`
        : null,
    ].filter(Boolean)
    return {
      message: `Move ${student.full_name} from ${where} to ${targetName}? ${notes.join(' ')}`,
      confirmLabel: over && fillKnown ? 'Move and over-fill' : 'Move',
      cancelLabel: 'Keep',
      tone: over ? 'danger' as const : 'neutral' as const,
    }
  }

  function confirmAction(reg: StudentRegistration, action: NonNullable<RegAction>) {
    if (action.kind === 'status') return run(reg, `status-${reg.id}`, () => onStatusChange(reg.id, action.status))
    return run(reg, `move-${reg.id}`, () => onMoveSection(reg.id, action.sectionId, moveStatus(reg)))
  }

  // Move targets by week, each saying its seats and ages so the choice needs no lookup.
  const moveGroups = (reg: StudentRegistration) => {
    const others = allSections.filter(sec => sec.id !== reg.section_id)
    return ([1, 2, null] as const)
      .map(w => ({ w, list: others.filter(sec => sec.week === w) }))
      .filter(g => g.list.length > 0)
  }
  const optionText = (sec: SectionOption) => {
    const seats = fillKnown
      ? `${sec.registered_count}/${sec.capacity}${sec.registered_count >= sec.capacity ? ' full' : ''}`
      : `${sec.capacity} seats`
    const fits = student.age >= sec.age_min && student.age <= sec.age_max
    return `${sec.label} · ${sec.class_name} · ${seats} · ages ${sec.age_min}–${sec.age_max}${fits ? '' : ` (${student.full_name.split(' ')[0]} is ${student.age})`}`
  }

  const health = healthLines(student)
  const ec = student.emergency_contact_name || student.emergency_contact_phone
  const label = 'block font-bold'
  const tel = (n: string) => <a href={telHref(n)} className="font-bold underline underline-offset-[3px] inline-flex items-center min-h-11">{n}</a>

  return (
    <div className="grid gap-x-8 gap-y-6 min-[1100px]:grid-cols-[5fr_7fr]">
      <div className="min-w-0">
        <h3 className="text-lg font-bold leading-[1.3]">Details</h3>
        {health.length > 0 && <p className="mt-2"><HealthText s={student} /></p>}
        <dl className="mt-3 grid grid-cols-1 min-[480px]:grid-cols-[minmax(120px,max-content)_1fr] gap-x-4 gap-y-1 min-[480px]:gap-y-2 items-baseline">
          <dt className="text-sm font-bold text-ink-muted">Age</dt>
          <dd className="mb-2 min-[480px]:mb-0">{student.age}{student.grade ? ` · entering ${student.grade} grade` : ''}</dd>
          {student.school_name && <>
            <dt className="text-sm font-bold text-ink-muted">School</dt>
            <dd className="mb-2 min-[480px]:mb-0 break-words">{student.school_name}</dd>
          </>}
          {student.registration_year && <>
            <dt className="text-sm font-bold text-ink-muted">Registered for</dt>
            <dd className="mb-2 min-[480px]:mb-0">{student.registration_year}</dd>
          </>}
          <dt className="text-sm font-bold text-ink-muted">Parent</dt>
          <dd className="mb-2 min-[480px]:mb-0 break-words">
            {student.parent_name}{student.parent_phone && <> · {tel(student.parent_phone)}</>}
          </dd>
          <dt className="text-sm font-bold text-ink-muted">Emergency contact</dt>
          <dd className="mb-2 min-[480px]:mb-0 break-words">
            {ec ? <>
              {student.emergency_contact_name ?? 'No name given'}
              {student.emergency_contact_relation && `, ${student.emergency_contact_relation.toLowerCase()}`}
              {student.emergency_contact_phone && <> · {tel(student.emergency_contact_phone)}</>}
            </> : <span className="text-ink-muted">None given</span>}
          </dd>
        </dl>
      </div>

      <div className="min-w-0">
        <h3 className="text-lg font-bold leading-[1.3]">Registrations</h3>
        {student.registrations.length === 0 ? (
          <p className="mt-2 text-ink-muted">Not registered for any class.</p>
        ) : (
          <ul className="mt-2">
            {[...student.registrations].sort(byWeek).map((reg, i) => {
              const d = draft(reg)
              const confirming = pending?.regId === reg.id && fresh(reg, pending) ? pending : null
              const statusValue = confirming?.kind === 'status' ? confirming.status : d.status ?? reg.status
              const moveValue = confirming?.kind === 'move' ? confirming.sectionId : d.sectionId ?? ''
              const groups = moveGroups(reg)
              const here = busy === reg.id
              return (
                <li key={reg.id} aria-busy={here} className={`py-4 ${i > 0 ? 'border-t border-border' : 'pt-1'}`}>
                  <p className="text-lg font-bold leading-[1.3]">
                    {reg.class_name} · {reg.section_label} · {weekWord(reg.section_week)}
                  </p>
                  <div className="mt-3 grid gap-x-4 gap-y-3 min-[1280px]:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor={`status-${reg.id}`} className={label}>Status</label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <Select id={`status-${reg.id}`} className="flex-[1_1_10rem] w-auto min-w-0" value={statusValue}
                          onChange={e => { setSaved(null); setPending(null); setDraft(reg, { status: e.target.value as RegistrationStatus }) }}>
                          {(['confirmed', 'offered', 'waitlisted', 'cancelled', ...(reg.status === 'pending' ? ['pending' as const] : [])] as RegistrationStatus[])
                            .map(st => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
                        </Select>
                        {d.status && d.status !== reg.status && !confirming && (
                          <Button variant="ink" aria-disabled={here || undefined} onClick={() => requestStatus(reg, d.status!)}>
                            {here ? 'Saving…' : 'Set status'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label htmlFor={`move-${reg.id}`} className={label}>Move to</label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <Select id={`move-${reg.id}`} className="flex-[1_1_12rem] w-auto min-w-0" aria-describedby={`reg-hint-${reg.id}`}
                          value={moveValue} disabled={groups.length === 0}
                          onChange={e => { setSaved(null); setPending(null); setDraft(reg, { sectionId: e.target.value || undefined }) }}>
                          <option value="">Keep in {reg.section_label}{reg.section_week ? ` · Week ${reg.section_week}` : ''}</option>
                          {groups.map(g => (
                            <optgroup key={String(g.w)} label={g.w ? `Week ${g.w}` : 'Both weeks'}>
                              {g.list.map(sec => <option key={sec.id} value={sec.id}>{optionText(sec)}</option>)}
                            </optgroup>
                          ))}
                        </Select>
                        {d.sectionId && !confirming && (
                          <Button variant="ink" aria-disabled={here || undefined}
                            onClick={() => { if (!busy) { setErr(null); setPending({ kind: 'move', regId: reg.id, sectionId: d.sectionId!, ...base(reg) }) } }}>
                            Move
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <p id={`reg-hint-${reg.id}`} className="mt-1.5 text-sm text-ink-muted text-pretty">
                    Nothing changes until you press the button. Moves and cancellations ask first; every change emails the family.
                  </p>
                  <div aria-live="polite" className="text-sm font-bold">
                    {here && <p className="mt-2">Saving…</p>}
                    {saved === reg.id && !here && <p className="mt-2">Saved. The family gets an email.</p>}
                  </div>
                  {err?.regId === reg.id && (
                    <p role="alert" className="mt-2 font-bold text-danger text-pretty">Couldn't save that change: {err.text}</p>
                  )}
                  {confirming && (
                    <div className="mt-3">
                      <InlineConfirm
                        {...confirmProps(reg, confirming)}
                        busy={here}
                        onConfirm={() => void confirmAction(reg, confirming)}
                        // Keep means keep: the draft goes, and focus goes back to the select that asked.
                        onCancel={() => {
                          refocus(`${confirming.kind === 'status' ? 'status' : 'move'}-${reg.id}`)
                          setPending(null)
                          clearDraft(reg.id)
                        }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Spec 15: who changed this camper or their registrations, with Revert. */}
        <div className="mt-2 pt-2 border-t border-border">
          <button type="button" onClick={() => setShowHistory(v => !v)} aria-expanded={showHistory}
            className="ui-btn ui-btn--text">
            {showHistory ? 'Hide history' : 'Show history'}
          </button>
          {showHistory && (
            <div className="mt-2">
              <HistoryStrip
                heading={false}
                load={() => supabase.rpc('admin_camper_history', { p_student_id: student.id })}
                sectionName={sectionName}
                onReverted={onReverted}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function exportCamperCSV(students: AdminStudent[]) {
  // Allergies is its own required field; medical conditions replaced the older medical_info.
  const headers = ['Student Name', 'Age', 'Allergies', 'Medical Conditions', 'Parent Name', 'Class', 'Section', 'Week', 'Status']
  const rows: (string | number)[][] = []

  for (const s of students) {
    const health = [s.allergies ?? '', s.medical_conditions || s.medical_info || '']
    if (s.registrations.length === 0) {
      rows.push([s.full_name, s.age, ...health, s.parent_name, '', '', '', 'unregistered'])
    } else {
      for (const r of s.registrations) {
        rows.push([
          s.full_name,
          s.age,
          ...health,
          s.parent_name,
          r.class_name,
          r.section_label,
          r.section_week ?? '',
          r.status,
        ])
      }
    }
  }

  downloadCsv(`campers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows))
}

// Confirmed is here too because Export CSV exports what the filter shows.
type StatusFilter = 'all' | 'confirmed' | 'waitlisted' | 'offered' | 'cancelled' | 'unregistered'
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'offered', label: 'Offered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'unregistered', label: 'Not registered' },
]
const PAGE = 50

export default function AdminStudents() {
  const { students, loading, error, updateRegistrationStatus, moveStudentToSection, refetch: refetchStudents } = useAdminStudents()
  const { classes, fillError, refetch: refetchClasses } = useAdminClasses()

  // ?q= comes from the top-bar search; re-applied on every navigation (keyed on the location
  // key, not the query), so picking the same camper again after editing the box still works.
  const [params] = useSearchParams()
  const location = useLocation()
  const urlQuery = params.get('q') ?? ''
  const [applied, setApplied] = useState({ key: location.key, q: urlQuery })
  const [search, setSearch] = useState(urlQuery)
  if (location.key !== applied.key) {
    setApplied({ key: location.key, q: urlQuery })
    if (urlQuery || applied.q) setSearch(urlQuery)
  }
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  // 50 rows a page (spec 18); a new search or filter starts again at the first page.
  const filterKey = `${search}|${statusFilter}`
  const [pageState, setPageState] = useState({ key: filterKey, n: 0 })
  const page = pageState.key === filterKey ? pageState.n : 0
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Every section (cancelled ones too) by id, for the History strip's "Moved: A → B" lines.
  const sectionName = useMemo(() => {
    const byId = new Map(classes.flatMap(c => c.sections.map(s => [s.id, `${c.name} · ${s.label}${s.week ? ` (Week ${s.week})` : ''}`] as const)))
    return (id: string) => byId.get(id) ?? 'a removed section'
  }, [classes])

  const allSections = useMemo<SectionOption[]>(() =>
    // Cancelled sections take no one, so they're never a move target.
    classes.flatMap(c => c.sections.filter(s => !s.cancelled_at).map(s => ({
      id: s.id,
      label: s.label,
      class_name: c.name,
      week: s.week,
      age_min: s.age_min,
      age_max: s.age_max,
      capacity: s.capacity,
      registered_count: s.registered_count,
    }))).sort((a, b) => a.label.localeCompare(b.label)),
    [classes]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter(s => {
      const matchesSearch = !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'unregistered' && s.registrations.length === 0) ||
        s.registrations.some(r => r.status === statusFilter)

      // The open camper stays while it's open, even when a save takes it out of the filter.
      return (matchesSearch && matchesStatus) || s.id === expandedId
    })
  }, [students, search, statusFilter, expandedId])

  // Counts campers (each once per status they have), matching what the filter lists.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length, unregistered: 0 }
    for (const s of students) {
      if (s.registrations.length === 0) counts.unregistered++
      for (const st of new Set(s.registrations.map(r => r.status))) {
        counts[st] = (counts[st] ?? 0) + 1
      }
    }
    return counts
  }, [students])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const shownPage = Math.min(page, pages - 1)
  const rows = filtered.slice(shownPage * PAGE, shownPage * PAGE + PAGE)
  const goTo = (n: number) => {
    setPageState({ key: filterKey, n })
    document.getElementById('all-campers')?.scrollIntoView()
  }

  const th = 'sticky top-[104px] lg:top-14 z-10 bg-bg p-3 text-left align-bottom text-sm font-bold text-ink-muted border-b border-ink'
  const td = 'p-3 align-top max-md:block max-md:p-0 max-md:py-0.5 max-md:border-0'

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mb-8">
        <div className="flex-[1_1_260px] min-w-0">
          <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">Campers</h1>
          {!loading && !error && (
            <p className="mt-2 text-ink-muted">{students.length} {students.length === 1 ? 'camper' : 'campers'}</p>
          )}
        </div>
        <Button onClick={() => exportCamperCSV(filtered)} disabled={loading || filtered.length === 0}>
          <Download size={18} strokeWidth={2.25} aria-hidden="true" /> Export CSV
        </Button>
      </div>

      <AdminChangeRequests onResolved={() => { void refetchStudents() }} />

      <section aria-labelledby="all-campers" className="scroll-mt-32 lg:scroll-mt-20">
        <h2 id="all-campers" className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] scroll-mt-32 lg:scroll-mt-20">All campers</h2>
        <div className="mt-3 mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="relative flex-[1_1_240px] min-w-0 max-w-[420px]">
            <label htmlFor="camper-q" className="sr-only">Search campers or parents</label>
            <Search size={20} strokeWidth={2.25} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <Input id="camper-q" type="search" placeholder="Search campers or parents" value={search}
              onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Segmented label="Show" options={FILTERS.map(f => ({
            value: f.value, label: f.label, count: statusCounts[f.value] ?? 0,
          }))} value={statusFilter} onChange={setStatusFilter} />
        </div>

        {error ? (
          <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 border-y-2 border-ink">
            <p title={error} className="flex-[1_1_16rem] font-bold text-danger text-pretty">Couldn't load the campers. Check your connection, then try again.</p>
            <Button onClick={() => { void refetchStudents() }}>Try again</Button>
          </div>
        ) : loading ? (
          <div role="status" className="border-y-2 border-ink">
            <span className="sr-only">Loading campers</span>
            {[1, 2, 3, 4, 5].map(i => <div key={i} aria-hidden="true" className="h-14 my-2 rounded bg-surface-sunken animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-4 border-y-2 border-ink text-ink-muted text-pretty">
            {search.trim() ? `No campers or parents match “${search.trim()}”.` : 'No campers here.'}
            {statusFilter !== 'all' && ' Try All.'}
          </p>
        ) : (
          <>
            <div className="border-y-2 border-ink">
              <table className="w-full table-fixed border-collapse max-md:block">
                <caption className="sr-only">
                  Campers {shownPage * PAGE + 1} to {shownPage * PAGE + rows.length} of {filtered.length}. Select a name to open the camper.
                </caption>
                <colgroup>
                  <col className="w-[26%]" /><col className="w-[22%]" /><col className="w-[25%]" /><col />
                </colgroup>
                <thead className="max-md:sr-only">
                  <tr>
                    <th scope="col" className={th}>Camper</th>
                    <th scope="col" className={th}>Parent</th>
                    <th scope="col" className={th}>Classes</th>
                    <th scope="col" className={th}>Health</th>
                  </tr>
                </thead>
                <tbody className="max-md:block">
                  {rows.map((s, i) => {
                    const open = expandedId === s.id
                    const regs = [...s.registrations].sort(byWeek)
                    // Hairlines between rows; an open camper's line turns ink above its detail.
                    const line = i === 0 ? '' : `border-t ${open ? 'border-ink' : 'border-border'}`
                    return (
                      <Fragment key={s.id}>
                        <tr className={`max-md:flex max-md:flex-col max-md:py-3 ${i > 0 ? 'max-md:border-t max-md:border-border' : ''}`}>
                          <td className={`${td} ${line}`}>
                            <button type="button" onClick={() => setExpandedId(open ? null : s.id)}
                              aria-expanded={open} aria-controls={`camper-${s.id}`}
                              className="inline-flex items-center gap-1.5 min-h-11 text-left font-bold text-lg md:text-base leading-[1.3] hover:underline underline-offset-[3px]">
                              {s.full_name}
                              <ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                            </button>
                            <span className="block max-md:inline max-md:ml-2 text-sm text-ink-muted">{ageGrade(s)}</span>
                          </td>
                          <td className={`${td} ${line} max-md:order-2 max-md:text-ink-muted`}>
                            <span className="break-words">{s.parent_name}</span>
                            {s.parent_phone && (
                              <a href={telHref(s.parent_phone)} aria-label={`Call ${s.parent_name}, ${s.parent_phone}`}
                                className="flex max-md:inline-flex max-md:ml-2 items-center w-fit min-h-11 text-sm text-ink-muted underline underline-offset-[3px] hover:text-ink">
                                {s.parent_phone}
                              </a>
                            )}
                          </td>
                          <td className={`${td} ${line} max-md:order-1`}>
                            {regs.length === 0
                              ? <span className="text-sm font-bold text-ink-muted">Not registered</span>
                              : regs.map(r => (
                                <span key={r.id} className="block">
                                  {r.class_name}, {weekWord(r.section_week)}{r.status !== 'confirmed' && <> <RegistrationStatusWord status={r.status} /></>}
                                </span>
                              ))}
                          </td>
                          <td className={`${td} ${line} max-md:order-3`}>
                            {healthLines(s).length > 0 ? <HealthText s={s} /> : <span className="sr-only">No health notes</span>}
                          </td>
                        </tr>
                        {open && (
                          <tr id={`camper-${s.id}`} className="max-md:block">
                            <td colSpan={4} className="bg-surface border-b-2 border-ink px-4 pt-4 pb-5 max-md:block max-md:-mx-4 max-md:px-4">
                              <CamperDetail
                                student={s}
                                allSections={allSections}
                                fillKnown={!fillError}
                                // Seat counts drive the over-fill warnings, so refresh them after each change.
                                onStatusChange={async (id, status) => { await updateRegistrationStatus(id, status); void refetchClasses() }}
                                onMoveSection={async (regId, sectionId, status) => { await moveStudentToSection(regId, sectionId, status); void refetchClasses() }}
                                sectionName={sectionName}
                                onReverted={async () => { await refetchStudents(); void refetchClasses() }}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted tabular-nums">
                {filtered.length > PAGE
                  ? `${shownPage * PAGE + 1}–${shownPage * PAGE + rows.length} of ${filtered.length}`
                  : `${filtered.length} ${filtered.length === 1 ? 'camper' : 'campers'}`}
              </p>
              {pages > 1 && (
                <div className="flex flex-wrap gap-2">
                  {shownPage > 0 && (
                    <Button onClick={() => goTo(shownPage - 1)}>
                      <ArrowLeft size={18} strokeWidth={2.25} aria-hidden="true" /> Previous {PAGE}<span className="sr-only"> campers</span>
                    </Button>
                  )}
                  {shownPage < pages - 1 && (
                    <Button onClick={() => goTo(shownPage + 1)}>
                      Next {Math.min(PAGE, filtered.length - (shownPage + 1) * PAGE)}<span className="sr-only"> campers</span> <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
