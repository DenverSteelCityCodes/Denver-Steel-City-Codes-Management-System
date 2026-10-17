import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, Calendar, Copy } from 'lucide-react'
import { useSessions, formatSessionDates, type Session } from '../hooks/useSessions'
import { useScheduleItems } from '../hooks/useScheduleItems'
import { formatTimeRange } from '../lib/campDay'
import type { ScheduleItem } from '../types/database'
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

interface ItemFormState {
  start_time: string
  end_time: string
  title: string
  location: string
}

type ItemPayload = Omit<ScheduleItem, 'id' | 'created_at' | 'session_id'>

// Inline add/edit form for one daily-schedule time block.
function ScheduleItemForm({
  idPrefix,
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  idPrefix: string
  initial: ItemFormState
  submitLabel: string
  onSave: (payload: ItemPayload) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<ItemFormState>(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.start_time) { setErr('Start time is required'); return }
    if (form.end_time && form.end_time <= form.start_time) { setErr('End time must be after the start'); return }
    if (!form.title.trim()) { setErr('Describe what happens in this block'); return }
    setSaving(true)
    setErr(null)
    try {
      await onSave({
        start_time: form.start_time,
        end_time: form.end_time || null,
        title: form.title.trim(),
        location: form.location.trim() || null,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const input = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'
  const label = 'block font-sans font-semibold text-sm text-ink mb-1.5'

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      className="bg-surface border border-brand rounded-[12px] p-3 sm:p-4 space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor={`${idPrefix}-start`}>Starts <span className="text-danger">*</span></label>
          <input id={`${idPrefix}-start`} type="time" autoFocus value={form.start_time}
            onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label} htmlFor={`${idPrefix}-end`}>Ends <span className="font-normal text-ink-muted">(optional)</span></label>
          <input id={`${idPrefix}-end`} type="time" value={form.end_time}
            onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={input} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`${idPrefix}-title`}>What <span className="text-danger">*</span></label>
          <input id={`${idPrefix}-title`} maxLength={120} value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Drop-off" className={input} />
        </div>
        <div>
          <label className={label} htmlFor={`${idPrefix}-where`}>Where <span className="font-normal text-ink-muted">(optional)</span></label>
          <input id={`${idPrefix}-where`} value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Front lobby" className={input} />
        </div>
      </div>
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
  const { items, loading: itemsLoading, createItem, updateItem, deleteItem, copyTo } = useScheduleItems()
  const [editingItem, setEditingItem] = useState<{ sessionId: string; itemId: string | 'new' } | null>(null)
  const [pendingItemDelete, setPendingItemDelete] = useState<string | null>(null)
  const [itemBusy, setItemBusy] = useState(false)

  const sortItems = (list: ScheduleItem[]) => [...list].sort((a, b) => a.start_time.localeCompare(b.start_time))

  async function confirmItemDelete(item: ScheduleItem) {
    setItemBusy(true)
    setActionError(null)
    try {
      await deleteItem(item.id)
      setPendingItemDelete(null)
    } catch (e) {
      setActionError(`Couldn't remove ${item.title}: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setItemBusy(false)
    }
  }

  async function handleCopy(fromId: string, toId: string) {
    setItemBusy(true)
    setActionError(null)
    try {
      await copyTo(fromId, toId)
    } catch (e) {
      setActionError(`Couldn't copy the schedule: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setItemBusy(false)
    }
  }

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
          {sessions.map(s => {
            const sessionItems = sortItems(items.filter(i => i.session_id === s.id))
            const copySource = sessions.find(o => o.id !== s.id && items.some(i => i.session_id === o.id))
            return editing === s.id ? (
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
              <div className="px-4 sm:px-5 pb-4 pt-3 border-t border-border space-y-2">
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Daily schedule</p>
                {itemsLoading ? (
                  <div className="h-10 bg-surface-sunken rounded-[10px] animate-pulse" />
                ) : (
                  <>
                    {sessionItems.length === 0 && editingItem?.sessionId !== s.id && (
                      copySource ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-sans text-sm text-ink-muted">No daily schedule yet.</p>
                          <button
                            type="button"
                            disabled={itemBusy}
                            onClick={() => handleCopy(copySource.id, s.id)}
                            className="h-10 px-3.5 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition flex items-center gap-2 disabled:opacity-50"
                          >
                            <Copy size={14} /> Copy from {copySource.name}
                          </button>
                        </div>
                      ) : (
                        <p className="font-sans text-sm text-ink-muted">No daily schedule yet — add drop-off, sessions, lunch and pickup so families know the plan.</p>
                      )
                    )}
                    {sessionItems.length > 0 && (
                      <ul className="divide-y divide-border">
                        {sessionItems.map(item => editingItem?.sessionId === s.id && editingItem.itemId === item.id ? (
                          <li key={item.id} className="py-2">
                            <ScheduleItemForm
                              idPrefix={`item-${item.id}`}
                              initial={{ start_time: item.start_time.slice(0, 5), end_time: item.end_time?.slice(0, 5) ?? '', title: item.title, location: item.location ?? '' }}
                              submitLabel="Save"
                              onCancel={() => setEditingItem(null)}
                              onSave={async payload => { await updateItem(item.id, payload); setEditingItem(null) }}
                            />
                          </li>
                        ) : (
                          <li key={item.id}>
                            <div className="flex items-center justify-between gap-2 py-1.5">
                              <p className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-sans text-sm">
                                <span className="tabular-nums text-ink-muted">{formatTimeRange(item.start_time, item.end_time)}</span>
                                <span className="font-semibold text-ink">{item.title}</span>
                                {item.location && <span className="text-ink-muted">· {item.location}</span>}
                              </p>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => { setPendingItemDelete(null); setEditingItem({ sessionId: s.id, itemId: item.id }) }}
                                  aria-label={`Edit ${item.title}`}
                                  title="Edit time block"
                                  className="p-2 text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[8px] transition"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingItem(null); setPendingItemDelete(item.id) }}
                                  aria-label={`Remove ${item.title}`}
                                  title="Remove time block"
                                  className="p-2 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[8px] transition"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                            {pendingItemDelete === item.id && (
                              <div className="mb-2 rounded-[10px] overflow-hidden border border-danger/30">
                                <InlineConfirm
                                  message={`Remove ${item.title} from ${s.name}'s schedule?`}
                                  confirmLabel="Remove"
                                  tone="danger"
                                  busy={itemBusy}
                                  onConfirm={() => confirmItemDelete(item)}
                                  onCancel={() => setPendingItemDelete(null)}
                                />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {editingItem?.sessionId === s.id && editingItem.itemId === 'new' ? (
                      <ScheduleItemForm
                        idPrefix={`item-new-${s.id}`}
                        initial={{ start_time: '', end_time: '', title: '', location: '' }}
                        submitLabel="Add block"
                        onCancel={() => setEditingItem(null)}
                        onSave={async payload => { await createItem({ session_id: s.id, ...payload }); setEditingItem(null) }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setPendingItemDelete(null); setEditingItem({ sessionId: s.id, itemId: 'new' }) }}
                        className="w-full h-10 border-2 border-dashed border-border-strong text-ink-muted hover:border-brand hover:text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 transition"
                      >
                        <Plus size={15} /> Add a time block
                      </button>
                    )}
                  </>
                )}
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
          )})}
        </div>
      )}
    </div>
  )
}
