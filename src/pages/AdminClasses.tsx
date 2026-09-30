import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Check, ChevronDown, BookOpen, Users } from 'lucide-react'
import { useConfirm } from '../hooks/useConfirm'
import { ActionError } from '../components/ActionError'
import { useAdminClasses, type ClassWithSections, type SectionWithCrew, type SupportEntry } from '../hooks/useAdminClasses'
import { useVolunteers } from '../hooks/useVolunteers'
import CapacityMeter from '../components/CapacityMeter'
import { supabase } from '../lib/supabase'
import type { Section } from '../types/database'

// ── Class editor modal ────────────────────────────────────────

interface ClassModalProps {
  initial: { name: string; description: string }
  title: string
  onSave: (payload: { name: string; description: string }) => Promise<void>
  onClose: () => void
}

function ClassModal({ initial, title, onSave, onClose }: ClassModalProps) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), description: description.trim() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-raised rounded-[18px] shadow-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sans font-bold text-xl text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink transition p-1"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="class-name">
              Course name <span className="text-danger">*</span>
            </label>
            <input
              id="class-name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Intro to Python"
              className="w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="class-desc">
              Description <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id="class-desc"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Shown to parents above the section list"
              className="w-full px-3.5 py-2.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition resize-none"
            />
          </div>
          {error && <p className="text-danger text-sm font-sans">⚠ {error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-11 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-11 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50">
              {saving ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Section editor modal ──────────────────────────────────────

interface SectionFormState {
  label: string
  age_min: string
  age_max: string
  capacity: string
  week: '' | '1' | '2'
  lead_id: string
  support_ids: string[]
}

interface SectionModalProps {
  classId: string
  className: string
  initial?: Partial<SectionFormState>
  title: string
  volunteerOptions: { id: string; display_name: string }[]
  onSave: (payload: Omit<Section, 'id' | 'created_at'>, supportIds: string[]) => Promise<void>
  onClose: () => void
}

function SectionModal({ classId, className, initial, title, volunteerOptions, onSave, onClose }: SectionModalProps) {
  const [form, setForm] = useState<SectionFormState>({
    label: initial?.label ?? '',
    age_min: initial?.age_min ?? '',
    age_max: initial?.age_max ?? '',
    capacity: initial?.capacity ?? '',
    week: initial?.week ?? '',
    lead_id: initial?.lead_id ?? '',
    support_ids: initial?.support_ids ?? [],
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
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  function addSupport(id: string) {
    if (!id || form.support_ids.includes(id)) return
    setForm(f => ({ ...f, support_ids: [...f.support_ids, id] }))
  }

  function removeSupport(id: string) {
    setForm(f => ({ ...f, support_ids: f.support_ids.filter(s => s !== id) }))
  }

  const ageMin = Number(form.age_min)
  const ageMax = Number(form.age_max)
  const agePreview = form.age_min && form.age_max && !isNaN(ageMin) && !isNaN(ageMax) && ageMax >= ageMin
    ? `Ages ${ageMin}–${ageMax}`
    : null

  const inputCls = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'
  const labelCls = 'block font-sans font-semibold text-sm text-ink mb-1.5'

  const assignedSupportSet = new Set(form.support_ids)
  const availableSupports = volunteerOptions.filter(
    v => !assignedSupportSet.has(v.id) && v.id !== form.lead_id
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-raised rounded-[18px] shadow-lg p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-sans font-bold text-xl text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink transition p-1"><X size={20} /></button>
        </div>
        <p className="font-sans text-sm text-ink-muted mb-5">{className}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="sec-label">Section label <span className="text-danger">*</span></label>
            <input
              id="sec-label"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Beginners A"
              className={inputCls}
            />
            {errors.label && <p className="mt-1 text-danger text-xs font-sans">{errors.label}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={labelCls.replace('mb-1.5', '')}>Age range <span className="text-danger">*</span></label>
              {agePreview && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-sunken text-ink-muted border border-border-strong">
                  Eligible: {agePreview}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number" min={1} max={17}
                  value={form.age_min}
                  onChange={e => setForm(f => ({ ...f, age_min: e.target.value }))}
                  placeholder="Min age"
                  className={inputCls}
                />
                {errors.age_min && <p className="mt-1 text-danger text-xs font-sans">{errors.age_min}</p>}
              </div>
              <div>
                <input
                  type="number" min={1} max={17}
                  value={form.age_max}
                  onChange={e => setForm(f => ({ ...f, age_max: e.target.value }))}
                  placeholder="Max age"
                  className={inputCls}
                />
                {errors.age_max && <p className="mt-1 text-danger text-xs font-sans">{errors.age_max}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="sec-cap">Capacity <span className="text-danger">*</span></label>
            <input
              id="sec-cap" type="number" min={1}
              value={form.capacity}
              onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
              placeholder="e.g. 20"
              className={inputCls}
            />
            {errors.capacity && <p className="mt-1 text-danger text-xs font-sans">{errors.capacity}</p>}
          </div>

          <div>
            <label className={labelCls}>Week <span className="font-normal text-ink-muted">(optional)</span></label>
            <div className="flex rounded-[10px] border border-border-strong overflow-hidden w-fit">
              {([['', 'Any'], ['1', 'Week 1'], ['2', 'Week 2']] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, week: val as SectionFormState['week'] }))}
                  className={`h-10 px-4 font-sans font-semibold text-sm transition ${
                    form.week === val ? 'bg-brand text-brand-on' : 'bg-surface text-ink hover:bg-surface-sunken'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Lead — single select */}
          <div>
            <label className={labelCls} htmlFor="sec-lead">Lead <span className="font-normal text-ink-muted">(optional)</span></label>
            <select
              id="sec-lead"
              value={form.lead_id}
              onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {volunteerOptions.map(v => (
                <option key={v.id} value={v.id}>{v.display_name}</option>
              ))}
            </select>
          </div>

          {/* Supports — multi-select with chips */}
          <div>
            <label className={labelCls}>Supports <span className="font-normal text-ink-muted">(optional — multiple allowed)</span></label>

            {form.support_ids.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {form.support_ids.map(id => {
                  const v = volunteerOptions.find(o => o.id === id)
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border-strong text-ink text-xs font-semibold"
                    >
                      {v?.display_name ?? id}
                      <button
                        type="button"
                        onClick={() => removeSupport(id)}
                        className="text-ink-muted hover:text-danger transition"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {availableSupports.length > 0 ? (
              <select
                className={inputCls}
                value=""
                onChange={e => { addSupport(e.target.value); e.target.value = '' }}
              >
                <option value="">Add a support…</option>
                {availableSupports.map(v => (
                  <option key={v.id} value={v.id}>{v.display_name}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs font-sans text-ink-faint mt-1">All available volunteers are assigned.</p>
            )}
          </div>

          {saveError && <p className="text-danger text-sm font-sans">⚠ {saveError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-11 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-11 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50">
              {saving ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving…' : 'Save section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Section roster modal ─────────────────────────────────────

interface RosterEntry {
  studentName: string
  studentAge: number
  medicalInfo: string | null
  parentName: string
  status: string
}

function SectionRosterModal({
  sectionId,
  sectionLabel,
  className,
  onClose,
}: {
  sectionId: string
  sectionLabel: string
  className: string
  onClose: () => void
}) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [sectionId])

  const STATUS_BADGE: Record<string, string> = {
    confirmed:  'bg-success-soft text-success',
    pending:    'bg-warning-soft text-warning',
    waitlisted: 'bg-surface-sunken text-ink-muted border border-border-strong',
    cancelled:  'bg-danger-soft text-danger',
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-sans font-bold text-lg text-ink">{sectionLabel} — Roster</h2>
            <p className="font-sans text-xs text-ink-muted">{className}</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-surface-sunken rounded-[8px] animate-pulse" />)}
            </div>
          ) : roster.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-sans text-ink-muted text-sm">No students enrolled in this section.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/40">
                  <th className="px-5 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Student</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Age</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Parent</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r, i) => (
                  <tr key={i} className={i < roster.length - 1 ? 'border-b border-border' : ''}>
                    <td className="px-5 py-3 font-sans text-sm font-semibold text-ink">
                      {r.studentName}
                      {r.medicalInfo && (
                        <span className="ml-1.5 text-xs font-normal text-danger" title={r.medicalInfo}>⚕</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-ink">{r.studentAge}</td>
                    <td className="px-4 py-3 font-sans text-sm text-ink-muted">{r.parentName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-2.5 border-t border-border bg-surface-sunken/20 shrink-0">
          <p className="font-sans text-xs text-ink-muted">{roster.length} student{roster.length !== 1 ? 's' : ''} enrolled</p>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function AdminClasses() {
  const { classes, loading, error, createClass, updateClass, deleteClass, createSection, updateSection, deleteSection } = useAdminClasses()
  const { volunteers } = useVolunteers()

  const volunteerOptions = volunteers.map(v => ({ id: v.id, display_name: v.profiles.display_name }))

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()

  const [classModal, setClassModal] = useState<null | { mode: 'create' | 'edit'; cls?: ClassWithSections }>(null)
  const [sectionModal, setSectionModal] = useState<null | {
    mode: 'create' | 'edit'
    classId: string
    className: string
    section?: SectionWithCrew
  }>(null)
  const [rosterModal, setRosterModal] = useState<null | {
    sectionId: string
    sectionLabel: string
    className: string
  }>(null)

  // Deleting cascades: class → sections → registrations + attendance. Always confirm, and say what goes.
  async function handleDeleteClass(cls: ClassWithSections) {
    const ok = await confirm({
      title: `Delete ${cls.name}?`,
      body: cls.sections.length === 0
        ? 'This class has no sections. This cannot be undone.'
        : `This also deletes its ${cls.sections.length} section${cls.sections.length === 1 ? '' : 's'}, ${cls.enrolled} camper registration${cls.enrolled === 1 ? '' : 's'} and their attendance history. This cannot be undone.`,
      confirmLabel: 'Delete class',
    })
    if (!ok) return
    setDeletingId(cls.id)
    setActionError(null)
    try { await deleteClass(cls.id) }
    catch (e) { setActionError(`Couldn't delete ${cls.name}: ${e instanceof Error ? e.message : 'unknown error'}`) }
    finally { setDeletingId(null) }
  }

  async function handleDeleteSection(cls: ClassWithSections, sec: SectionWithCrew) {
    const regs = sec.registered_count + sec.waitlist_count
    const ok = await confirm({
      title: `Delete ${cls.name} · ${sec.label}?`,
      body: regs === 0
        ? 'No campers are registered in this section. This cannot be undone.'
        : `${regs} camper registration${regs === 1 ? '' : 's'} (including waitlist) and their attendance history will be deleted. This cannot be undone.`,
      confirmLabel: 'Delete section',
    })
    if (!ok) return
    setDeletingSectionId(sec.id)
    setActionError(null)
    try { await deleteSection(sec.id) }
    catch (e) { setActionError(`Couldn't delete ${sec.label}: ${e instanceof Error ? e.message : 'unknown error'}`) }
    finally { setDeletingSectionId(null) }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-sans font-bold text-2xl text-ink">Classes</h1>
          <button
            onClick={() => setClassModal({ mode: 'create' })}
            className="h-11 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition"
          >
            <Plus size={16} /> New class
          </button>
        </div>
        <ActionError message={actionError} onDismiss={() => setActionError(null)} />
        {dialog}

        {error && (
          <div className="px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">⚠ {error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-surface border border-border rounded-[14px] animate-pulse" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center mx-auto mb-3">
              <BookOpen size={22} className="text-ink-muted" />
            </div>
            <p className="font-sans font-semibold text-ink mb-1">No classes yet</p>
            <p className="font-sans text-ink-muted text-sm">Create your first course above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map(cls => {
              const isOpen = expandedId === cls.id
              return (
                <div key={cls.id} className="bg-surface border border-border rounded-[14px] overflow-hidden">
                  {/* Class header row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : cls.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-sunken/40 transition text-left"
                  >
                    <ChevronDown
                      size={18}
                      className={`text-ink-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                    <h3 className="font-sans font-semibold text-[19px] text-ink flex-1 truncate">{cls.name}</h3>
                    <span className="px-2.5 py-1 rounded-full bg-surface-sunken text-ink-muted text-xs font-semibold border border-border shrink-0">
                      {cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''}
                    </span>
                    {cls.total_capacity > 0 && (
                      <div className="w-32 shrink-0" onClick={e => e.stopPropagation()}>
                        <CapacityMeter registered={cls.enrolled} capacity={cls.total_capacity} />
                      </div>
                    )}
                    <div className="flex items-center gap-1 shrink-0 ml-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setClassModal({ mode: 'edit', cls })}
                        className="p-2 text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[8px] transition"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(cls)}
                        disabled={deletingId === cls.id}
                        className="p-2 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[8px] transition disabled:opacity-40"
                      >
                        {deletingId === cls.id
                          ? <span className="w-3.5 h-3.5 rounded-full border-2 border-danger border-t-transparent animate-spin inline-block" />
                          : <Trash2 size={15} />}
                      </button>
                    </div>
                  </button>

                  {/* Expanded sections */}
                  {isOpen && (
                    <div className="border-t border-border bg-surface-sunken">
                      {cls.sections.length > 0 && (
                        <>
                          <div className="px-5 pt-3 pb-1">
                            <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Sections</p>
                          </div>
                          <div className="divide-y divide-border">
                            {cls.sections.map(sec => (
                              <SectionRow
                                key={sec.id}
                                section={sec}
                                onEdit={() => setSectionModal({ mode: 'edit', classId: cls.id, className: cls.name, section: sec })}
                                onDelete={() => handleDeleteSection(cls, sec)}
                                onRoster={() => setRosterModal({ sectionId: sec.id, sectionLabel: sec.label, className: cls.name })}
                                deleting={deletingSectionId === sec.id}
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Add section button */}
                      <div className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setSectionModal({ mode: 'create', classId: cls.id, className: cls.name })}
                          className="w-full h-10 border-2 border-dashed border-border-strong text-ink-muted hover:border-brand hover:text-brand font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 transition"
                        >
                          <Plus size={15} /> Add section to {cls.name}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {/* Class editor modal */}
      {classModal && (
        <ClassModal
          title={classModal.mode === 'create' ? 'New class' : 'Edit class'}
          initial={{
            name: classModal.cls?.name ?? '',
            description: classModal.cls?.description ?? '',
          }}
          onSave={async payload => {
            if (classModal.mode === 'edit' && classModal.cls) {
              await updateClass(classModal.cls.id, payload)
            } else {
              await createClass(payload)
            }
          }}
          onClose={() => setClassModal(null)}
        />
      )}

      {/* Roster modal */}
      {rosterModal && (
        <SectionRosterModal
          sectionId={rosterModal.sectionId}
          sectionLabel={rosterModal.sectionLabel}
          className={rosterModal.className}
          onClose={() => setRosterModal(null)}
        />
      )}

      {/* Section editor modal */}
      {sectionModal && (
        <SectionModal
          classId={sectionModal.classId}
          className={sectionModal.className}
          title={sectionModal.mode === 'create' ? 'Add section' : 'Edit section'}
          initial={sectionModal.section ? {
            label: sectionModal.section.label,
            age_min: String(sectionModal.section.age_min),
            age_max: String(sectionModal.section.age_max),
            capacity: String(sectionModal.section.capacity),
            week: sectionModal.section.week ? String(sectionModal.section.week) as '1' | '2' : '',
            lead_id: sectionModal.section.lead_id ?? '',
            support_ids: sectionModal.section.supports.map((s: SupportEntry) => s.id),
          } : undefined}
          volunteerOptions={volunteerOptions}
          onSave={async (payload, supportIds) => {
            if (sectionModal.mode === 'edit' && sectionModal.section) {
              const { class_id: _classId, ...rest } = payload  // eslint-disable-line @typescript-eslint/no-unused-vars
              await updateSection(sectionModal.section.id, rest, supportIds)
            } else {
              await createSection(payload, supportIds)
            }
          }}
          onClose={() => setSectionModal(null)}
        />
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
  deleting,
}: {
  section: SectionWithCrew
  onEdit: () => void
  onDelete: () => void
  onRoster: () => void
  deleting: boolean
}) {
  const allCrew: { person: { display_name: string }; isSenior: boolean }[] = [
    { person: section.lead ?? null, isSenior: true },
    ...section.supports.map(s => ({ person: s, isSenior: false })),
  ].filter(c => c.person !== null) as { person: { display_name: string }; isSenior: boolean }[]

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3.5">
      {/* Label + week badge */}
      <div className="flex items-center gap-2 min-w-0">
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
          <span className="font-sans text-xs text-ink-muted truncate max-w-[80px] ml-1.5">
            {allCrew[0].person.display_name}
            {allCrew.length > 1 && ` +${allCrew.length - 1}`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={onRoster} title="View roster" className="p-1.5 text-ink-muted hover:text-brand hover:bg-brand-soft rounded-[6px] transition">
          <Users size={14} />
        </button>
        <button onClick={onEdit} className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface rounded-[6px] transition">
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[6px] transition disabled:opacity-40"
        >
          {deleting
            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-danger border-t-transparent animate-spin inline-block" />
            : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  )
}
