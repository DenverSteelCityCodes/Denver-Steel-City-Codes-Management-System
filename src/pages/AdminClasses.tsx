import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, Check, ChevronDown, BookOpen, Users } from 'lucide-react'
import { ActionError } from '../components/ActionError'
import InlineConfirm from '../components/InlineConfirm'
import { useAdminClasses, type ClassWithSections, type SectionWithCrew } from '../hooks/useAdminClasses'
import { useVolunteers } from '../hooks/useVolunteers'
import CapacityMeter from '../components/CapacityMeter'
import { supabase } from '../lib/supabase'
import type { Section } from '../types/database'

// Everything on this page edits in place — no modals. Forms open where the thing lives
// (top of the list, the class header, the section row) and Esc cancels.

const inputCls = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'
const labelCls = 'block font-sans font-semibold text-sm text-ink mb-1.5'
const cancelBtnCls = 'h-10 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition'
const saveBtnCls = 'h-10 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50'

function SaveButton({ saving, label }: { saving: boolean; label: string }) {
  return (
    <button type="submit" disabled={saving} className={saveBtnCls}>
      {saving ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Check size={16} />}
      {saving ? 'Saving…' : label}
    </button>
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Course name is required'); return }
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
    <form
      onSubmit={handleSubmit}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      className="p-4 sm:p-5 space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <label className={labelCls} htmlFor="class-name">
            Course name <span className="text-danger">*</span>
          </label>
          <input
            id="class-name"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Intro to Python"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="class-desc">
            Description <span className="font-normal text-ink-muted">(optional — shown to parents)</span>
          </label>
          <input
            id="class-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What campers will build and learn"
            className={inputCls}
          />
        </div>
      </div>
      {error && <p role="alert" className="text-danger text-sm font-sans">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={cancelBtnCls}>Cancel</button>
        <SaveButton saving={saving} label={submitLabel} />
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
  lead_id: string
  support_ids: string[]
}

function SectionForm({
  classId,
  section,
  volunteerOptions,
  onSave,
  onCancel,
}: {
  classId: string
  section?: SectionWithCrew
  volunteerOptions: { id: string; display_name: string }[]
  onSave: (payload: Omit<Section, 'id' | 'created_at'>, supportIds: string[]) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<SectionFormState>({
    label: section?.label ?? '',
    age_min: section ? String(section.age_min) : '',
    age_max: section ? String(section.age_max) : '',
    capacity: section ? String(section.capacity) : '',
    week: section?.week ? (String(section.week) as '1' | '2') : '',
    lead_id: section?.lead_id ?? '',
    support_ids: section?.supports.map(s => s.id) ?? [],
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SectionFormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.label.trim()) e.label = 'Label is required'
    const min = Number(form.age_min)
    const max = Number(form.age_max)
    if (!form.age_min || isNaN(min) || min < 1 || min >= 18) e.age_min = 'Age must be 1–17'
    if (!form.age_max || isNaN(max) || max < 1 || max >= 18) e.age_max = 'Age must be 1–17'
    if (!e.age_min && !e.age_max && max < min) e.age_max = 'Max must be ≥ min'
    const cap = Number(form.capacity)
    if (!form.capacity || isNaN(cap) || cap < 1) e.capacity = 'Capacity must be at least 1'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
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
          lead_id: form.lead_id || null,
        },
        form.support_ids,
      )
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const ageMin = Number(form.age_min)
  const ageMax = Number(form.age_max)
  const agePreview = form.age_min && form.age_max && !isNaN(ageMin) && !isNaN(ageMax) && ageMax >= ageMin
    ? `Ages ${ageMin}–${ageMax}`
    : null

  const assigned = new Set(form.support_ids)
  const availableSupports = volunteerOptions.filter(v => !assigned.has(v.id) && v.id !== form.lead_id)
  const fieldErr = (k: keyof SectionFormState) =>
    errors[k] && <p className="mt-1 text-danger text-xs font-sans">{errors[k]}</p>

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      className="bg-surface border border-brand rounded-[12px] p-4 sm:p-5 space-y-4 shadow-sm"
    >
      <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
        {section ? `Edit ${section.label}` : 'New section'}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="sec-label">Section label <span className="text-danger">*</span></label>
          <input id="sec-label" autoFocus value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="e.g. Beginners A" className={inputCls} />
          {fieldErr('label')}
        </div>

        <div>
          <label className={labelCls} htmlFor="sec-cap">Capacity <span className="text-danger">*</span></label>
          <input id="sec-cap" type="number" min={1} value={form.capacity}
            onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
            placeholder="e.g. 20" className={inputCls} />
          {fieldErr('capacity')}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className={labelCls.replace('mb-1.5', '')}>Age range <span className="text-danger">*</span></span>
            {agePreview && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success-soft text-success">
                Eligible: {agePreview}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sec-age-min" className="sr-only">Minimum age</label>
              <input id="sec-age-min" type="number" min={1} max={17} value={form.age_min}
                onChange={e => setForm(f => ({ ...f, age_min: e.target.value }))}
                placeholder="Min age" className={inputCls} />
              {fieldErr('age_min')}
            </div>
            <div>
              <label htmlFor="sec-age-max" className="sr-only">Maximum age</label>
              <input id="sec-age-max" type="number" min={1} max={17} value={form.age_max}
                onChange={e => setForm(f => ({ ...f, age_max: e.target.value }))}
                placeholder="Max age" className={inputCls} />
              {fieldErr('age_max')}
            </div>
          </div>
        </div>

        <div>
          <span className={labelCls}>Week <span className="font-normal text-ink-muted">(optional)</span></span>
          <div role="radiogroup" aria-label="Week" className="flex rounded-[10px] border border-border-strong overflow-hidden w-fit">
            {([['', 'Any'], ['1', 'Week 1'], ['2', 'Week 2']] as const).map(([val, lbl]) => (
              <button key={val} type="button" role="radio" aria-checked={form.week === val}
                onClick={() => setForm(f => ({ ...f, week: val }))}
                className={`h-11 px-4 font-sans font-semibold text-sm transition ${
                  form.week === val ? 'bg-brand text-brand-on' : 'bg-surface text-ink hover:bg-surface-sunken'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="sec-lead">Lead <span className="font-normal text-ink-muted">(optional)</span></label>
          <select id="sec-lead" value={form.lead_id}
            onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))} className={inputCls}>
            <option value="">Unassigned</option>
            {volunteerOptions.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="sec-support">Supports <span className="font-normal text-ink-muted">(optional)</span></label>
          {form.support_ids.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {form.support_ids.map(id => (
                <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-sunken border border-border-strong text-ink text-xs font-semibold">
                  {volunteerOptions.find(o => o.id === id)?.display_name ?? id}
                  <button type="button" aria-label="Remove support"
                    onClick={() => setForm(f => ({ ...f, support_ids: f.support_ids.filter(s => s !== id) }))}
                    className="text-ink-muted hover:text-danger transition">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {availableSupports.length > 0 ? (
            <select id="sec-support" className={inputCls} value=""
              onChange={e => {
                const id = e.target.value
                if (id) setForm(f => ({ ...f, support_ids: [...f.support_ids, id] }))
              }}>
              <option value="">Add a support…</option>
              {availableSupports.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}
            </select>
          ) : (
            <p className="text-xs font-sans text-ink-faint mt-1">No other volunteers available.</p>
          )}
        </div>
      </div>

      {saveError && <p role="alert" className="text-danger text-sm font-sans">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={cancelBtnCls}>Cancel</button>
        <SaveButton saving={saving} label={section ? 'Save section' : 'Add section'} />
      </div>
    </form>
  )
}

// ── Section roster (inline, under the row) ────────────────────

interface RosterEntry {
  studentName: string
  studentAge: number
  medicalInfo: string | null
  parentName: string
  status: string
}

const STATUS_BADGE: Record<string, string> = {
  confirmed:  'bg-success-soft text-success',
  pending:    'bg-warning-soft text-warning',
  waitlisted: 'bg-info-soft text-info',
  cancelled:  'bg-danger-soft text-danger',
}

function SectionRoster({ sectionId }: { sectionId: string }) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('registrations')
      .select(`
        status,
        students (
          full_name, age, medical_info,
          profiles:parent_id ( display_name )
        )
      `)
      .eq('section_id', sectionId)
      .then(({ data }) => {
        if (cancelled) return
        setRoster(
          ((data ?? []) as unknown as {
            status: RosterEntry['status']
            students: { full_name: string; age: number; medical_info: string | null; profiles: { display_name: string } | null } | null
          }[]).map(r => ({
            studentName: r.students?.full_name ?? '—',
            studentAge: r.students?.age ?? 0,
            medicalInfo: r.students?.medical_info ?? null,
            parentName: r.students?.profiles?.display_name ?? '—',
            status: r.status,
          }))
        )
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [sectionId])

  if (loading) {
    return (
      <div className="px-4 sm:px-5 pb-4 space-y-2">
        {[1, 2].map(i => <div key={i} className="h-9 bg-surface rounded-[8px] animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-5 pb-4">
      {roster.length === 0 ? (
        <p className="font-sans text-sm text-ink-muted bg-surface border border-border rounded-[10px] px-4 py-3">
          No campers registered in this section yet.
        </p>
      ) : (
        <div className="bg-surface border border-border rounded-[10px] overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="border-b border-border">
                {['Camper', 'Age', 'Parent', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((r, i) => (
                <tr key={i} className={i < roster.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-4 py-2.5 font-sans font-semibold text-ink">
                    {r.studentName}
                    {r.medicalInfo && (
                      <span className="ml-1.5 text-xs font-normal text-danger" title={r.medicalInfo} aria-label={`Medical note: ${r.medicalInfo}`}>⚕</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-sans text-ink tabular-nums">{r.studentAge}</td>
                  <td className="px-4 py-2.5 font-sans text-ink-muted">{r.parentName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

type Editing =
  | { kind: 'new-class' }
  | { kind: 'class'; classId: string }
  | { kind: 'new-section'; classId: string }
  | { kind: 'section'; sectionId: string }
  | null

type PendingDelete = { kind: 'class'; id: string } | { kind: 'section'; id: string } | null

export default function AdminClasses() {
  const { classes, loading, error, createClass, updateClass, deleteClass, createSection, updateSection, deleteSection } = useAdminClasses()
  const { volunteers } = useVolunteers()

  const volunteerOptions = volunteers.map(v => ({ id: v.id, display_name: v.profiles.display_name }))

  // ?open=<classId> (from the top-bar search) expands that class.
  const [params] = useSearchParams()
  const urlOpen = params.get('open')
  const [appliedOpen, setAppliedOpen] = useState(urlOpen)
  const [expandedId, setExpandedId] = useState<string | null>(urlOpen)
  if (urlOpen !== appliedOpen) {
    setAppliedOpen(urlOpen)
    if (urlOpen) setExpandedId(urlOpen)
  }
  const [editing, setEditing] = useState<Editing>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const [deleting, setDeleting] = useState(false)
  const [rosterSectionId, setRosterSectionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function startEditing(next: Editing) {
    setPendingDelete(null)
    setEditing(next)
  }

  // Deleting cascades: class → sections → registrations + attendance, so the strip says what goes.
  function classDeleteMessage(cls: ClassWithSections) {
    const regs = cls.sections.reduce((n, s) => n + s.registered_count + s.waitlist_count, 0)
    return cls.sections.length === 0
      ? `Delete ${cls.name}? It has no sections. This can't be undone.`
      : `Delete ${cls.name}? This also deletes its ${cls.sections.length} section${cls.sections.length === 1 ? '' : 's'}, ${regs} registration${regs === 1 ? '' : 's'} and their attendance history. This can't be undone.`
  }

  function sectionDeleteMessage(sec: SectionWithCrew) {
    const regs = sec.registered_count + sec.waitlist_count
    return regs === 0
      ? `Delete ${sec.label}? No campers are registered. This can't be undone.`
      : `Delete ${sec.label}? ${regs} registration${regs === 1 ? '' : 's'} (including waitlist) and their attendance history will be deleted. This can't be undone.`
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setActionError(null)
    try {
      if (pendingDelete.kind === 'class') await deleteClass(pendingDelete.id)
      else await deleteSection(pendingDelete.id)
      setPendingDelete(null)
    } catch (e) {
      setActionError(`Couldn't delete: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  const iconBtn = 'p-2 text-ink-muted rounded-[8px] transition'

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-sans font-bold text-2xl text-ink">Classes</h1>
          {editing?.kind !== 'new-class' && (
            <button
              onClick={() => startEditing({ kind: 'new-class' })}
              className="h-11 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition"
            >
              <Plus size={16} /> New class
            </button>
          )}
        </div>
        <ActionError message={actionError} onDismiss={() => setActionError(null)} />

        {error && (
          <div className="px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">⚠ {error}</div>
        )}

        {editing?.kind === 'new-class' && (
          <div className="bg-surface border border-brand rounded-[14px] shadow-sm">
            <p className="px-4 sm:px-5 pt-4 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">New class</p>
            <ClassForm
              initial={{ name: '', description: '' }}
              submitLabel="Create class"
              onCancel={() => setEditing(null)}
              onSave={async payload => {
                const created = await createClass(payload)
                // Next step is always sections, so open the new class with its section form.
                setExpandedId(created.id)
                setEditing({ kind: 'new-section', classId: created.id })
              }}
            />
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-surface border border-border rounded-[14px] animate-pulse" />
            ))}
          </div>
        ) : classes.length === 0 && editing?.kind !== 'new-class' ? (
          <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center mx-auto mb-3">
              <BookOpen size={22} className="text-ink-muted" />
            </div>
            <p className="font-sans font-semibold text-ink mb-1">No classes yet</p>
            <p className="font-sans text-ink-muted text-sm">Create your first course with “New class”.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map(cls => {
              const isOpen = expandedId === cls.id
              const isEditingClass = editing?.kind === 'class' && editing.classId === cls.id
              return (
                <div key={cls.id} className={`bg-surface border rounded-[14px] overflow-hidden ${isEditingClass ? 'border-brand shadow-sm' : 'border-border'}`}>
                  {isEditingClass ? (
                    <ClassForm
                      initial={{ name: cls.name, description: cls.description ?? '' }}
                      submitLabel="Save"
                      onCancel={() => setEditing(null)}
                      onSave={async payload => {
                        await updateClass(cls.id, payload)
                        setEditing(null)
                      }}
                    />
                  ) : (
                    /* Header: the toggle and the row actions are siblings (no buttons inside a button). */
                    <div className="flex items-start sm:items-center gap-2 pl-3 pr-2 sm:px-5 py-3 sm:py-4 hover:bg-surface-sunken/40 transition">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : cls.id)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${cls.name}`}
                        className="flex-1 min-w-0 flex items-start sm:items-center gap-3 text-left"
                      >
                        <ChevronDown
                          size={18}
                          className={`mt-1 sm:mt-0 text-ink-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                        <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <span className="min-w-0 sm:flex-1">
                            <span className="block font-sans font-semibold text-[19px] text-ink truncate">{cls.name}</span>
                            {cls.description && (
                              <span className="block font-slab text-sm text-ink-muted truncate">{cls.description}</span>
                            )}
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-full bg-surface-sunken text-ink-muted text-xs font-semibold border border-border shrink-0">
                              {cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''}
                            </span>
                            {cls.total_capacity > 0 && (
                              <span className="block w-28 sm:w-32 shrink-0">
                                <CapacityMeter registered={cls.enrolled} capacity={cls.total_capacity} />
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEditing({ kind: 'class', classId: cls.id })}
                          aria-label={`Edit ${cls.name}`}
                          title="Edit class"
                          className={`${iconBtn} hover:text-ink hover:bg-surface-sunken`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setEditing(null); setPendingDelete({ kind: 'class', id: cls.id }) }}
                          aria-label={`Delete ${cls.name}`}
                          title="Delete class"
                          className={`${iconBtn} hover:text-danger hover:bg-danger-soft`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )}

                  {pendingDelete?.kind === 'class' && pendingDelete.id === cls.id && (
                    <InlineConfirm
                      message={classDeleteMessage(cls)}
                      confirmLabel="Delete class"
                      busy={deleting}
                      onConfirm={confirmDelete}
                      onCancel={() => setPendingDelete(null)}
                    />
                  )}

                  {/* Expanded sections */}
                  {isOpen && (
                    <div className="border-t border-border bg-surface-sunken">
                      {cls.sections.length > 0 && (
                        <>
                          <div className="px-4 sm:px-5 pt-3 pb-1">
                            <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Sections</p>
                          </div>
                          <div className="divide-y divide-border">
                            {cls.sections.map(sec => (
                              <div key={sec.id}>
                                {editing?.kind === 'section' && editing.sectionId === sec.id ? (
                                  <div className="px-4 sm:px-5 py-3">
                                    <SectionForm
                                      classId={cls.id}
                                      section={sec}
                                      volunteerOptions={volunteerOptions}
                                      onCancel={() => setEditing(null)}
                                      onSave={async (payload, supportIds) => {
                                        const { class_id: _classId, ...rest } = payload  // eslint-disable-line @typescript-eslint/no-unused-vars
                                        await updateSection(sec.id, rest, supportIds)
                                        setEditing(null)
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <SectionRow
                                    section={sec}
                                    rosterOpen={rosterSectionId === sec.id}
                                    onEdit={() => startEditing({ kind: 'section', sectionId: sec.id })}
                                    onDelete={() => { setEditing(null); setPendingDelete({ kind: 'section', id: sec.id }) }}
                                    onRoster={() => setRosterSectionId(rosterSectionId === sec.id ? null : sec.id)}
                                  />
                                )}
                                {pendingDelete?.kind === 'section' && pendingDelete.id === sec.id && (
                                  <InlineConfirm
                                    message={sectionDeleteMessage(sec)}
                                    confirmLabel="Delete section"
                                    busy={deleting}
                                    onConfirm={confirmDelete}
                                    onCancel={() => setPendingDelete(null)}
                                  />
                                )}
                                {rosterSectionId === sec.id && <SectionRoster sectionId={sec.id} />}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="px-4 sm:px-5 py-3">
                        {editing?.kind === 'new-section' && editing.classId === cls.id ? (
                          <SectionForm
                            classId={cls.id}
                            volunteerOptions={volunteerOptions}
                            onCancel={() => setEditing(null)}
                            onSave={async (payload, supportIds) => {
                              await createSection(payload, supportIds)
                              setEditing(null)
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing({ kind: 'new-section', classId: cls.id })}
                            className="w-full h-10 border-2 border-dashed border-border-strong text-ink-muted hover:border-brand hover:text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 transition"
                          >
                            <Plus size={15} /> Add section to {cls.name}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}

// ── Section row ───────────────────────────────────────────────

function SectionRow({
  section,
  onEdit,
  onDelete,
  onRoster,
  rosterOpen,
}: {
  section: SectionWithCrew
  onEdit: () => void
  onDelete: () => void
  onRoster: () => void
  rosterOpen: boolean
}) {
  const allCrew: { person: { display_name: string }; isSenior: boolean }[] = [
    { person: section.lead ?? null, isSenior: true },
    ...section.supports.map(s => ({ person: s, isSenior: false })),
  ].filter(c => c.person !== null) as { person: { display_name: string }; isSenior: boolean }[]

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:grid md:grid-cols-[1fr_auto_auto_auto_auto] md:gap-4 px-4 sm:px-5 py-3.5">
      {/* Label + week badge (own line on phones) */}
      <div className="flex items-center gap-2 min-w-0 w-full md:w-auto">
        <span className="font-sans font-semibold text-sm text-ink truncate">{section.label}</span>
        {section.week && (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-brand-soft text-warning text-xs font-semibold border border-brand/20">
            W{section.week}
          </span>
        )}
      </div>

      {/* Age chip */}
      <span className="px-2.5 py-1 rounded-full bg-surface text-ink-muted text-xs font-semibold border border-border-strong whitespace-nowrap">
        Ages {section.age_min}–{section.age_max}
      </span>

      {/* Capacity meter */}
      <div className="w-28">
        <CapacityMeter registered={section.registered_count} capacity={section.capacity} />
        {section.waitlist_count > 0 && (
          <p className="mt-0.5 font-sans text-[11px] font-semibold text-info">+{section.waitlist_count} waitlisted</p>
        )}
      </div>

      {/* Crew */}
      <div className="flex items-center gap-1 min-w-[120px]">
        {allCrew.length === 0 ? (
          <span className="font-sans text-xs text-ink-faint">No crew</span>
        ) : (
          allCrew.map(({ person, isSenior }, i) => (
            <div
              key={i}
              title={person.display_name}
              className={`w-7 h-7 rounded-full bg-role-volunteer-soft flex items-center justify-center text-xs font-bold text-role-volunteer shrink-0 ${
                isSenior ? 'ring-2 ring-brand' : 'ring-2 ring-surface'
              } ${i > 0 ? '-ml-2' : ''}`}
            >
              {person.display_name.charAt(0).toUpperCase()}
            </div>
          ))
        )}
        {allCrew.length > 0 && (
          <span className="font-sans text-xs text-ink-muted truncate max-w-[160px] md:max-w-[80px] ml-1.5">
            {allCrew[0].person.display_name}
            {allCrew.length > 1 && ` +${allCrew.length - 1}`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-auto md:ml-0">
        <button onClick={onRoster} title={rosterOpen ? 'Hide roster' : 'View roster'} aria-expanded={rosterOpen} aria-label={`${rosterOpen ? 'Hide' : 'View'} ${section.label} roster`} className={`p-1.5 rounded-[6px] transition ${rosterOpen ? 'text-ink bg-brand-soft' : 'text-ink-muted hover:text-ink hover:bg-brand-soft'}`}>
          <Users size={14} />
        </button>
        <button onClick={onEdit} title="Edit section" aria-label={`Edit ${section.label}`} className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface rounded-[6px] transition">
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          title="Delete section"
          aria-label={`Delete ${section.label}`}
          className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[6px] transition"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
