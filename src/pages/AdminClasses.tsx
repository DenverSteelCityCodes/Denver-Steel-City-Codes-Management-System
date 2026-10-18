import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams, useLocation, Link } from 'react-router-dom'
import { Plus, X, Printer, UserRoundX, HeartPulse, Check } from 'lucide-react'
import InlineConfirm from '../components/InlineConfirm'
import HistoryStrip from '../components/HistoryStrip'
import Button from '../components/Button'
import Segmented from '../components/Segmented'
import RegistrationStatusWord from '../components/RegistrationStatusWord'
import CapacityMeter from '../components/CapacityMeter'
import { Input, Select } from '../components/Field'
import {
  useAdminClasses, type ClassWithSections, type SectionWithCrew, type SectionInput, type RegistrationTally,
} from '../hooks/useAdminClasses'
import { useVolunteers } from '../hooks/useVolunteers'
import { useSessions, campSessions } from '../hooks/useSessions'
import { supabase } from '../lib/supabase'
import { formatTimeRange } from '../lib/campDay'
import { healthLines } from '../lib/campers'
import { seatTotals } from '../lib/registrationStatus'
import { crewGroups, weekName, type CrewPerson, type CrewSection, type CrewGroup } from '../lib/sectionCrew'
import type { RegistrationStatus } from '../types/database'

// Classes (A-admin §9): a week × class timetable. Every section sits in its week's column with its
// time and room, its seats (ink meter, waitlist count) and its crew in words, "No lead" in ink
// weight. Selecting a section opens one panel under its class (Roster · Edit · History); only one
// panel is open at a time, and ?open=<section id> deep-links to it (?open=<class id> lands on the
// class). Everything edits in place, no modals; Esc cancels a form.

const h2 = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em]'
const label = 'block font-bold'
const hint = 'mt-1.5 text-sm text-ink-muted text-pretty'
const fieldError = 'mt-1.5 text-sm font-bold text-danger'
const textLink = 'inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px]'

