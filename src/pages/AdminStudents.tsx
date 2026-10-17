import { useState, useMemo } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { Search, Download, AlertCircle, UserCheck, ChevronDown } from 'lucide-react'
import InlineConfirm from '../components/InlineConfirm'
import HistoryStrip from '../components/HistoryStrip'
import AdminChangeRequests from '../components/AdminChangeRequests'
import { supabase } from '../lib/supabase'
import { realNote } from '../lib/campers'
import { toCsv, downloadCsv } from '../lib/csv'
import { useAdminStudents, type AdminStudent, type StudentRegistration } from '../hooks/useAdminStudents'
import { useAdminClasses } from '../hooks/useAdminClasses'
import type { RegistrationStatus } from '../types/database'

const STATUS_BADGE: Record<RegistrationStatus, string> = {
  confirmed:  'bg-success-soft text-success',
  pending:    'bg-warning-soft text-warning',
  waitlisted: 'bg-info-soft text-info',
  cancelled:  'bg-danger-soft text-danger',
}

type RegAction =
  | { kind: 'remove'; regId: string }
  | { kind: 'status'; regId: string; status: RegistrationStatus }
  | { kind: 'move'; regId: string; sectionId: string }
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

const holdsSeat = (st: RegistrationStatus) => st === 'confirmed' || st === 'pending'

// "PY-B is full (12/12): …" — null when the section has room. Unknown counts are said plainly.
function overfillNote(sec: SectionOption | undefined, fillKnown: boolean, verb: string): string | null {
  if (!sec) return null
  if (!fillKnown) return `Seat counts couldn't be loaded, so ${sec.label} may already be full.`
  if (sec.registered_count < sec.capacity) return null
  return `${sec.label} is full (${sec.registered_count}/${sec.capacity}): ${verb} will over-fill it to ${sec.registered_count + 1}/${sec.capacity}.`
}

