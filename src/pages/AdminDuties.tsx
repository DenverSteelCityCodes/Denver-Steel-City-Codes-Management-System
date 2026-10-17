import { useState } from 'react'
import { Plus, Trash2, Check, CalendarDays } from 'lucide-react'
import { useDutyTypes, useDutySlots } from '../hooks/useDutyRoles'
import { useSessions } from '../hooks/useSessions'
import { ActionError } from '../components/ActionError'
import InlineConfirm from '../components/InlineConfirm'

type PendingDelete = { kind: 'slot'; id: string } | { kind: 'type'; id: string } | null

export default function AdminDuties() {
  const { sessions } = useSessions()
  const { types, createType, deleteType } = useDutyTypes()
  const [selectedSession, setSelectedSession] = useState<string>('')
  const { slots, loading, createSlot, deleteSlot, refetch } = useDutySlots(selectedSession || undefined)

  const [newTypeName, setNewTypeName] = useState('')
  const [addingType, setAddingType] = useState(false)
  const [typeErr, setTypeErr] = useState<string | null>(null)

  const [slotForm, setSlotForm] = useState({ duty_type_id: '', slot_date: '', capacity: '2' })
  const [addingSlot, setAddingSlot] = useState(false)
  const [slotErr, setSlotErr] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleAddType(e: React.FormEvent) {
    e.preventDefault()
    if (!newTypeName.trim()) { setTypeErr('Give the duty a name'); return }
    setAddingType(true)
    setTypeErr(null)
    try { await createType(newTypeName.trim()); setNewTypeName('') }
    catch (e) { setTypeErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setAddingType(false) }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!slotForm.duty_type_id || !slotForm.slot_date) { setSlotErr('Pick a duty and a date'); return }
    // Link the slot to the camp week its date falls in, so it follows that session (and is
    // cleaned up with it) regardless of which filter is showing.
    const session = sessions.find(s => slotForm.slot_date >= s.start_date && slotForm.slot_date <= s.end_date)
    setAddingSlot(true)
    setSlotErr(null)
    try {
      await createSlot({
        duty_type_id: slotForm.duty_type_id,
        session_id: session?.id ?? (selectedSession || null),
        slot_date: slotForm.slot_date,
        capacity: Number(slotForm.capacity) || 2,
      })
      setSlotForm(f => ({ ...f, slot_date: '' }))
    } catch (e) {
      setSlotErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setAddingSlot(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setActionError(null)
    try {
      if (pendingDelete.kind === 'slot') await deleteSlot(pendingDelete.id)
      else { await deleteType(pendingDelete.id); await refetch() }
      setPendingDelete(null)
    } catch (e) {
      setActionError(`Couldn't delete: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  const grouped = slots.reduce<Record<string, typeof slots>>((acc, s) => {
    acc[s.slot_date] = acc[s.slot_date] ?? []
    acc[s.slot_date].push(s)
    return acc
  }, {})

  const input = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'
  const label = 'block font-sans text-xs text-ink-muted mb-1'

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-sans font-bold text-2xl text-ink mb-1">Duty schedule</h1>
        <p className="font-sans text-sm text-ink-muted">Daily jobs like check-in and lunch. Open slots here; accepted volunteers sign up from their dashboard.</p>
      </div>

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Duty types */}
        <section className="lg:col-span-1 space-y-3" aria-labelledby="duty-types-heading">
          <h2 id="duty-types-heading" className="font-sans font-bold text-lg text-ink">Duty types</h2>
          <ul className="bg-surface border border-border rounded-[14px] overflow-hidden divide-y divide-border">
            {types.map(t => (
              <li key={t.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="font-sans text-sm text-ink">{t.name}</span>
                  <button
                    onClick={() => setPendingDelete({ kind: 'type', id: t.id })}
                    aria-label={`Delete ${t.name}`}
                    title="Delete duty type"
                    className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[6px] transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {pendingDelete?.kind === 'type' && pendingDelete.id === t.id && (
                  <InlineConfirm
                    message={`Delete "${t.name}"? Every slot of this duty and its sign-ups go too.`}
                    confirmLabel="Delete"
                    busy={deleting}
                    onConfirm={confirmDelete}
                    onCancel={() => setPendingDelete(null)}
                  />
                )}
              </li>
            ))}
            {types.length === 0 && <li className="px-4 py-3 text-sm text-ink-muted font-sans">No duty types yet.</li>}
          </ul>
          <form onSubmit={handleAddType} className="flex gap-2">
            <label htmlFor="new-duty-type" className="sr-only">New duty type</label>
            <input
              id="new-duty-type" type="text" placeholder="New duty type…" value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              className="flex-1 min-w-0 h-10 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button type="submit" disabled={addingType} aria-label="Add duty type"
              className="h-10 w-10 bg-brand text-brand-on rounded-[8px] flex items-center justify-center shrink-0 disabled:opacity-50">
              {addingType ? <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Plus size={15} />}
            </button>
          </form>
          {typeErr && <p role="alert" className="text-danger text-sm font-sans">{typeErr}</p>}
        </section>

        {/* Slots */}
        <section className="lg:col-span-2 space-y-4" aria-labelledby="duty-slots-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="duty-slots-heading" className="font-sans font-bold text-lg text-ink">Duty slots</h2>
            <label htmlFor="duty-session-filter" className="sr-only">Show session</label>
            <select
              id="duty-session-filter"
              value={selectedSession}
              onChange={e => setSelectedSession(e.target.value)}
              className="h-9 pl-2.5 pr-7 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">All sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
            </select>
          </div>

          <form onSubmit={handleAddSlot} className="bg-surface border border-border rounded-[14px] p-4 space-y-3">
            <p className="font-sans font-semibold text-sm text-ink">Add duty slot</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_110px_auto] items-end">
              <div>
                <label htmlFor="slot-duty" className={label}>Duty</label>
                <select id="slot-duty" value={slotForm.duty_type_id}
                  onChange={e => setSlotForm(f => ({ ...f, duty_type_id: e.target.value }))} className={input}>
                  <option value="">Choose…</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="slot-day" className={label}>Date</label>
                <input id="slot-day" type="date" value={slotForm.slot_date}
                  onChange={e => setSlotForm(f => ({ ...f, slot_date: e.target.value }))} className={input} />
              </div>
              <div>
                <label htmlFor="slot-capacity" className={label}>Volunteers</label>
                <input id="slot-capacity" type="number" min={1} max={10} value={slotForm.capacity}
                  onChange={e => setSlotForm(f => ({ ...f, capacity: e.target.value }))} className={input} />
              </div>
              <button type="submit" disabled={addingSlot}
                className="h-11 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 shrink-0 disabled:opacity-50">
                {addingSlot ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Check size={16} />}
                Add
              </button>
            </div>
            {slotErr && <p role="alert" className="text-danger text-sm font-sans">{slotErr}</p>}
          </form>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface border border-border rounded-[14px] animate-pulse" />)}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="bg-surface border border-border rounded-[14px] p-10 text-center">
              <CalendarDays size={24} className="text-ink-muted mx-auto mb-2" />
              <p className="font-sans font-semibold text-ink mb-1">No duty slots yet</p>
              <p className="font-sans text-sm text-ink-muted">Add a duty and a date above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, daySlots]) => (
                  <div key={date}>
                    <h3 className="font-sans font-semibold text-sm text-ink-muted mb-1.5">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h3>
                    <ul className="bg-surface border border-border rounded-[14px] overflow-hidden divide-y divide-border">
                      {daySlots.map(slot => {
                        const full = slot.assigned_count >= slot.capacity
                        return (
                          <li key={slot.id}>
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-0">
                                <p className="font-sans font-semibold text-sm text-ink">{slot.duty_type?.name ?? '—'}</p>
                                <p className="font-sans text-xs text-ink-muted truncate">
                                  {slot.assigned_count}/{slot.capacity} filled
                                  {slot.assignments && slot.assignments.length > 0 && (
                                    <> · {slot.assignments.map(a => a.volunteer?.profiles?.display_name ?? '—').join(', ')}</>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${full ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
                                  {full ? 'Full' : 'Open'}
                                </span>
                                <button
                                  onClick={() => setPendingDelete({ kind: 'slot', id: slot.id })}
                                  aria-label={`Delete ${slot.duty_type?.name ?? 'duty'} slot`}
                                  title="Delete slot"
                                  className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[6px] transition"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {pendingDelete?.kind === 'slot' && pendingDelete.id === slot.id && (
                              <InlineConfirm
                                message={slot.assigned_count > 0
                                  ? `Delete this slot? ${slot.assigned_count} volunteer sign-up${slot.assigned_count === 1 ? '' : 's'} will be removed.`
                                  : 'Delete this slot?'}
                                confirmLabel="Delete slot"
                                busy={deleting}
                                onConfirm={confirmDelete}
                                onCancel={() => setPendingDelete(null)}
                              />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
