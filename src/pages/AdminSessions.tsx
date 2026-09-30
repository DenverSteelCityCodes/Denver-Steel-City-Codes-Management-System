import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, Calendar } from 'lucide-react'
import { useSessions, formatSessionDates, type Session } from '../hooks/useSessions'
import { ActionError } from '../components/ActionError'
import InlineConfirm from '../components/InlineConfirm'

interface SessionFormState {
  name: string
  year: string
  start_date: string
  end_date: string
  is_active: boolean
}

// Inline create/edit form — renders in place of the row (or at the top for a new session).
function SessionForm({
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial: SessionFormState
  submitLabel: string
  onSave: (payload: Omit<Session, 'id' | 'created_at'>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<SessionFormState>(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Session name is required'); return }
    if (!form.start_date || !form.end_date) { setErr('Start and end dates are required'); return }
    if (form.end_date < form.start_date) { setErr('End date must be on or after the start date'); return }
    setSaving(true)
    setErr(null)
    try {
      await onSave({
        name: form.name.trim(),
        // The camp year follows the start date, so they can't disagree.
        year: Number(form.start_date.slice(0, 4)),
        start_date: form.start_date,
        end_date: form.end_date,
        is_active: form.is_active,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const input = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'
  const label = 'block font-sans font-semibold text-sm text-ink mb-1.5'

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      className="bg-surface border border-brand rounded-[14px] shadow-sm p-4 sm:p-5 space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="session-name">Session name <span className="text-danger">*</span></label>
          <input id="session-name" autoFocus value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Week 1" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="session-start">Start date <span className="text-danger">*</span></label>
          <input id="session-start" type="date" value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="session-end">End date <span className="text-danger">*</span></label>
          <input id="session-end" type="date" value={form.end_date} min={form.start_date || undefined}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={input} />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-brand"
            checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
          <span className="font-sans text-sm text-ink">Open for registration <span className="text-ink-muted">(shown to parents and volunteers)</span></span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="h-10 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="h-10 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition disabled:opacity-50">
            {saving ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Check size={16} />}
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
      {err && <p role="alert" className="text-danger text-sm font-sans">{err}</p>}
    </form>
  )
}

export default function AdminSessions() {
  const { sessions, loading, error, createSession, updateSession, deleteSession } = useSessions()
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const BLANK: SessionFormState = { name: '', year: '', start_date: '', end_date: '', is_active: true }

  async function confirmDelete(s: Session) {
    setDeleting(true)
    setActionError(null)
    try {
      await deleteSession(s.id)
      setPendingDelete(null)
    } catch (e) {
      setActionError(`Couldn't delete ${s.name}: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-sans font-bold text-2xl text-ink mb-1">Sessions</h1>
          <p className="font-sans text-sm text-ink-muted">Each session is one camp week. The first and second active sessions of the year are Week 1 and Week 2.</p>
        </div>
        {editing !== 'new' && (
          <button
            onClick={() => { setPendingDelete(null); setEditing('new') }}
            className="h-11 px-4 shrink-0 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition"
          >
            <Plus size={16} /> New session
          </button>
        )}
      </div>

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />
      {error && <div className="px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">⚠ {error}</div>}

      {editing === 'new' && (
        <SessionForm
          initial={BLANK}
          submitLabel="Create session"
          onCancel={() => setEditing(null)}
          onSave={async payload => { await createSession(payload); setEditing(null) }}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-surface border border-border rounded-[14px] animate-pulse" />)}
        </div>
      ) : sessions.length === 0 && editing !== 'new' ? (
        <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
          <Calendar size={28} className="text-ink-muted mx-auto mb-3" />
          <p className="font-sans font-semibold text-ink mb-1">No sessions yet</p>
          <p className="font-sans text-sm text-ink-muted">Add the camp weeks with “New session”.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => editing === s.id ? (
            <SessionForm
              key={s.id}
              initial={{ name: s.name, year: String(s.year), start_date: s.start_date, end_date: s.end_date, is_active: s.is_active }}
              submitLabel="Save"
              onCancel={() => setEditing(null)}
              onSave={async payload => { await updateSession(s.id, payload); setEditing(null) }}
            />
          ) : (
            <div key={s.id} className="bg-surface border border-border rounded-[14px] overflow-hidden">
              <div className="px-4 sm:px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-warning" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-sans font-semibold text-base text-ink">{s.name}</p>
                      <span className="text-xs font-semibold text-ink-muted">{s.year}</span>
                      {s.is_active ? (
                        <span className="px-2 py-0.5 rounded-full bg-success-soft text-success text-xs font-semibold">Open</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-surface-sunken text-ink-muted text-xs font-semibold border border-border">Hidden</span>
                      )}
                    </div>
                    <p className="font-sans text-sm text-ink-muted">{formatSessionDates(s)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setPendingDelete(null); setEditing(s.id) }}
                    aria-label={`Edit ${s.name}`}
                    title="Edit session"
                    className="p-2 text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[8px] transition"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => { setEditing(null); setPendingDelete(s.id) }}
                    aria-label={`Delete ${s.name}`}
                    title="Delete session"
                    className="p-2 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[8px] transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {pendingDelete === s.id && (
                <InlineConfirm
                  message={`Delete ${s.name} (${s.year})? Its duty slots and sign-ups are deleted too, and sections linked to it become unscheduled. This can't be undone.`}
                  confirmLabel="Delete session"
                  busy={deleting}
                  onConfirm={() => confirmDelete(s)}
                  onCancel={() => setPendingDelete(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
