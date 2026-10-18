import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Copy, ArrowRight, ChevronDown, EyeOff } from 'lucide-react'
import { useSessions, formatSessionDates, activeCampYear, type Session } from '../hooks/useSessions'
import SeasonSettingsCard from '../components/SeasonSettingsCard'
import { useScheduleItems } from '../hooks/useScheduleItems'
import { formatTime, formatTimeRange } from '../lib/campDay'
import { closeAndFocus } from '../lib/focus'
import type { ScheduleItem } from '../types/database'
import InlineConfirm from '../components/InlineConfirm'
import Button from '../components/Button'
import { Input } from '../components/Field'
import AdminPageHead, { pageClass, h2Class } from '../components/AdminPageHead'
import { useAppSettings } from '../hooks/useAppSettings'
import { useVolunteerApplications } from '../hooks/useVolunteerApplications'
import { useLaptopCounts } from '../hooks/useAdminLaptops'
import { loanerSummary } from '../lib/laptopLoans'

interface SessionFormState {
  name: string
  year: string
  start_date: string
  end_date: string
  location: string
  // Loaner laptops the camp can lend that week (spec 29), as typed.
  laptop_loaners: string
  is_active: boolean
}

const label = 'block font-bold mb-1.5'
const optional = <span className="font-normal text-ink-muted">(optional)</span>
// An inline editor sits where the row was, framed by a 2px ink rule (no card, no modal).
const editFrame = 'p-4 rounded border-2 border-ink space-y-4'
const linkBtn = 'min-h-11 min-w-11 font-bold text-ink-muted underline underline-offset-[3px] cursor-pointer hover:text-ink'

