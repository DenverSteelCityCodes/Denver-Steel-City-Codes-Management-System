import { useState } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, ChevronDown, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdminClasses, type ClassWithSections, type SectionWithCrew } from '../hooks/useAdminClasses'
import { useVolunteers } from '../hooks/useVolunteers'
import CapacityMeter from '../components/CapacityMeter'
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
  support_id: string
}

interface SectionModalProps {
  classId: string
  className: string
  initial?: Partial<SectionFormState>
  title: string
  leadOptions: { id: string; display_name: string }[]
  onSave: (payload: Omit<Section, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

function SectionModal({ classId, className, initial, title, leadOptions, onSave, onClose }: SectionModalProps) {
  const [form, setForm] = useState<SectionFormState>({
    label: initial?.label ?? '',
    age_min: initial?.age_min ?? '',
    age_max: initial?.age_max ?? '',
    capacity: initial?.capacity ?? '',
    week: initial?.week ?? '',
    lead_id: initial?.lead_id ?? '',
    support_id: initial?.support_id ?? '',
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
      await onSave({
        class_id: classId,
        label: form.label.trim(),
        age_min: Number(form.age_min),
        age_max: Number(form.age_max),
        capacity: Number(form.capacity),
        week: form.week ? (Number(form.week) as 1 | 2) : null,
        lead_id: form.lead_id || null,
        support_id: form.support_id || null,
      })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const ageMin = Number(form.age_min)
  const ageMax = Number(form.age_max)
  const agePreview = form.age_min && form.age_max && !isNaN(ageMin) && !isNaN(ageMax) && ageMax >= ageMin
    ? `Ages ${ageMin}–${ageMax}`
    : null

  const inputCls = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'
  const labelCls = 'block font-sans font-semibold text-sm text-ink mb-1.5'

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="sec-lead">Lead <span className="font-normal text-ink-muted">(optional)</span></label>
              <select
                id="sec-lead"
                value={form.lead_id}
                onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">Unassigned</option>
                {leadOptions.map(v => (
                  <option key={v.id} value={v.id}>{v.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="sec-support">Support <span className="font-normal text-ink-muted">(optional)</span></label>
              <select
                id="sec-support"
                value={form.support_id}
                onChange={e => setForm(f => ({ ...f, support_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">Unassigned</option>
                {leadOptions.map(v => (
                  <option key={v.id} value={v.id}>{v.display_name}</option>
                ))}
              </select>
            </div>
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

// ── Main page ─────────────────────────────────────────────────

export default function AdminClasses() {
  const navigate = useNavigate()
  const { classes, loading, error, createClass, updateClass, deleteClass, createSection, updateSection, deleteSection } = useAdminClasses()
  const { volunteers } = useVolunteers()

  const volunteerOptions = volunteers.map(v => ({ id: v.id, display_name: v.profiles.display_name }))

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null)

  // Class modal state
  const [classModal, setClassModal] = useState<null | { mode: 'create' | 'edit'; cls?: ClassWithSections }>(null)

  // Section modal state
  const [sectionModal, setSectionModal] = useState<null | {
    mode: 'create' | 'edit'
    classId: string
    className: string
    section?: SectionWithCrew
  }>(null)

  async function handleDeleteClass(id: string) {
    setDeletingId(id)
    try { await deleteClass(id) }
    finally { setDeletingId(null) }
  }

  async function handleDeleteSection(id: string) {
    setDeletingSectionId(id)
    try { await deleteSection(id) }
    finally { setDeletingSectionId(null) }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-16 bg-ink-900 flex items-center px-6 gap-4 shadow-sm">
        <button onClick={() => navigate('/admin')} className="text-white/60 hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <span className="font-sans font-bold text-white text-base tracking-tight">Manage classes</span>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-sans font-bold text-2xl text-ink">Classes</h1>
          <button
            onClick={() => setClassModal({ mode: 'create' })}
            className="h-11 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition"
          >
            <Plus size={16} /> New class
          </button>
        </div>

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
                        onClick={() => handleDeleteClass(cls.id)}
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
                                onDelete={() => handleDeleteSection(sec.id)}
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
      </main>

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
            support_id: sectionModal.section.support_id ?? '',
          } : undefined}
          leadOptions={volunteerOptions}
          onSave={async payload => {
            if (sectionModal.mode === 'edit' && sectionModal.section) {
              const { class_id, ...rest } = payload
              await updateSection(sectionModal.section.id, rest)
            } else {
              await createSection(payload)
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
  deleting,
}: {
  section: SectionWithCrew
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
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
      <div className="flex items-center gap-2 min-w-[120px]">
        {[
          { person: section.lead, isSenior: true },
          { person: section.support, isSenior: false },
        ].map(({ person, isSenior }, i) =>
          person ? (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full bg-role-volunteer-soft flex items-center justify-center text-xs font-bold text-role-volunteer shrink-0 ${
                isSenior ? 'ring-2 ring-brand' : ''
              } ${i > 0 ? '-ml-2 ring-2 ring-surface' : ''}`}>
                {person.display_name.charAt(0).toUpperCase()}
              </div>
              {i === 0 && <span className="font-sans text-xs text-ink-muted truncate max-w-[80px]">{person.display_name}</span>}
            </div>
          ) : (
            <span key={i} className="font-sans text-xs text-ink-faint">{i === 0 ? 'No lead' : '—'}</span>
          )
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
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
