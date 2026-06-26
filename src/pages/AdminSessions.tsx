import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, Calendar } from 'lucide-react'
import { useSessions, type Session } from '../hooks/useSessions'

interface SessionFormState {
  name: string
  year: string
  start_date: string
  end_date: string
  is_active: boolean
}

function SessionModal({
  initial,
  title,
  onSave,
  onClose,
}: {
  initial: SessionFormState
  title: string
  onSave: (payload: Omit<Session, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<SessionFormState>(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.year || !form.start_date || !form.end_date) return
    if (form.end_date < form.start_date) { setErr('End date must be after start date'); return }
    setSaving(true)
    setErr(null)
    try {
      await onSave({
        name: form.name.trim(),
        year: Number(form.year),
        start_date: form.start_date,
        end_date: form.end_date,
        is_active: form.is_active,
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'
  const label = 'block font-sans font-semibold text-sm text-ink mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-raised rounded-[18px] shadow-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sans font-bold text-xl text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink p-1"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={label}>Session name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Session 1" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Start date *</label>
              <input type="date" required value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={input} />
            </div>
            <div>
              <label className={label}>End date *</label>
              <input type="date" required value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>Year *</label>
            <input type="number" required min={2020} max={2100} value={form.year}
              onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={input} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-brand"
              checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <span className="font-sans text-sm text-ink">Active (visible to users)</span>
          </label>
          {err && <p className="text-danger text-sm font-sans">⚠ {err}</p>}
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

export default function AdminSessions() {
  const { sessions, loading, error, createSession, updateSession, deleteSession } = useSessions()
  const [modal, setModal] = useState<null | { mode: 'create' | 'edit'; session?: Session }>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const BLANK: SessionFormState = { name: '', year: '2026', start_date: '', end_date: '', is_active: true }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await deleteSession(id) }
    finally { setDeletingId(null) }
  }

  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-[800px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-sans font-bold text-2xl text-ink mb-1">Sessions</h1>
            <p className="font-sans text-sm text-ink-muted">Each session is one camp week. Sections are linked to a session.</p>
          </div>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="h-11 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition"
          >
            <Plus size={16} /> New session
          </button>
        </div>

        {error && <div className="px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">⚠ {error}</div>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 bg-surface border border-border rounded-[14px] animate-pulse" />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
            <Calendar size={28} className="text-ink-muted mx-auto mb-3" />
            <p className="font-sans font-semibold text-ink mb-1">No sessions yet</p>
            <p className="font-sans text-sm text-ink-muted">Create your first camp session above.</p>
            <p className="font-sans text-xs text-ink-faint mt-3">Note: requires <code>migration_sessions.sql</code> to be applied in Supabase first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="bg-surface border border-border rounded-[14px] px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-brand" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-sans font-semibold text-base text-ink">{s.name}</p>
                      <span className="text-xs font-semibold text-ink-muted">· {s.year}</span>
                      {s.is_active && (
                        <span className="px-2 py-0.5 rounded-full bg-success-soft text-success text-xs font-semibold">Active</span>
                      )}
                    </div>
                    <p className="font-sans text-sm text-ink-muted">
                      {new Date(s.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                      {new Date(s.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setModal({ mode: 'edit', session: s })}
                    className="p-2 text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[8px] transition"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="p-2 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[8px] transition disabled:opacity-40"
                  >
                    {deletingId === s.id
                      ? <span className="w-3.5 h-3.5 rounded-full border-2 border-danger border-t-transparent animate-spin inline-block" />
                      : <Trash2 size={15} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal && (
        <SessionModal
          title={modal.mode === 'create' ? 'New session' : 'Edit session'}
          initial={modal.session ? {
            name: modal.session.name,
            year: String(modal.session.year),
            start_date: modal.session.start_date,
            end_date: modal.session.end_date,
            is_active: modal.session.is_active,
          } : BLANK}
          onSave={async payload => {
            if (modal.mode === 'edit' && modal.session) {
              await updateSession(modal.session.id, payload)
            } else {
              await createSession(payload)
            }
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