// "Oct 19–23", or "Oct 30–Nov 3" across a month end.
function shortRange(start: string, end: string) {
  const a = new Date(`${start}T12:00:00`), b = new Date(`${end}T12:00:00`)
  const mon = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
  return mon(a) === mon(b) ? `${mon(a)} ${a.getDate()}–${b.getDate()}` : `${mon(a)} ${a.getDate()}–${mon(b)} ${b.getDate()}`
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const whenLine = (s: SectionWithCrew) =>
  [s.days, formatTimeRange(s.start_time, s.end_time), s.room].filter(Boolean).join(' · ')

// aria-disabled, not disabled, while saving: a disabled button drops keyboard focus to the page.
function SaveButton({ saving, children }: { saving: boolean; children: ReactNode }) {
  return (
    <Button type="submit" variant="primary" aria-disabled={saving || undefined} aria-busy={saving}>
      {saving
        ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        : <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
      {saving ? 'Saving…' : children}
    </Button>
  )
}

// ── Class form (inline) ───────────────────────────────────────

function ClassForm({
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial: { name: string; description: string }
  submitLabel: string
  onSave: (payload: { name: string; description: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), description: description.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} onKeyDown={e => { if (e.key === 'Escape') onCancel() }}>
      <div className="grid gap-x-4 gap-y-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] max-w-[880px]">
        <div>
          <label className={label} htmlFor="class-name">Course name</label>
          <Input id="class-name" autoFocus className="mt-1.5" value={name} placeholder="e.g. Intro to Python"
            aria-invalid={nameError || undefined} aria-describedby={nameError ? 'class-name-error' : undefined}
            onChange={e => setName(e.target.value)} />
          {nameError && <p id="class-name-error" className={fieldError}>Give the course a name.</p>}
        </div>
        <div>
          <label className={label} htmlFor="class-desc">Description <span className="font-normal text-ink-muted">(optional)</span></label>
          <Input id="class-desc" className="mt-1.5" value={description} placeholder="What campers will build and learn"
            aria-describedby="class-desc-hint" onChange={e => setDescription(e.target.value)} />
          <p id="class-desc-hint" className={hint}>Families see this when they pick a class.</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 font-bold text-danger text-pretty">Couldn't save the class: {error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <SaveButton saving={saving}>{submitLabel}</SaveButton>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

// ── Section form (inline) ─────────────────────────────────────

interface SectionFormState {
  label: string
  age_min: string
  age_max: string
  capacity: string
  week: '' | '1' | '2'
  days: string
  start_time: string
  end_time: string
  room: string
  lead_id: string
  support_ids: string[]
}

function CrewOptions({ groups }: { groups: CrewGroup[] }) {
  return groups.map(g => (
    <optgroup key={g.label} label={g.label}>
      {g.options.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}
    </optgroup>
  ))
}

function SectionForm({
  idBase,
  classId,
  section,
  initialWeek = null,
  enrolled,
  people,
  crewSections,
  onSave,
  onCancel,
  extra,
}: {
  idBase: string
  classId: string
  section?: SectionWithCrew
  initialWeek?: 1 | 2 | null
  // Confirmed + pending campers in this section; null when the seat counts couldn't be loaded.
  enrolled?: number | null
  people: CrewPerson[]
  crewSections: CrewSection[]
  onSave: (payload: SectionInput, supportIds: string[]) => Promise<void>
  onCancel: () => void
  // Quiet actions at the end of the footer (print, remove).
  extra?: ReactNode
}) {
  const [form, setForm] = useState<SectionFormState>({
    label: section?.label ?? '',
    age_min: section ? String(section.age_min) : '',
    age_max: section ? String(section.age_max) : '',
    capacity: section ? String(section.capacity) : '',
    week: section ? (section.week ? (String(section.week) as '1' | '2') : '') : (initialWeek ? (String(initialWeek) as '1' | '2') : ''),
    days: section?.days ?? 'Mon–Fri',
    start_time: section?.start_time?.slice(0, 5) ?? '',
    end_time: section?.end_time?.slice(0, 5) ?? '',
    room: section?.room ?? '',
    lead_id: section?.lead_id ?? '',
    support_ids: section?.supports.map(s => s.id) ?? [],
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SectionFormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const set = (patch: Partial<SectionFormState>) => { setSaved(false); setForm(f => ({ ...f, ...patch })) }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.label.trim()) e.label = 'Give the section a label.'
    const min = Number(form.age_min)
    const max = Number(form.age_max)
    if (!form.age_min || isNaN(min) || min < 1 || min >= 18) e.age_min = 'Ages run from 1 to 17.'
    if (!form.age_max || isNaN(max) || max < 1 || max >= 18) e.age_max = 'Ages run from 1 to 17.'
    if (!e.age_min && !e.age_max && max < min) e.age_max = 'The oldest age has to be at least the youngest.'
    const cap = Number(form.capacity)
    if (!form.capacity || isNaN(cap) || cap < 1) e.capacity = 'A section needs at least 1 seat.'
    if (form.start_time && form.end_time && form.end_time <= form.start_time) e.end_time = 'It has to end after it starts.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving || !validate()) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      await onSave(
        {
          class_id: classId,
          label: form.label.trim(),
          age_min: Number(form.age_min),
          age_max: Number(form.age_max),
          capacity: Number(form.capacity),
          week: form.week ? (Number(form.week) as 1 | 2) : null,
          days: form.days.trim() || 'Mon–Fri',
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          room: form.room.trim() || null,
          lead_id: form.lead_id || null,
        },
        // Never save the lead as a support of the same section too.
        form.support_ids.filter(id => id !== form.lead_id),
      )
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const ageMin = Number(form.age_min)
  const ageMax = Number(form.age_max)
  const ageLine = form.age_min && form.age_max && !isNaN(ageMin) && !isNaN(ageMax) && ageMax >= ageMin
    ? `Campers aged ${ageMin} to ${ageMax} can sign up.`
    : null

  // Lowering capacity below current enrolment is allowed, but say what it means before saving.
  const capNum = Number(form.capacity)
  const capacityWarning = !section || !form.capacity || isNaN(capNum) || capNum < 1
    ? null
    : enrolled === null
      ? (capNum < section.capacity ? "Current enrolment couldn't be loaded. Check the roster before lowering capacity." : null)
      : enrolled !== undefined && capNum < enrolled
        ? `${plural(enrolled, 'camper is', 'campers are')} enrolled; ${enrolled - capNum} will be over capacity.`
        : null

  // Options say level, free week and current crew, free people first (lib/sectionCrew).
  const week = form.week ? (Number(form.week) as 1 | 2) : null
  const target = { sectionId: section?.id, week }
  const lead = crewGroups(people, crewSections, target, 'lead')
  const supports = crewGroups(people, crewSections, target, 'support', new Set([...form.support_ids, form.lead_id]))
  const nameOf = (id: string) => people.find(p => p.id === id)?.name ?? 'A former volunteer'

  const id = (k: string) => `${idBase}-${k}`
  const err = (k: keyof SectionFormState) => errors[k]
    ? <p id={id(`${k}-error`)} className={fieldError}>{errors[k]}</p>
    : null
  // Both ages wrong in the same way read as one message, under the pair.
  const sameAges = !!errors.age_min && errors.age_min === errors.age_max
  const invalid = (k: keyof SectionFormState) => errors[k]
    ? { 'aria-invalid': true as const, 'aria-describedby': id(`${k === 'age_max' && sameAges ? 'age_min' : k}-error`) }
    : {}
  const legend = 'w-full pb-3 mb-4 border-b border-border text-base font-extrabold leading-[1.3]'

  return (
    <form noValidate onSubmit={handleSubmit} onKeyDown={e => { if (e.key === 'Escape') onCancel() }} className="@container">
      <div className="grid gap-x-8 gap-y-6 @3xl:grid-cols-[1.3fr_1.2fr_1fr]">
        <fieldset className="min-w-0">
          <legend className={legend}>Who</legend>
          <div>
            <label className={label} htmlFor={id('lead')}>Lead</label>
            <Select id={id('lead')} className="mt-1.5" value={form.lead_id} aria-describedby={id('lead-hint')}
              onChange={e => {
                const lid = e.target.value
                // The lead can't also be a support of this section.
                set({ lead_id: lid, support_ids: form.support_ids.filter(s => s !== lid) })
              }}>
              <option value="">No lead yet</option>
              <CrewOptions groups={lead.groups} />
            </Select>
            <p id={id('lead-hint')} className={hint}>
              {lead.freeSeniors > 0
                ? `${plural(lead.freeSeniors, 'senior is', 'seniors are')} free in ${weekName(week)}; free people are listed first.`
                : `No senior is free in ${weekName(week)}. Everyone is still listed.`}
            </p>
          </div>
          <div className="mt-5">
            <span id={id('sup-label')} className={label}>Supports</span>
            {form.support_ids.length > 0 && (
              <ul aria-labelledby={id('sup-label')} className="mt-1.5 flex flex-wrap gap-2">
                {form.support_ids.map(sid => (
                  <li key={sid} className="inline-flex items-center gap-0.5 min-h-11 pl-3 rounded border-2 border-border bg-surface font-bold">
                    {nameOf(sid)}
                    <button type="button" aria-label={`Remove ${nameOf(sid)}`}
                      onClick={() => set({ support_ids: form.support_ids.filter(s => s !== sid) })}
                      className="w-11 h-11 grid place-items-center rounded text-ink-muted hover:text-ink">
                      <X size={16} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label htmlFor={id('support')} className="sr-only">Add a support</label>
            {supports.groups.length > 0 ? (
              <Select id={id('support')} className="mt-2" value=""
                onChange={e => { const sid = e.target.value; if (sid) set({ support_ids: [...form.support_ids, sid] }) }}>
                <option value="">Add a support…</option>
                <CrewOptions groups={supports.groups} />
              </Select>
            ) : (
              <p className={hint}>Every volunteer is already on this section.</p>
            )}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className={legend}>When and where</legend>
          <div>
            <span id={id('week-label')} className={label}>Week</span>
            <Segmented mode="radio" labelledBy={id('week-label')} className="mt-1.5" value={form.week}
              onChange={w => set({ week: w })}
              options={[{ value: '', label: 'Both' }, { value: '1', label: 'Week 1' }, { value: '2', label: 'Week 2' }]} />
          </div>
          <div className="mt-5">
            <label className={label} htmlFor={id('days')}>Days</label>
            <Input id={id('days')} className="mt-1.5" value={form.days} placeholder="Mon–Fri" onChange={e => set({ days: e.target.value })} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor={id('start')}>Starts</label>
              <Input id={id('start')} type="time" className="mt-1.5" value={form.start_time} onChange={e => set({ start_time: e.target.value })} />
            </div>
            <div>
              <label className={label} htmlFor={id('end')}>Ends</label>
              <Input id={id('end')} type="time" className="mt-1.5" value={form.end_time} {...invalid('end_time')} onChange={e => set({ end_time: e.target.value })} />
            </div>
          </div>
          {err('end_time')}
          <div className="mt-5">
            <label className={label} htmlFor={id('room')}>Room</label>
            <Input id={id('room')} className="mt-1.5" value={form.room} placeholder="e.g. Room 101" aria-describedby={id('room-hint')} onChange={e => set({ room: e.target.value })} />
            <p id={id('room-hint')} className={hint}>Times and room can wait until they're known.</p>
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className={legend}>Seats</legend>
          <div>
            <label className={label} htmlFor={id('label')}>Section label</label>
            <Input id={id('label')} autoFocus={!section} className="mt-1.5" value={form.label} placeholder="e.g. PY-A"
              {...invalid('label')} onChange={e => set({ label: e.target.value })} />
            {err('label')}
          </div>
          <div className="mt-5">
            <label className={label} htmlFor={id('cap')}>Capacity</label>
            <Input id={id('cap')} type="number" inputMode="numeric" min={1} className="mt-1.5" value={form.capacity}
              {...invalid('capacity')} onChange={e => set({ capacity: e.target.value })} />
            {err('capacity')}
            {!errors.capacity && capacityWarning && <p role="status" className="mt-1.5 text-sm font-bold text-pretty">{capacityWarning}</p>}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor={id('age-min')}>Youngest age</label>
              <Input id={id('age-min')} type="number" inputMode="numeric" min={1} max={17} className="mt-1.5" value={form.age_min}
                {...invalid('age_min')} onChange={e => set({ age_min: e.target.value })} />
            </div>
            <div>
              <label className={label} htmlFor={id('age-max')}>Oldest age</label>
              <Input id={id('age-max')} type="number" inputMode="numeric" min={1} max={17} className="mt-1.5" value={form.age_max}
                {...invalid('age_max')} onChange={e => set({ age_max: e.target.value })} />
            </div>
          </div>
          {err('age_min')}
          {!sameAges && err('age_max')}
          {ageLine && !errors.age_min && !errors.age_max && <p className={hint}>{ageLine}</p>}
        </fieldset>
      </div>

      {saveError && <p role="alert" className="mt-5 font-bold text-danger text-pretty">Couldn't save the section: {saveError}</p>}
      <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-3">
        <SaveButton saving={saving}>{section ? `Save ${section.label}` : 'Add section'}</SaveButton>
        <Button onClick={onCancel}>{section ? 'Close' : 'Cancel'}</Button>
        {saved && <p role="status" className="font-bold">Saved.</p>}
        {extra && <span className="flex flex-wrap gap-x-5 md:ml-auto">{extra}</span>}
      </div>
    </form>
  )
}

// ── Section roster (in the panel) ─────────────────────────────

interface RosterEntry {
  studentName: string
  studentAge: number
  allergies: string | null
  medical_conditions: string | null
  medical_info: string | null
  parentName: string
  status: RegistrationStatus
}

const ROSTER_ORDER: Record<RegistrationStatus, number> = { confirmed: 0, pending: 1, offered: 2, waitlisted: 3, cancelled: 4 }

function RosterTable({ rows }: { rows: RosterEntry[] }) {
  const th = 'p-3 text-left align-bottom text-sm font-bold text-ink-muted border-b border-ink'
  const td = 'p-3 align-top max-md:block max-md:p-0 max-md:py-0.5'
  return (
    <table className="w-full border-collapse max-md:block">
      <thead className="max-md:sr-only">
        <tr>
          <th scope="col" className={th}>Camper</th>
          <th scope="col" className={`${th} w-16`}>Age</th>
          <th scope="col" className={th}>Health</th>
          <th scope="col" className={th}>Parent</th>
        </tr>
      </thead>
      <tbody className="max-md:block">
        {rows.map((r, i) => {
          const health = healthLines(r)
          return (
            <tr key={i} className={`max-md:block max-md:py-3 ${i > 0 ? '[&>td]:border-t [&>td]:border-border max-md:border-t max-md:border-border max-md:[&>td]:border-0' : ''}`}>
              <td className={td}>
                <span className="font-bold">{r.studentName}</span>
                {r.status !== 'confirmed' && <> <RegistrationStatusWord status={r.status} /></>}
              </td>
              <td className={`${td} tabular-nums`}><span className="md:hidden text-ink-muted">Age </span>{r.studentAge}</td>
              <td className={td}>
                {health.length > 0
                  ? health.map(h => (
                    <span key={h.label} className="flex items-start gap-1.5 font-bold text-danger text-pretty break-words">
                      <HeartPulse size={16} strokeWidth={2.5} aria-hidden="true" className="mt-1 shrink-0" />
                      <span><span className="font-extrabold">{h.label}:</span> {h.text}</span>
                    </span>
                  ))
                  : <span className="sr-only">No health notes</span>}
              </td>
              <td className={`${td} max-md:text-ink-muted`}>{r.parentName}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SectionRoster({ sectionId }: { sectionId: string }) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('registrations')
      .select(`
        status,
        students (
          full_name, age, allergies, medical_conditions, medical_info,
          profiles:parent_id ( display_name )
        )
      `)
      .eq('section_id', sectionId)
      .then(({ data, error }) => {
        if (cancelled) return
        setLoadError(error?.message ?? null)
        setRoster(
          ((data ?? []) as unknown as {
            status: RegistrationStatus
            students: {
              full_name: string; age: number
              allergies: string | null; medical_conditions: string | null; medical_info: string | null
              profiles: { display_name: string } | null
            } | null
          }[]).map(r => ({
            studentName: r.students?.full_name ?? 'Unknown camper',
            studentAge: r.students?.age ?? 0,
            // healthLines drops the "None" / "N/A" parents are asked to type, so only real notes show.
            allergies: r.students?.allergies ?? null,
            medical_conditions: r.students?.medical_conditions ?? null,
            medical_info: r.students?.medical_info ?? null,
            parentName: r.students?.profiles?.display_name ?? 'Unknown',
            status: r.status,
          })).sort((a, b) => ROSTER_ORDER[a.status] - ROSTER_ORDER[b.status] || a.studentName.localeCompare(b.studentName))
        )
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [sectionId])

  if (loading) return <div role="status" className="h-24 rounded bg-surface-sunken animate-pulse"><span className="sr-only">Loading the roster</span></div>
  if (loadError) {
    return <p role="alert" title={loadError} className="font-bold text-danger">Couldn't load the roster. Check your connection, then open the section again.</p>
  }

  const current = roster.filter(r => r.status !== 'cancelled')
  const cancelled = roster.filter(r => r.status === 'cancelled')
  return (
    <div>
      {current.length === 0
        ? <p className="text-ink-muted">No campers in this section yet.</p>
        : <RosterTable rows={current} />}
      {cancelled.length > 0 && (
        <details className="mt-3 group">
          <summary className="inline-flex items-center gap-2 min-h-11 font-bold cursor-pointer">
            Cancelled ({cancelled.length})
          </summary>
          <RosterTable rows={cancelled} />
        </details>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

type Editing =
  | { kind: 'new-class' }
  | { kind: 'class'; classId: string }
  | { kind: 'new-section'; classId: string; week: 1 | 2 | null }
  | null

type PendingDelete = { kind: 'class'; id: string } | { kind: 'section'; id: string } | null
// Registration counts for the pending delete, fetched fresh when the confirm opens.
type DeleteTally =
  | { id: string; state: 'loading' }
  | { id: string; state: 'ok'; tally: RegistrationTally }
  | { id: string; state: 'error'; message: string }

type Tab = 'roster' | 'edit' | 'history'
type WeekKey = 1 | 2 | 'both'

export default function AdminClasses() {
  const {
    classes, loading, error, fillError, refetch, countRegistrations,
    createClass, updateClass, deleteClass, createSection, updateSection, deleteSection,
    cancelSection, cancelClass,
  } = useAdminClasses()
  const { volunteers } = useVolunteers()
  const { sessions } = useSessions()

  const people = useMemo<CrewPerson[]>(() => volunteers.map(v => ({
    id: v.id, name: v.profiles.display_name, level: v.experience_level,
    week1: v.availability_week_1, week2: v.availability_week_2,
  })), [volunteers])
  const crewSections = useMemo<CrewSection[]>(() => classes.flatMap(c => c.sections.map(s => ({
    id: s.id, label: s.label, week: s.week, lead_id: s.lead_id, support_ids: s.supports.map(x => x.id), cancelled: !!s.cancelled_at,
  }))), [classes])
  const sectionById = useMemo(() => new Map(classes.flatMap(c => c.sections.map(s => [s.id, { cls: c, sec: s }] as const))), [classes])
  const personName = (id: string) => people.find(p => p.id === id)?.name ?? 'a former volunteer'

  // The open section lives in the URL (?open=<section id>), so Today and the search can link to it
  // and Back closes it. A class id there scrolls to that class.
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const openId = params.get('open')
  const open = openId ? sectionById.get(openId) ?? null : null

  const [editing, setEditing] = useState<Editing>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const [deleteTally, setDeleteTally] = useState<DeleteTally | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [tabState, setTabState] = useState<{ id: string; tab: Tab } | null>(null)

  // A section with no lead opens on Edit (that's the decision it needs); others on Roster.
  const defaultTab = (s: SectionWithCrew): Tab => (!s.lead_id && !s.cancelled_at ? 'edit' : 'roster')
  // The tab is chosen once, when a section opens (by a click or a link), and then only by the
  // person: saving a lead on Edit must not flip the panel to Roster.
  if ((open?.sec.id ?? null) !== (tabState?.id ?? null)) {
    setTabState(open ? { id: open.sec.id, tab: defaultTab(open.sec) } : null)
  }
  const tab: Tab = open && tabState?.id === open.sec.id ? tabState.tab : open ? defaultTab(open.sec) : 'roster'

  // Our own clicks change the URL too; only an arrival from elsewhere moves focus.
  const selfNav = useRef(false)
  function openSection(id: string | null) {
    setEditing(null)
    setPendingDelete(null)
    if (id !== openId) selfNav.current = true
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (id) next.set('open', id)
      else next.delete('open')
      return next
    }, { replace: true })
  }

  // Arriving with ?open= (Today's "Assign a lead", the top-bar search): bring it into view and
  // put focus on it, once the classes are in.
  const arrived = useRef<string | null>(null)
  useEffect(() => {
    const marker = `${location.key}:${openId}`
    if (selfNav.current) { selfNav.current = false; arrived.current = marker; return }
    if (loading || !openId || arrived.current === marker) return
    arrived.current = marker
    const el = document.getElementById(sectionById.has(openId) ? `panel-${openId}-h` : `class-${openId}`)
    el?.scrollIntoView({ block: 'start' })
    el?.focus({ preventScroll: true })
  }, [location.key, loading, openId, sectionById])

  // A panel opened by a click below the fold (a phone stacks both weeks above it) scrolls into view;
  // focus stays on the section the person picked.
  const reveal = useRef<string | null>(null)
  const openSecId = open?.sec.id
  useEffect(() => {
    if (!openSecId || reveal.current !== openSecId) return
    reveal.current = null
    const h = document.getElementById(`panel-${openSecId}-h`)
    if (h && h.getBoundingClientRect().top > window.innerHeight - 160) h.scrollIntoView({ block: 'start' })
  }, [openSecId])

  function startEditing(next: Editing) {
    setPendingDelete(null)
    setEditing(next)
    if (openId && sectionById.has(openId)) {
      selfNav.current = true
      setParams(prev => { const n = new URLSearchParams(prev); n.delete('open'); return n }, { replace: true })
    }
  }

  // Counts every registration the delete would cascade away (cancelled ones too), fresh from
  // the table rather than the cached seat counts, which can be stale or missing.
  function requestDelete(target: NonNullable<PendingDelete>, sectionIds: string[]) {
    if (target.kind === 'class') startEditing(null)
    setPendingDelete(target)
    setDeleteTally({ id: target.id, state: 'loading' })
    countRegistrations(sectionIds).then(
      tally => setDeleteTally(cur => cur?.id === target.id ? { id: target.id, state: 'ok', tally } : cur),
      (e: unknown) => setDeleteTally(cur => cur?.id === target.id
        ? { id: target.id, state: 'error', message: e instanceof Error ? e.message : 'unknown error' }
        : cur),
    )
  }

  // Removing depends on the fresh tally: an empty section or class is deleted; one with any
  // registration is cancelled instead (cancel_section / cancel_class keep every registration as
  // cancelled, so families keep their history and the change can be undone).
  function removeMode(id: string): 'loading' | 'delete' | 'cancel' {
    const t = deleteTally?.id === id ? deleteTally : null
    if (!t || t.state === 'loading') return 'loading'
    if (t.state === 'error') return 'cancel'
    const { active, waitlisted, cancelled } = t.tally
    return active + waitlisted + cancelled === 0 ? 'delete' : 'cancel'
  }

  function removeMessage(kind: 'class' | 'section', name: string, id: string, sectionCount = 0) {
    const mode = removeMode(id)
    if (mode === 'loading') return 'Checking for registrations…'
    if (mode === 'delete') {
      if (kind === 'section') return `Delete ${name}? It has no registrations. This can't be undone.`
      return sectionCount === 0
        ? `Delete ${name}? It has no sections. This can't be undone.`
        : `Delete ${name}? Its ${sectionCount} section${sectionCount === 1 ? ' has' : 's have'} no registrations. This can't be undone.`
    }
    const t = deleteTally?.id === id ? deleteTally : null
    const lead = t?.state === 'error'
      ? `Registrations couldn't be counted (${t.message}), so this cancels rather than deletes. `
      : ''
    const counts = t?.state === 'ok'
      ? [t.tally.active && `${t.tally.active} camper${t.tally.active === 1 ? '' : 's'} with a spot`,
         t.tally.waitlisted && `${t.tally.waitlisted} waitlisted`].filter(Boolean).join(' and ')
      : ''
    return `${lead}Cancel ${name}${kind === 'class' ? ' and all its sections' : ''}? ${counts ? `${counts} will be taken out. ` : ''}` +
      'Registrations are kept as cancelled, families see "Cancelled by camp" with a link to pick another class, ' +
      "and they go first on that week's waitlists."
  }

  const tallyLoading = deleteTally?.state === 'loading'

  async function confirmDelete() {
    if (!pendingDelete) return
    const mode = removeMode(pendingDelete.id)
    if (mode === 'loading') return
    const target = pendingDelete
    const classId = target.kind === 'class' ? target.id : sectionById.get(target.id)?.cls.id
    setDeleting(true)
    setActionError(null)
    try {
      if (mode === 'delete') {
        if (target.kind === 'class') await deleteClass(target.id)
        else await deleteSection(target.id)
      } else {
        if (target.kind === 'class') await cancelClass(target.id)
        else await cancelSection(target.id)
      }
      if (target.kind === 'section') openSection(null)
      else setPendingDelete(null)
      // The thing that held focus is gone or closed; land on its class.
      requestAnimationFrame(() => document.getElementById(`class-${classId}`)?.focus())
    } catch (e) {
      setActionError(`Couldn't ${mode === 'delete' ? 'delete' : 'cancel'}: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  function closePanel(sectionId: string) {
    openSection(null)
    requestAnimationFrame(() => document.getElementById(`sec-${sectionId}`)?.focus())
  }

  // Weeks as columns, with their dates. A section with no week runs in both and gets its own column.
  const weeks = campSessions(sessions)
  const cols: { key: WeekKey; label: string; dates: string | null }[] = ([1, 2] as const).map(w => ({
    key: w,
    label: `Week ${w}`,
    dates: weeks[w - 1] ? shortRange(weeks[w - 1].start_date, weeks[w - 1].end_date) : null,
  }))
  if (classes.some(c => c.sections.some(s => s.week === null))) cols.push({ key: 'both', label: 'Both weeks', dates: null })
  const colLabel = (w: 1 | 2 | null) => cols.find(c => c.key === (w ?? 'both'))
  const totals = seatTotals(classes.flatMap(c => c.sections))

  // ── One section in a cell ──
  function sectionBlock(cls: ClassWithSections, s: SectionWithCrew) {
    const expanded = open?.sec.id === s.id
    const full = s.capacity > 0 && s.registered_count >= s.capacity
    const almost = !full && s.capacity > 0 && s.registered_count / s.capacity >= 0.9
    const supportsN = s.supports.length
    const supportNames = s.supports.map(x => x.display_name).filter(Boolean).join(', ')
    return (
      <button key={s.id} type="button" id={`sec-${s.id}`} aria-expanded={expanded} aria-controls={`panel-${s.id}`}
        onClick={() => { if (expanded) closePanel(s.id); else { reveal.current = s.id; openSection(s.id) } }}
        className={`grid gap-0.5 w-[calc(100%+1rem)] -mx-2 p-2 min-h-11 rounded text-left transition-colors ${
          expanded ? 'bg-surface shadow-[inset_0_0_0_2px_var(--ink)]' : 'hover:bg-ink/5'} ${s.cancelled_at ? 'text-ink-muted' : ''}`}>
        <span className="sr-only">{cls.name}, </span>
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-lg font-extrabold leading-[1.2] tracking-[0.02em]">{s.label}</span>
          {whenLine(s) && <span className="text-sm text-ink-muted">{whenLine(s)}</span>}
        </span>
        <span className="text-sm text-ink-muted">Ages {s.age_min}–{s.age_max}</span>
        {s.cancelled_at ? (
          <span><RegistrationStatusWord status="cancelled" /></span>
        ) : (
          <>
            <span className="text-sm font-bold">
              {fillError
                ? `${s.capacity} seats`
                : <>{full ? <b className="font-extrabold">{s.registered_count}/{s.capacity} full</b> : `${s.registered_count}/${s.capacity}`}
                  {almost && ' · almost full'}
                  {s.waitlist_count > 0 && ` · ${s.waitlist_count} waitlisted`}</>}
            </span>
            {!fillError && <CapacityMeter registered={s.registered_count} capacity={s.capacity} />}
            <span className="text-sm mt-1">
              {s.lead
                ? <>{s.lead.display_name}{supportsN > 0 && <span className="text-ink-muted"> +{plural(supportsN, 'support')}</span>}</>
                : <><span className="inline-flex items-center gap-1.5 font-extrabold"><UserRoundX size={16} strokeWidth={2.5} aria-hidden="true" />No lead</span>
                  {supportsN > 0 && <span className="text-ink-muted"> · {supportNames ? `supports ${supportNames}` : plural(supportsN, 'support')}</span>}</>}
            </span>
          </>
        )}
      </button>
    )
  }

  // ── The panel row under a class: one at a time ──
  function panelFor(cls: ClassWithSections): ReactNode {
    const span = cols.length + 1
    const shell = (key: string, body: ReactNode, labelledBy?: string, id?: string) => (
      <tr key={key} className="max-md:block">
        <td colSpan={span} id={id} aria-labelledby={labelledBy}
          className="bg-surface border-y-2 border-ink px-4 md:px-5 pt-5 pb-6 max-md:block max-md:-mx-4">
          {body}
        </td>
      </tr>
    )

    if (editing?.kind === 'class' && editing.classId === cls.id) {
      return shell('edit-class', <>
        <h2 id={`edit-class-${cls.id}-h`} className="text-lg font-bold leading-[1.3] mb-4">Edit {cls.name}</h2>
        <ClassForm
          initial={{ name: cls.name, description: cls.description ?? '' }}
          submitLabel="Save class"
          onCancel={() => setEditing(null)}
          onSave={async payload => {
            await updateClass(cls.id, payload)
            setEditing(null)
          }}
        />
      </>, `edit-class-${cls.id}-h`)
    }

    if (editing?.kind === 'new-section' && editing.classId === cls.id) {
      return shell('new-section', <>
        <div className="flex flex-wrap items-start gap-x-4 mb-2">
          <h2 id={`new-section-${cls.id}-h`} className="flex-1 text-lg font-bold leading-[1.3]">New section in {cls.name}</h2>
        </div>
        <SectionForm
          idBase={`new-${cls.id}`}
          classId={cls.id}
          initialWeek={editing.week}
          people={people}
          crewSections={crewSections}
          onCancel={() => setEditing(null)}
          onSave={async (payload, supportIds) => {
            const { warning } = await createSection(payload, supportIds)
            // Close even on a partial save: the section exists now, and a second submit would
            // create a duplicate.
            setEditing(null)
            if (warning) setActionError(warning)
          }}
        />
      </>, `new-section-${cls.id}-h`)
    }

    if (pendingDelete?.kind === 'class' && pendingDelete.id === cls.id) {
      return shell('remove-class', (
        <InlineConfirm
          message={removeMessage('class', cls.name, cls.id, cls.sections.length)}
          confirmLabel={removeMode(cls.id) === 'delete' ? 'Delete class' : 'Cancel class'}
          cancelLabel="Keep class"
          busy={deleting || tallyLoading}
          onConfirm={confirmDelete}
          onCancel={() => { setPendingDelete(null); document.getElementById(`class-${cls.id}`)?.focus() }}
        />
      ))
    }

    if (open?.cls.id !== cls.id) return null
    const s = open.sec
    const col = colLabel(s.week)
    const idBase = `panel-${s.id}`
    const tabs: { value: Tab; label: string }[] = [
      { value: 'roster', label: fillError ? 'Roster' : `Roster · ${s.registered_count + s.waitlist_count}` },
      ...(s.cancelled_at ? [] : [{ value: 'edit' as const, label: 'Edit' }]),
      { value: 'history', label: 'History' },
    ]
    const shownTab = tabs.some(t => t.value === tab) ? tab : 'roster'
    const meta = [
      col?.dates, whenLine(s), `Ages ${s.age_min}–${s.age_max}`,
      fillError ? `${s.capacity} seats` : `${s.registered_count} of ${s.capacity} seats${s.waitlist_count ? ` · ${s.waitlist_count} waitlisted` : ''}`,
    ].filter(Boolean).join(' · ')
    const print = (
      <Link to={`/print/roster/${s.id}`} className={textLink}>
        <Printer size={16} strokeWidth={2.5} aria-hidden="true" /> Print roster
      </Link>
    )

    return shell('section', <>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <div className="flex-[1_1_280px] min-w-0">
          <h2 id={`${idBase}-h`} tabIndex={-1} className="text-lg font-bold leading-[1.3] focus:outline-none scroll-mt-44 lg:scroll-mt-28">
            {cls.name} · {s.label} · {s.week ? `Week ${s.week}` : 'Both weeks'}
          </h2>
          <p className="mt-1 text-sm text-ink-muted text-pretty">
            {meta}{s.cancelled_at && <> · <RegistrationStatusWord status="cancelled" /></>}
          </p>
        </div>
        <button type="button" onClick={() => closePanel(s.id)} className={`${textLink} text-ink-muted font-semibold`}>
          Close<span className="sr-only"> {s.label} {weekName(s.week)}</span>
        </button>
      </div>

      <Segmented mode="tabs" idBase={idBase} label={`${s.label} ${weekName(s.week)}`} className="mt-4"
        options={tabs} value={shownTab} onChange={t => setTabState({ id: s.id, tab: t })} />

      <div role="tabpanel" id={`${idBase}-panel-${shownTab}`} aria-labelledby={`${idBase}-tab-${shownTab}`} className="mt-5">
        {shownTab === 'roster' && <>
          <SectionRoster sectionId={s.id} />
          <div className="mt-3">{print}</div>
        </>}
        {shownTab === 'edit' && <>
          <SectionForm
            key={s.id}
            idBase={`edit-${s.id}`}
            classId={cls.id}
            section={s}
            enrolled={fillError ? null : s.registered_count}
            people={people}
            crewSections={crewSections}
            onCancel={() => closePanel(s.id)}
            onSave={async (payload, supportIds) => {
              const { class_id: _classId, ...rest } = payload  // eslint-disable-line @typescript-eslint/no-unused-vars
              await updateSection(s.id, rest, supportIds)
            }}
            extra={<>
              {print}
              {!(pendingDelete?.kind === 'section' && pendingDelete.id === s.id) && (
                <button type="button" id={`remove-${s.id}`} onClick={() => requestDelete({ kind: 'section', id: s.id }, [s.id])}
                  className={`${textLink} text-danger`}>
                  Remove section
                </button>
              )}
            </>}
          />
          {pendingDelete?.kind === 'section' && pendingDelete.id === s.id && (
            <div className="mt-4">
              <InlineConfirm
                message={removeMessage('section', `${s.label} ${weekName(s.week)}`, s.id)}
                confirmLabel={removeMode(s.id) === 'delete' ? 'Delete section' : 'Cancel section'}
                cancelLabel="Keep section"
                busy={deleting || tallyLoading}
                onConfirm={confirmDelete}
                onCancel={() => { setPendingDelete(null); requestAnimationFrame(() => document.getElementById(`remove-${s.id}`)?.focus()) }}
              />
            </div>
          )}
        </>}
        {shownTab === 'history' && (
          /* Spec 15: who changed this section, with Revert. */
          <HistoryStrip
            heading={false}
            load={() => supabase.rpc('admin_history', { p_table: 'sections', p_row_id: s.id })}
            tableName="sections"
            personName={personName}
            onReverted={async () => { await refetch() }}
          />
        )}
      </div>
    </>, `${idBase}-h`, `panel-${s.id}`)
  }

  const th = 'sticky top-[104px] lg:top-14 z-10 bg-bg p-3 text-left align-bottom font-extrabold border-b-2 border-ink'

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mb-6">
        <div className="flex-[1_1_260px] min-w-0">
          <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">Classes</h1>
          {!loading && classes.length > 0 && (
            <p className="mt-2 text-ink-muted">
              {[plural(classes.length, 'class', 'classes'), plural(totals.sections, 'section'),
                !fillError && `${plural(totals.seatsLeft, 'seat')} left`,
                !fillError && totals.waitlisted > 0 && `${totals.waitlisted} waitlisted`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {editing?.kind !== 'new-class' && (
          <Button onClick={() => startEditing({ kind: 'new-class' })}>
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" /> New class
          </Button>
        )}
      </div>

      {actionError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 py-3 border-y-2 border-ink">
          <p className="flex-[1_1_16rem] font-bold text-danger text-pretty">{actionError}</p>
          <button type="button" onClick={() => setActionError(null)} className="ui-btn ui-btn--text">Dismiss</button>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-y-2 border-ink">
          <p title={error} className="flex-[1_1_16rem] font-bold text-danger text-pretty">
            Couldn't load the classes{classes.length > 0 ? ', so this list may be out of date' : ''}. Check your connection, then try again.
          </p>
          <Button onClick={() => { void refetch() }}>Try again</Button>
        </div>
      )}
      {!error && fillError && (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-y-2 border-ink">
          <p title={fillError} className="flex-[1_1_16rem] font-bold text-pretty">
            Seat counts couldn't be loaded, so seats and waitlists aren't shown.
          </p>
          <Button onClick={() => { void refetch() }}>Try again</Button>
        </div>
      )}

      {editing?.kind === 'new-class' && (
        <section aria-labelledby="new-class-h" className="mb-8 pt-5 pb-6 border-y-2 border-ink">
          <h2 id="new-class-h" className={`${h2} mb-4`}>New class</h2>
          <ClassForm
            initial={{ name: '', description: '' }}
            submitLabel="Create class"
            onCancel={() => setEditing(null)}
            onSave={async payload => {
              const created = await createClass(payload)
              // Next step is always sections, so open the new class's section form.
              setEditing({ kind: 'new-section', classId: created.id, week: null })
            }}
          />
        </section>
      )}

      {loading && classes.length === 0 ? (
        <div role="status" className="border-y-2 border-ink py-2">
          <span className="sr-only">Loading classes</span>
          {[1, 2, 3].map(i => <div key={i} aria-hidden="true" className="h-28 my-2 rounded bg-surface-sunken animate-pulse" />)}
        </div>
      ) : classes.length === 0 ? (
        !error && editing?.kind !== 'new-class' && (
          <p className="py-4 border-y-2 border-ink text-ink-muted">No classes yet. Add the first one with New class.</p>
        )
      ) : (
        <div className="border-b-2 border-ink max-md:border-t-2">
          <table className="w-full table-fixed border-collapse max-md:block">
            <caption className="sr-only">
              Sections by class and week.{open ? ` ${open.sec.label} ${weekName(open.sec.week)} is open below ${open.cls.name}.` : ' Select a section to open its roster, edit it or see its history.'}
            </caption>
            <colgroup>
              <col className="w-[200px] min-[1400px]:w-[240px]" />
              {cols.map(c => <col key={c.key} />)}
            </colgroup>
            <thead className="max-md:sr-only">
              <tr>
                <th scope="col" className={th}>Class</th>
                {cols.map(c => (
                  <th key={c.key} scope="col" className={th}>
                    {c.label}{c.dates && <span className="font-semibold text-ink-muted"> · {c.dates}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="max-md:block">
              {classes.map((cls, i) => {
                const live = cls.sections.filter(s => !s.cancelled_at)
                const ages = live.length > 0
                  ? `Ages ${Math.min(...live.map(s => s.age_min))}–${Math.max(...live.map(s => s.age_max))}`
                  : 'No sections yet'
                const cell = 'p-3 align-top max-md:grid max-md:grid-cols-[76px_1fr] max-md:gap-3 max-md:px-0 max-md:py-2 max-md:border-t max-md:border-border max-md:before:content-[attr(data-label)] max-md:before:pt-2 max-md:before:text-sm max-md:before:font-bold max-md:before:text-ink-muted'
                const rule = i > 0 ? 'md:border-t md:border-border' : ''
                return (
                  <Fragment key={cls.id}>
                    <tr className={`max-md:block max-md:pt-3 max-md:pb-2 ${i > 0 ? 'max-md:border-t-2 max-md:border-ink' : ''}`}>
                      <th scope="row" id={`class-${cls.id}`} tabIndex={-1}
                        className={`p-3 text-left align-top font-normal max-md:block max-md:px-0 focus:outline-none scroll-mt-44 lg:scroll-mt-28 ${rule}`}>
                        <span className="block font-bold leading-[1.3]">{cls.name}</span>
                        <span className="block mt-0.5 text-sm text-ink-muted">{ages}</span>
                        {cls.description && <span className="block mt-0.5 text-sm text-ink-muted text-pretty">{cls.description}</span>}
                        <span className="flex flex-wrap gap-x-4 mt-1 text-sm">
                          <button type="button" onClick={() => startEditing({ kind: 'class', classId: cls.id })}
                            className={`${textLink} text-ink-muted font-semibold`}>
                            Edit<span className="sr-only"> {cls.name}</span>
                          </button>
                          <button type="button" onClick={() => requestDelete({ kind: 'class', id: cls.id }, cls.sections.map(s => s.id))}
                            className={`${textLink} text-ink-muted font-semibold`}>
                            Remove<span className="sr-only"> {cls.name}</span>
                          </button>
                        </span>
                      </th>
                      {cols.map(c => {
                        const here = cls.sections
                          .filter(s => (c.key === 'both' ? s.week === null : s.week === c.key))
                          .sort((a, b) => Number(!!a.cancelled_at) - Number(!!b.cancelled_at) || a.label.localeCompare(b.label))
                        const week = c.key === 'both' ? null : c.key
                        return (
                          <td key={c.key} data-label={c.label} className={`${cell} ${rule}`}>
                            <div className="grid gap-2 min-w-0">
                              {here.map(s => sectionBlock(cls, s))}
                              <button type="button" onClick={() => startEditing({ kind: 'new-section', classId: cls.id, week })}
                                className="inline-flex items-center gap-1.5 min-h-11 justify-self-start text-sm font-bold text-ink-muted hover:text-ink hover:underline underline-offset-[3px]">
                                <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                                Add section<span className="sr-only"> to {cls.name}, {c.label}</span>
                              </button>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                    {panelFor(cls)}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
