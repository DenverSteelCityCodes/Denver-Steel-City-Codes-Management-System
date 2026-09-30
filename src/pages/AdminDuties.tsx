import { useState } from 'react'
import { Plus, Trash2, Check, CalendarDays } from 'lucide-react'
import { useDutyTypes, useDutySlots } from '../hooks/useDutyRoles'
import { useSessions } from '../hooks/useSessions'
import { useConfirm } from '../hooks/useConfirm'
import { ActionError } from '../components/ActionError'

export default function AdminDuties() {
  const { sessions } = useSessions()
  const { types, createType, deleteType } = useDutyTypes()
  const [selectedSession, setSelectedSession] = useState<string>('')
  const { slots, loading, createSlot, deleteSlot } = useDutySlots(selectedSession || undefined)

  const [newTypeName, setNewTypeName] = useState('')
  const [addingType, setAddingType] = useState(false)

  const [slotForm, setSlotForm] = useState({ duty_type_id: '', slot_date: '', capacity: '2' })
  const [addingSlot, setAddingSlot] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAddType(e: React.FormEvent) {
    e.preventDefault()
    if (!newTypeName.trim()) return
    setAddingType(true)
    try { await createType(newTypeName.trim()) ; setNewTypeName('') }
    catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setAddingType(false) }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!slotForm.duty_type_id || !slotForm.slot_date) return
    setAddingSlot(true)
    setErr(null)
    try {
      await createSlot({
        duty_type_id: slotForm.duty_type_id,
        session_id: selectedSession || null,
        slot_date: slotForm.slot_date,
        capacity: Number(slotForm.capacity) || 2,
      })
      setSlotForm(f => ({ ...f, slot_date: '', duty_type_id: '' }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingSlot(false)
    }
  }

  const [actionError, setActionError] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()

  async function handleDeleteSlot(slot: (typeof slots)[number]) {
    const ok = await confirm({
      title: `Delete ${slot.duty_type?.name ?? 'this duty slot'} on ${slot.slot_date}?`,
      body: slot.assigned_count > 0
        ? `${slot.assigned_count} volunteer sign-up${slot.assigned_count === 1 ? '' : 's'} will be removed. This cannot be undone.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete slot',
    })
    if (!ok) return
    setDeletingId(slot.id)
    setActionError(null)
    try { await deleteSlot(slot.id) }
    catch (e) { setActionError(`Couldn't delete the slot: ${e instanceof Error ? e.message : 'unknown error'}`) }
    finally { setDeletingId(null) }
  }

  async function handleDeleteType(t: (typeof types)[number]) {
    const ok = await confirm({
      title: `Delete the "${t.name}" duty?`,
      body: 'Every slot of this duty and all volunteer sign-ups for it are deleted too. This cannot be undone.',
      confirmLabel: 'Delete duty',
    })
    if (!ok) return
    setActionError(null)
    try { await deleteType(t.id) }
    catch (e) { setActionError(`Couldn't delete ${t.name}: ${e instanceof Error ? e.message : 'unknown error'}`) }
  }

  const grouped = slots.reduce<Record<string, typeof slots>>((acc, s) => {
    const date = s.slot_date
    acc[date] = acc[date] ?? []
    acc[date].push(s)
    return acc
  }, {})

  const input = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'

  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-[1000px] mx-auto px-6 py-8 space-y-8">
        {dialog}
        <ActionError message={actionError} onDismiss={() => setActionError(null)} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Duty types panel */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="font-sans font-bold text-lg text-ink">Duty types</h2>
            <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
              {types.map((t, i) => (
                <div key={t.id} className={`flex items-center justify-between px-4 py-3 ${i < types.length - 1 ? 'border-b border-border' : ''}`}>
                  <span className="font-sans text-sm text-ink">{t.name}</span>
                  <button onClick={() => handleDeleteType(t)} className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[6px] transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {types.length === 0 && <p className="px-4 py-3 text-xs text-ink-muted font-sans">No duty types yet.</p>}
            </div>
            <form onSubmit={handleAddType} className="flex gap-2">
              <input
                type="text" placeholder="New duty type…" value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                className="flex-1 h-9 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button type="submit" disabled={addingType} className="h-9 w-9 bg-brand text-brand-on rounded-[8px] flex items-center justify-center shrink-0 disabled:opacity-50">
                {addingType ? <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Plus size={15} />}
              </button>
            </form>
          </div>

          {/* Schedule panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-sans font-bold text-lg text-ink">Duty slots</h2>
              <select
                value={selectedSession}
                onChange={e => setSelectedSession(e.target.value)}
                className="h-9 pl-2.5 pr-7 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">All sessions</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
              </select>
            </div>

            {/* Add slot form */}
            <form onSubmit={handleAddSlot} className="bg-surface border border-border rounded-[14px] p-4 space-y-3">
              <p className="font-sans font-semibold text-sm text-ink">Add duty slot</p>
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={slotForm.duty_type_id}
                  onChange={e => setSlotForm(f => ({ ...f, duty_type_id: e.target.value }))}
                  className={input}
                >
                  <option value="">Duty type…</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="date" value={slotForm.slot_date}
                  onChange={e => setSlotForm(f => ({ ...f, slot_date: e.target.value }))}
                  className={input} />
                <div className="flex gap-2">
                  <input type="number" min={1} max={10} placeholder="Capacity"
                    value={slotForm.capacity}
                    onChange={e => setSlotForm(f => ({ ...f, capacity: e.target.value }))}
                    className={input} />
                  <button type="submit" disabled={addingSlot}
                    className="h-11 w-11 bg-brand text-brand-on rounded-[10px] flex items-center justify-center shrink-0 disabled:opacity-50">
                    {addingSlot ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Check size={16} />}
                  </button>
                </div>
              </div>
              {err && <p className="text-danger text-xs font-sans">⚠ {err}</p>}
            </form>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface border border-border rounded-[14px] animate-pulse" />)}
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="bg-surface border border-border rounded-[14px] p-10 text-center">
                <CalendarDays size={24} className="text-ink-muted mx-auto mb-2" />
                <p className="font-sans text-sm text-ink-muted">No duty slots yet. Add one above.</p>
                <p className="font-sans text-xs text-ink-faint mt-2">Requires <code>migration_duties.sql</code> to be applied first.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, daySlots]) => (
                    <div key={date}>
                      <p className="font-sans font-semibold text-sm text-ink-muted mb-1.5">
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </p>
                      <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
                        {daySlots.map((slot, idx) => (
                          <div key={slot.id} className={`flex items-center justify-between px-4 py-3 ${idx < daySlots.length - 1 ? 'border-b border-border' : ''}`}>
                            <div>
                              <p className="font-sans font-semibold text-sm text-ink">{slot.duty_type?.name ?? '—'}</p>
                              <p className="font-sans text-xs text-ink-muted">
                                {slot.assigned_count}/{slot.capacity} filled
                                {slot.assignments && slot.assignments.length > 0 && (
                                  <span className="ml-2">
                                    · {slot.assignments.map(a => a.volunteer?.profiles?.display_name ?? '—').join(', ')}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                slot.assigned_count >= slot.capacity ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                              }`}>
                                {slot.assigned_count >= slot.capacity ? 'Full' : 'Open'}
                              </span>
                              <button
                                onClick={() => handleDeleteSlot(slot)}
                                disabled={deletingId === slot.id}
                                className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[6px] transition disabled:opacity-40"
                              >
                                {deletingId === slot.id
                                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-danger border-t-transparent animate-spin inline-block" />
                                  : <Trash2 size={14} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