// Inline detail panel shown under an expanded student row.
function StudentDetail({
  student,
  allSections,
  fillKnown,
  onStatusChange,
  onMoveSection,
  onRemoveReg,
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
  onRemoveReg: (regId: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState<RegAction>(null)
  const [showHistory, setShowHistory] = useState(false)

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setErr(null)
    try { await fn(); setPending(null) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(null) }
  }

  const sectionById = (id: string) => allSections.find(sec => sec.id === id)

  // Routine status changes apply at once; cancelling a confirmed seat, or giving a seat in a
  // full section, asks first.
  function requestStatus(reg: StudentRegistration, st: RegistrationStatus) {
    const cancelsSeat = reg.status === 'confirmed' && st === 'cancelled'
    const takesSeat = holdsSeat(st) && !holdsSeat(reg.status)
    if (cancelsSeat || (takesSeat && overfillNote(sectionById(reg.section_id), fillKnown, ''))) {
      setErr(null)
      setPending({ kind: 'status', regId: reg.id, status: st })
    } else {
      void run(`status-${reg.id}-${st}`, () => onStatusChange(reg.id, st))
    }
  }

  // A move keeps a confirmed/pending seat as it is; a waitlisted or cancelled registration
  // becomes pending in the new section (it takes a seat there).
  const moveStatus = (reg: StudentRegistration): RegistrationStatus => holdsSeat(reg.status) ? reg.status : 'pending'

  function confirmProps(reg: StudentRegistration, action: NonNullable<RegAction>) {
    const where = `${reg.class_name} · ${reg.section_label}`
    if (action.kind === 'remove') {
      // attendance_logs / roll_call_marks reference the student and section, not the registration.
      return {
        message: `Remove ${student.full_name} from ${where}? The registration is kept as cancelled (with who and when) and its seat is freed. Attendance already taken stays on file.`,
        confirmLabel: 'Remove',
        cancelLabel: 'Keep',
        tone: 'danger' as const,
      }
    }
    if (action.kind === 'status') {
      const over = holdsSeat(action.status) && !holdsSeat(reg.status)
        ? overfillNote(sectionById(reg.section_id), fillKnown, `making ${student.full_name} ${action.status}`)
        : null
      if (over) {
        return { message: over, confirmLabel: `Set ${action.status} anyway`, tone: 'danger' as const }
      }
      if (reg.status === 'confirmed' && action.status === 'cancelled') {
        return {
          message: `Cancel ${student.full_name}'s confirmed seat in ${where}? The seat is freed for someone else; the registration stays on file as cancelled.`,
          confirmLabel: 'Cancel seat',
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
      tone: over ? 'danger' as const : 'neutral' as const,
    }
  }

  function confirmAction(reg: StudentRegistration, action: NonNullable<RegAction>) {
    if (action.kind === 'remove') return run(`remove-${reg.id}`, () => onRemoveReg(reg.id))
    if (action.kind === 'status') return run(`status-${reg.id}-${action.status}`, () => onStatusChange(reg.id, action.status))
    return run(`move-${reg.id}`, () => onMoveSection(reg.id, action.sectionId, moveStatus(reg)))
  }

  const allergies = realNote(student.allergies)
  const medical = realNote(student.medical_conditions) ?? realNote(student.medical_info)
  const facts: [string, string | null][] = [
    ['Grade', student.grade],
    ['School', student.school_name],
    ['Registered for', student.registration_year ? String(student.registration_year) : null],
    ['Parent', student.parent_name],
    ['Parent phone', student.parent_phone],
    ['Emergency contact', student.emergency_contact_name
      ? `${student.emergency_contact_name}${student.emergency_contact_relation ? ` (${student.emergency_contact_relation})` : ''}${student.emergency_contact_phone ? ` · ${student.emergency_contact_phone}` : ''}`
      : null],
  ]

  return (
    <div className="px-4 sm:px-5 py-4 bg-surface-sunken border-t border-border space-y-4 font-sans text-sm">
      {(allergies || medical) && (
        <div className="flex items-start gap-2 rounded-[10px] border border-danger/30 bg-danger-soft px-3 py-2.5 text-danger">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            {allergies && <p><span className="font-semibold">Allergies:</span> {allergies}</p>}
            {medical && <p><span className="font-semibold">Medical:</span> {medical}</p>}
          </div>
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1.5">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="text-ink min-w-0 break-words">{v || '—'}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Registrations</p>
        {student.registrations.length === 0 ? (
          <p className="text-ink-muted text-sm">Not registered for any section.</p>
        ) : (
          student.registrations.map(reg => (
            <div key={reg.id} className="bg-surface border border-border rounded-[10px] overflow-hidden">
              <div className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{reg.class_name}</p>
                    <p className="text-xs text-ink-muted">{reg.section_label}{reg.section_week ? ` · Week ${reg.section_week}` : ''}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[reg.status]}`}>
                    {reg.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-muted">Set status:</span>
                  {(['confirmed', 'pending', 'waitlisted', 'cancelled'] as RegistrationStatus[])
                    .filter(st => st !== reg.status)
                    .map(st => (
                      <button
                        key={st}
                        onClick={() => requestStatus(reg, st)}
                        disabled={!!busy}
                        className="h-8 px-3 rounded-full text-xs font-semibold border transition capitalize bg-surface border-border-strong text-ink hover:bg-surface-sunken disabled:opacity-40"
                      >
                        {busy === `status-${reg.id}-${st}`
                          ? <span className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin inline-block" />
                          : st}
                      </button>
                    ))}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor={`move-${reg.id}`} className="text-xs text-ink-muted shrink-0">Move to section:</label>
                  <select
                    id={`move-${reg.id}`}
                    className="flex-1 h-9 px-2 rounded-[8px] bg-surface border border-border-strong text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    value=""
                    disabled={!!busy}
                    onChange={e => {
                      const target = e.target.value
                      if (target) { setErr(null); setPending({ kind: 'move', regId: reg.id, sectionId: target }) }
                    }}
                  >
                    <option value="">Choose a section…</option>
                    {allSections
                      .filter(sec => sec.id !== reg.section_id)
                      .map(sec => (
                        <option key={sec.id} value={sec.id}>
                          {sec.class_name} — {sec.label}{sec.week ? ` (Week ${sec.week})` : ''}
                        </option>
                      ))}
                  </select>
                  {reg.status !== 'cancelled' && (
                    <button
                      onClick={() => setPending({ kind: 'remove', regId: reg.id })}
                      disabled={!!busy}
                      className="h-9 px-3 rounded-[8px] text-xs font-semibold border transition bg-surface text-danger border-danger/40 hover:bg-danger-soft disabled:opacity-40"
                    >
                      Remove registration
                    </button>
                  )}
                </div>
              </div>
              {pending?.regId === reg.id && (
                <InlineConfirm
                  {...confirmProps(reg, pending)}
                  busy={!!busy}
                  onConfirm={() => void confirmAction(reg, pending)}
                  onCancel={() => setPending(null)}
                />
              )}
            </div>
          ))
        )}
      </div>

      {err && (
        <div role="alert" className="flex items-center gap-2 px-3 py-2 bg-danger-soft text-danger rounded-[8px] text-sm">
          <AlertCircle size={14} /> {err}
        </div>
      )}

      {/* Spec 15: who changed this camper or their registrations, with Revert. */}
      <button
        type="button"
        onClick={() => setShowHistory(v => !v)}
        aria-expanded={showHistory}
        className="h-9 px-3 rounded-[8px] border border-border-strong bg-surface text-xs font-semibold text-ink hover:bg-surface-sunken transition"
      >
        {showHistory ? 'Hide history' : 'Show history'}
      </button>
      {showHistory && (
        <HistoryStrip
          load={() => supabase.rpc('admin_camper_history', { p_student_id: student.id })}
          sectionName={sectionName}
          onReverted={onReverted}
        />
      )}
    </div>
  )
}

function exportStudentCSV(students: AdminStudent[]) {
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

  downloadCsv(`student-roster-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows))
}

type StatusFilter = 'all' | RegistrationStatus | 'unregistered'

export default function AdminStudents() {
  const { students, loading, error, updateRegistrationStatus, moveStudentToSection, removeRegistration, refetch: refetchStudents } = useAdminStudents()
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
  // Render 100 rows at a time (spec 18); a new search or filter starts again at 100.
  const PAGE = 100
  const filterKey = `${search}|${statusFilter}`
  const [limit, setLimit] = useState({ key: filterKey, n: PAGE })
  const shown = limit.key === filterKey ? limit.n : PAGE
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Every section (cancelled ones too) by id, for the History strip's "Moved: A → B" lines.
  const sectionName = useMemo(() => {
    const byId = new Map(classes.flatMap(c => c.sections.map(s => [s.id, `${c.name} · ${s.label}${s.week ? ` (W${s.week})` : ''}`] as const)))
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
    }))),
    [classes]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter(s => {
      const matchesSearch = !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'unregistered' && s.registrations.length === 0) ||
        s.registrations.some(r => r.status === statusFilter)

      return matchesSearch && matchesStatus
    })
  }, [students, search, statusFilter])

  // Counts students (each once per status they have), matching what the filter lists.
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

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-5">
        <AdminChangeRequests onResolved={() => { void refetchStudents() }} />
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-sans font-bold text-2xl text-ink">Students</h1>
          <button
            onClick={() => exportStudentCSV(filtered)}
            className="h-9 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Search by student or parent name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 pl-9 pr-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'confirmed', 'pending', 'waitlisted', 'cancelled', 'unregistered'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`h-8 px-3.5 rounded-full font-sans font-semibold text-xs capitalize border transition ${
                statusFilter === f ? 'bg-brand text-brand-on border-brand' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
              }`}
            >
              {f} ({statusCounts[f] ?? 0})
            </button>
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">⚠ {error}</div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-surface border border-border rounded-[14px] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
            <UserCheck size={28} className="text-ink-muted mx-auto mb-3" />
            <p className="font-sans font-semibold text-ink mb-1">No students found</p>
            <p className="font-sans text-sm text-ink-muted">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-[14px] overflow-hidden shadow-sm">
            {/* Column headings (desktop) */}
            <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_60px_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_24px] gap-4 px-5 py-3 border-b border-border bg-surface-sunken/40">
              {['Student', 'Age', 'Parent', 'Registrations', 'Medical', ''].map(h => (
                <span key={h} className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">{h}</span>
              ))}
            </div>
            <ul className="divide-y divide-border">
              {filtered.slice(0, shown).map(s => {
                const open = expandedId === s.id
                const flag = realNote(s.allergies) ?? realNote(s.medical_conditions) ?? realNote(s.medical_info)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : s.id)}
                      aria-expanded={open}
                      className="w-full text-left px-4 sm:px-5 py-3.5 hover:bg-surface-sunken/50 transition grid grid-cols-[minmax(0,1fr)_24px] md:grid-cols-[minmax(0,1.4fr)_60px_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_24px] gap-x-4 gap-y-2 items-center"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center shrink-0 font-sans font-bold text-xs text-warning">{s.full_name[0]}</span>
                        <span className="min-w-0">
                          <span className="block font-sans font-semibold text-sm text-ink truncate">{s.full_name}</span>
                          <span className="block md:hidden font-sans text-xs text-ink-muted truncate">Age {s.age} · {s.parent_name}</span>
                        </span>
                      </span>
                      <span className="hidden md:block font-sans text-sm text-ink tabular-nums">{s.age}</span>
                      <span className="hidden md:block font-sans text-sm text-ink-muted truncate">{s.parent_name}</span>
                      <span className="col-span-1 md:col-span-1 row-start-2 md:row-start-auto flex flex-wrap gap-1 min-w-0">
                        {s.registrations.length === 0 ? (
                          <span className="text-xs text-ink-faint font-sans">Not registered</span>
                        ) : s.registrations.map(r => (
                          <span key={r.id} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                            {r.class_name}{r.section_week ? ` W${r.section_week}` : ''} · <span className="capitalize ml-1">{r.status}</span>
                          </span>
                        ))}
                      </span>
                      <span className="hidden md:block min-w-0">
                        {flag
                          ? <span className="block text-xs font-semibold text-danger truncate" title={flag}>{flag}</span>
                          : <span className="text-xs text-ink-faint">—</span>}
                      </span>
                      <ChevronDown size={16} className={`row-start-1 col-start-2 md:row-start-auto md:col-start-auto text-ink-muted justify-self-end transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <StudentDetail
                        student={s}
                        allSections={allSections}
                        fillKnown={!fillError}
                        // Seat counts drive the over-fill warnings, so refresh them after each change.
                        onStatusChange={async (id, status) => { await updateRegistrationStatus(id, status); void refetchClasses() }}
                        onMoveSection={async (regId, sectionId, status) => { await moveStudentToSection(regId, sectionId, status); void refetchClasses() }}
                        onRemoveReg={async regId => { await removeRegistration(regId); void refetchClasses() }}
                        sectionName={sectionName}
                        onReverted={async () => { await refetchStudents(); void refetchClasses() }}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="px-5 py-2.5 border-t border-border bg-surface-sunken/20">
              <p className="font-sans text-xs text-ink-muted">
                {filtered.length > shown
                  ? `Showing ${shown} of ${filtered.length} students`
                  : `${filtered.length} student${filtered.length !== 1 ? 's' : ''} shown`} · select a student for details and registrations
              </p>
              {filtered.length > shown && (
                <button
                  type="button"
                  onClick={() => setLimit({ key: filterKey, n: shown + PAGE })}
                  className="mt-2 h-9 px-3.5 rounded-[8px] border border-border-strong bg-surface text-ink font-sans font-semibold text-sm hover:bg-surface-sunken transition"
                >
                  Show {Math.min(PAGE, filtered.length - shown)} more
                </button>
              )}
            </div>
          </div>
        )}
    </div>
  )
}
