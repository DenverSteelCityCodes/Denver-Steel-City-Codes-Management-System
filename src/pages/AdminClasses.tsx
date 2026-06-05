import { useState } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdminClasses } from '../hooks/useAdminClasses'
import DataTable from '../components/DataTable'
import type { ClassWithVolunteers } from '../hooks/useAdminClasses'

interface ClassFormState {
  name: string
  age_group: string
  capacity: string
}

const EMPTY_FORM: ClassFormState = { name: '', age_group: '', capacity: '' }

export default function AdminClasses() {
  const navigate = useNavigate()
  const { classes, loading, createClass, updateClass, deleteClass } = useAdminClasses()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClassFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openCreate() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); setError(null) }
  function openEdit(cls: ClassWithVolunteers) {
    setForm({ name: cls.name, age_group: cls.age_group, capacity: String(cls.capacity) })
    setEditingId(cls.id)
    setShowForm(true)
    setError(null)
  }
  function closeForm() { setShowForm(false); setEditingId(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = { name: form.name.trim(), age_group: form.age_group.trim(), capacity: Number(form.capacity) }
      if (editingId) await updateClass(editingId, payload)
      else await createClass(payload)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await deleteClass(id) }
    finally { setDeletingId(null) }
  }

  const columns = [
    { header: 'Class', accessor: (c: ClassWithVolunteers) => <span className="font-semibold">{c.name}</span> },
    { header: 'Age group', accessor: (c: ClassWithVolunteers) => <span className="text-ink-muted">{c.age_group}</span> },
    {
      header: 'Capacity',
      accessor: (c: ClassWithVolunteers) => (
        <span className="font-sans tabular-nums text-ink-muted text-sm">
          {c.registered_count} / {c.capacity}
        </span>
      ),
    },
    { header: 'Lead', accessor: (c: ClassWithVolunteers) => c.lead?.display_name ?? <span className="text-ink-faint">Unassigned</span> },
    { header: 'Support', accessor: (c: ClassWithVolunteers) => c.support?.display_name ?? <span className="text-ink-faint">Unassigned</span> },
    {
      header: '',
      accessor: (c: ClassWithVolunteers) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => openEdit(c)} className="p-2 text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[8px] transition">
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleDelete(c.id)}
            disabled={deletingId === c.id}
            className="p-2 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[8px] transition disabled:opacity-40"
          >
            {deletingId === c.id
              ? <span className="w-3.5 h-3.5 rounded-full border-2 border-danger border-t-transparent animate-spin inline-block" />
              : <Trash2 size={15} />}
          </button>
        </div>
      ),
    },
  ]

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
            onClick={openCreate}
            className="h-11 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition"
          >
            <Plus size={16} /> New class
          </button>
        </div>

        <DataTable columns={columns} rows={classes} keyFn={c => c.id} loading={loading} emptyMessage="No classes yet — create one above." />
      </main>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink-950/50" onClick={closeForm} />
          <div className="relative w-full max-w-md bg-surface-raised rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-sans font-semibold text-xl text-ink">{editingId ? 'Edit class' : 'New class'}</h2>
              <button onClick={closeForm} className="text-ink-faint hover:text-ink transition p-1 rounded-[10px]"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {(['name', 'age_group'] as const).map(field => (
                <div key={field} className="space-y-1.5">
                  <label className="block font-sans font-semibold text-sm text-ink capitalize" htmlFor={field}>
                    {field === 'age_group' ? 'Age group' : 'Class name'} <span className="text-danger">*</span>
                  </label>
                  <input
                    id={field}
                    required
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={field === 'age_group' ? 'e.g. Ages 8–10' : 'e.g. Intro to Python'}
                    className="w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition"
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="block font-sans font-semibold text-sm text-ink" htmlFor="capacity">
                  Capacity <span className="text-danger">*</span>
                </label>
                <input
                  id="capacity"
                  type="number"
                  required
                  min={1}
                  value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                  placeholder="20"
                  className="w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition"
                />
              </div>
              {error && <p className="text-danger text-sm font-sans">⚠ {error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm} className="flex-1 h-11 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 h-11 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50">
                  {saving ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Check size={16} />}
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