// Inline create/edit form — renders in place of the row (or at the top for a new week).
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
    if (!form.name.trim()) { setErr('Give the week a name'); return }
    if (!form.start_date || !form.end_date) { setErr('Start and end dates are required'); return }
    if (form.end_date < form.start_date) { setErr('End date must be on or after the start date'); return }
    const loaners = Number(form.laptop_loaners.trim() || '0')
    if (!Number.isInteger(loaners) || loaners < 0 || loaners > 500) { setErr('Loaner laptops must be a whole number from 0 to 500'); return }
    setSaving(true)
    setErr(null)
    try {
      await onSave({
        name: form.name.trim(),
        // The camp year follows the start date, so they can't disagree.
        year: Number(form.start_date.slice(0, 4)),
        start_date: form.start_date,
        end_date: form.end_date,
        location: form.location.trim() || null,
        laptop_loaners: loaners,
        is_active: form.is_active,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} onKeyDown={e => { if (e.key === 'Escape') onCancel() }} className={editFrame}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="session-name">Name</label>
          <Input id="session-name" autoFocus value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="For example, Week 1" />
        </div>
        <div>
          <label className={label} htmlFor="session-start">Starts</label>
          <Input id="session-start" type="date" value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
        </div>
        <div>
          <label className={label} htmlFor="session-end">Ends</label>
          <Input id="session-end" type="date" value={form.end_date} min={form.start_date || undefined}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="session-location">Place</label>
        <p id="session-location-hint" className="-mt-0.5 mb-1.5 text-sm text-ink-muted text-pretty">Building and address. Families see it on the public camp page, when they register and before camp.</p>
        <Input id="session-location" value={form.location} maxLength={200} aria-describedby="session-location-hint"
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
          placeholder="Building name, street address" />
      </div>
      <div className="max-w-[20rem]">
        <label className={label} htmlFor="session-loaners">Loaner laptops</label>
        <p id="session-loaners-hint" className="-mt-0.5 mb-1.5 text-sm text-ink-muted text-pretty">How many the camp can lend this week. Requests past it wait in a first-come queue, and raising it gives loaners to the queue right away.</p>
        <Input id="session-loaners" type="number" inputMode="numeric" min={0} max={500} step={1} value={form.laptop_loaners}
          aria-describedby="session-loaners-hint" onChange={e => setForm(f => ({ ...f, laptop_loaners: e.target.value }))} />
      </div>
      <label className="flex items-start gap-3 min-h-11 py-2 cursor-pointer">
        <input type="checkbox" className="w-5 h-5 mt-0.5 shrink-0"
          checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
        <span className="text-pretty">
          <b className="font-bold">Visible to families</b>
          <span className="block text-sm text-ink-muted">Shows this week on the sign-up forms. To pause sign-ups for everyone, turn registration off above instead.</span>
        </span>
      </label>
      {err && <p role="alert" className="text-sm font-bold text-danger">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="ink" disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
      </div>
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

  return (
    <form noValidate onSubmit={handleSubmit} onKeyDown={e => { if (e.key === 'Escape') onCancel() }} className={`${editFrame} my-2`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor={`${idPrefix}-start`}>Starts</label>
          <Input id={`${idPrefix}-start`} type="time" autoFocus value={form.start_time}
            onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
        </div>
        <div>
          <label className={label} htmlFor={`${idPrefix}-end`}>Ends {optional}</label>
          <Input id={`${idPrefix}-end`} type="time" value={form.end_time}
            onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`${idPrefix}-title`}>What</label>
          <Input id={`${idPrefix}-title`} maxLength={120} value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="For example, Drop-off" />
        </div>
        <div>
          <label className={label} htmlFor={`${idPrefix}-where`}>Where {optional}</label>
          <Input id={`${idPrefix}-where`} value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="For example, Front lobby" />
        </div>
      </div>
      {err && <p role="alert" className="text-sm font-bold text-danger">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="ink" disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  )
}

// Volunteer applications open and close on Volunteers › Applications only; this is the status.
function ApplicationsStatus() {
  const { settings, loading, error } = useAppSettings()
  const { applications } = useVolunteerApplications()
  const open = settings['volunteer_applications_open'] === 'true'
  const pending = applications.filter(a => a.status === 'pending').length
  return (
    <section aria-labelledby="applications-heading" className="mt-10 pt-5 border-t-2 border-ink">
      <h2 id="applications-heading" className={h2Class}>Volunteer applications</h2>
      {loading ? (
        <div aria-hidden="true" className="mt-3 h-11 rounded bg-surface-sunken animate-pulse" />
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-pretty">
            {error
              ? <b title={error} className="font-extrabold text-danger">Couldn't check whether they're open</b>
              : <b className="font-extrabold">{open ? 'Open' : 'Closed'}</b>}
            {error ? '' : open ? ' at /apply' : ". The form at /apply isn't taking applications"}
            {pending > 0 && ` · ${pending} pending`}
          </p>
          <Link to="/admin/volunteers?tab=applications" className="inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px]">
            {error ? 'See them' : open ? 'Close them' : 'Open them'} in Volunteers <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  )
}

export default function AdminSessions() {
  const { sessions, loading, error, createSession, updateSession, deleteSession } = useSessions()
  // Loaners in use and queued per week (spec 29); reloads after a save (a cap raise promotes).
  const laptopCounts = useLaptopCounts(sessions)
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

  // A new week starts at the place of the latest one, since weeks usually share a building.
  const lastPlace = [...sessions].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]?.location ?? ''
  const BLANK: SessionFormState = { name: '', year: '', start_date: '', end_date: '', location: lastPlace, laptop_loaners: '0', is_active: true }

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

  // "8 blocks · 8:30 AM – 3:30 PM": the folded schedule's summary line.
  function scheduleSummary(list: ScheduleItem[]) {
    if (list.length === 0) return 'not set yet'
    const last = list.reduce((max, i) => ((i.end_time ?? i.start_time) > max ? (i.end_time ?? i.start_time) : max), list[0].start_time)
    return `${list.length} block${list.length === 1 ? '' : 's'} · ${formatTime(list[0].start_time)} – ${formatTime(last)}`
  }

  return (
    <div className={pageClass}>
      <AdminPageHead title="Season" lede={<>{!loading && `Season ${activeCampYear(sessions)}. `}Registration opens and closes here, and only here.</>} />

      <div className="max-w-[840px]">
        {actionError && <p role="alert" className="mb-4 text-sm font-bold text-danger text-pretty">{actionError}</p>}
        {/* Always here once loaded, even before any session exists: this holds the only registration
            switch. With no sessions, the season is this calendar year (activeCampYear). */}
        {!loading && <SeasonSettingsCard year={activeCampYear(sessions)} />}
        {!loading && <ApplicationsStatus />}

        <section aria-labelledby="weeks-heading" className="mt-10 pt-5 border-t-2 border-ink">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="weeks-heading" className={h2Class}>Weeks</h2>
              <p className="mt-1 text-sm text-ink-muted">Each week is one camp session.</p>
            </div>
            {editing !== 'new' && (
              <Button id="add-week" onClick={() => { setPendingDelete(null); setEditing('new') }}>
                <Plus size={18} strokeWidth={2.5} aria-hidden="true" /> Add a week
              </Button>
            )}
          </div>
          {error && <p role="alert" title={error} className="mt-3 font-bold text-danger">Couldn't load the weeks. Reload the page to try again.</p>}

          {editing === 'new' && (
            <div className="mt-4">
              <SessionForm
                initial={BLANK}
                submitLabel="Add week"
                onCancel={() => closeAndFocus(() => setEditing(null), 'add-week')}
                onSave={async payload => { await createSession(payload); closeAndFocus(() => setEditing(null), 'add-week') }}
              />
            </div>
          )}

          {loading ? (
            <div aria-busy="true" aria-label="Loading weeks" className="mt-3">
              {[1, 2].map(i => <div key={i} className="h-16 my-2 rounded bg-surface-sunken animate-pulse" />)}
            </div>
          ) : sessions.length === 0 && editing !== 'new' ? (
            <p className="mt-3 py-4 border-y border-border">
              <b className="font-bold">No weeks yet.</b> <span className="text-ink-muted">Add the camp weeks with “Add a week”.</span>
            </p>
          ) : (
            <ul className="mt-3">
              {sessions.map(s => {
                const sessionItems = sortItems(items.filter(i => i.session_id === s.id))
                const copySource = sessions.find(o => o.id !== s.id && items.some(i => i.session_id === o.id))
                const editingHere = editingItem?.sessionId === s.id
                return (
                  <li key={s.id} className="py-4 border-t border-border first:border-t-0">
                    {editing === s.id ? (
                      <SessionForm
                        initial={{ name: s.name, year: String(s.year), start_date: s.start_date, end_date: s.end_date, location: s.location ?? '', laptop_loaners: String(s.laptop_loaners ?? 0), is_active: s.is_active }}
                        submitLabel="Save"
                        onCancel={() => closeAndFocus(() => setEditing(null), `edit-week-${s.id}`)}
                        onSave={async payload => { await updateSession(s.id, payload); closeAndFocus(() => setEditing(null), `edit-week-${s.id}`) }}
                      />
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex-1 min-w-[min(100%,14rem)]">
                          <h3 className="text-lg font-bold leading-[1.3]">{s.name}</h3>
                          <p className="text-sm text-ink-muted">
                            {formatSessionDates(s)} · {s.is_active
                              ? 'visible to families'
                              : <b className="inline-flex items-center gap-1 font-extrabold text-ink"><EyeOff size={16} strokeWidth={2.5} aria-hidden="true" /> Hidden from families</b>}
                          </p>
                          <p className="text-sm text-ink-muted text-pretty">{s.location || 'No place set: families see "Place to be announced"'}</p>
                          <p className="text-sm text-ink-muted">
                            {laptopCounts ? loanerSummary(s.laptop_loaners ?? 0, laptopCounts.get(s.id)) : `Loaner laptops: ${s.laptop_loaners ?? 0}`}
                          </p>
                        </div>
                        <button type="button" id={`edit-week-${s.id}`} className={linkBtn} onClick={() => { setPendingDelete(null); setEditing(s.id) }}>
                          Edit<span className="sr-only"> {s.name}</span>
                        </button>
                        <button type="button" id={`remove-week-${s.id}`} className={linkBtn} aria-expanded={pendingDelete === s.id}
                          onClick={() => { setEditing(null); setPendingDelete(s.id) }}>
                          Remove<span className="sr-only"> {s.name}</span>
                        </button>
                      </div>
                    )}

                    {pendingDelete === s.id && (
                      <div className="mt-3">
                        <InlineConfirm
                          frame
                          message={`Delete ${s.name} (${s.year})? Its duty slots and sign-ups are deleted too, and sections linked to it become unscheduled. This can't be undone.`}
                          confirmLabel="Delete week"
                          cancelLabel="Keep it"
                          busy={deleting}
                          onConfirm={() => confirmDelete(s)}
                          onCancel={() => closeAndFocus(() => setPendingDelete(null), `remove-week-${s.id}`)}
                        />
                      </div>
                    )}

                    <details className="group mt-1">
                      <summary className="inline-flex items-center gap-1.5 min-h-11 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        Daily schedule · {itemsLoading ? 'loading…' : scheduleSummary(sessionItems)}
                        <ChevronDown size={18} aria-hidden="true" className="transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="pb-2">
                        {sessionItems.length === 0 && !editingHere && !itemsLoading && (
                          copySource ? (
                            <div className="flex flex-wrap items-center gap-3 py-2">
                              <p className="text-ink-muted">No daily schedule yet.</p>
                              <Button disabled={itemBusy} onClick={() => handleCopy(copySource.id, s.id)}>
                                <Copy size={16} aria-hidden="true" /> Copy from {copySource.name}
                              </Button>
                            </div>
                          ) : (
                            <p className="py-2 text-ink-muted text-pretty">No daily schedule yet. Add drop-off, sessions, lunch and pickup so families know the plan.</p>
                          )
                        )}
                        {sessionItems.length > 0 && (
                          <ul className="border-y border-ink">
                            {sessionItems.map(item => editingItem?.sessionId === s.id && editingItem.itemId === item.id ? (
                              <li key={item.id} className="border-t border-border first:border-t-0">
                                <ScheduleItemForm
                                  idPrefix={`item-${item.id}`}
                                  initial={{ start_time: item.start_time.slice(0, 5), end_time: item.end_time?.slice(0, 5) ?? '', title: item.title, location: item.location ?? '' }}
                                  submitLabel="Save"
                                  onCancel={() => closeAndFocus(() => setEditingItem(null), `edit-item-${item.id}`)}
                                  onSave={async payload => { await updateItem(item.id, payload); closeAndFocus(() => setEditingItem(null), `edit-item-${item.id}`) }}
                                />
                              </li>
                            ) : (
                              <li key={item.id} className="border-t border-border first:border-t-0">
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[11rem_minmax(0,1fr)_auto] items-center gap-x-4 py-1">
                                  <span className="tabular-nums text-ink-muted max-sm:col-span-2 max-sm:pt-1">{formatTimeRange(item.start_time, item.end_time)}</span>
                                  <span className="min-w-0 text-pretty">
                                    <b className="font-bold">{item.title}</b>{item.location && <span className="text-ink-muted"> · {item.location}</span>}
                                  </span>
                                  <span className="inline-flex gap-x-4">
                                    <button type="button" id={`edit-item-${item.id}`} className={linkBtn}
                                      onClick={() => { setPendingItemDelete(null); setEditingItem({ sessionId: s.id, itemId: item.id }) }}>
                                      Edit<span className="sr-only"> {item.title}</span>
                                    </button>
                                    <button type="button" id={`remove-item-${item.id}`} className={linkBtn} aria-expanded={pendingItemDelete === item.id}
                                      onClick={() => { setEditingItem(null); setPendingItemDelete(item.id) }}>
                                      Remove<span className="sr-only"> {item.title}</span>
                                    </button>
                                  </span>
                                </div>
                                {pendingItemDelete === item.id && (
                                  <div className="pb-3">
                                    <InlineConfirm
                                      frame
                                      message={`Remove ${item.title} from ${s.name}'s schedule?`}
                                      confirmLabel="Remove block"
                                      cancelLabel="Keep it"
                                      busy={itemBusy}
                                      onConfirm={() => confirmItemDelete(item)}
                                      onCancel={() => closeAndFocus(() => setPendingItemDelete(null), `remove-item-${item.id}`)}
                                    />
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {editingHere && editingItem.itemId === 'new' ? (
                          <ScheduleItemForm
                            idPrefix={`item-new-${s.id}`}
                            initial={{ start_time: '', end_time: '', title: '', location: '' }}
                            submitLabel="Add block"
                            onCancel={() => closeAndFocus(() => setEditingItem(null), `add-item-${s.id}`)}
                            onSave={async payload => { await createItem({ session_id: s.id, ...payload }); closeAndFocus(() => setEditingItem(null), `add-item-${s.id}`) }}
                          />
                        ) : !itemsLoading && (
                          <button type="button" id={`add-item-${s.id}`}
                            onClick={() => { setPendingItemDelete(null); setEditingItem({ sessionId: s.id, itemId: 'new' }) }}
                            className="mt-1 inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px] cursor-pointer">
                            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Add a time block<span className="sr-only"> to {s.name}</span>
                          </button>
                        )}
                      </div>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
