import { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, User, FileText, X, Check } from 'lucide-react'
import { useInterviews } from '../hooks/useInterviews'
import { ActionError } from '../components/ActionError'
import InlineConfirm from '../components/InlineConfirm'
import { supabase } from '../lib/supabase'

interface Application {
  id: string
  first_name: string
  last_name: string
  email: string
  status: string
  interview_confirmed: boolean
}

const inputCls = 'w-full h-10 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand'
const textareaCls = 'w-full px-3 py-2 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none'
const cancelCls = 'h-9 px-4 font-sans text-sm font-semibold text-ink bg-surface border border-border-strong rounded-[8px] hover:bg-surface-sunken transition'
const saveCls = 'h-9 px-4 font-sans text-sm font-semibold bg-brand text-brand-on rounded-[8px] hover:bg-brand-hover transition disabled:opacity-50 flex items-center gap-1.5'

// Local calendar date (YYYY-MM-DD) of a timestamp — slots are grouped by the admin's day, not UTC's.
function localDateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Inline panel under a free slot: pick an applicant and book.
function BookPanel({
  bookedAppIds,
  onBook,
  onCancel,
}: {
  bookedAppIds: Set<string>
  onBook: (applicationId: string, notes: string) => Promise<void>
  onCancel: () => void
}) {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('volunteer_applications')
      .select('id, first_name, last_name, email, status, interview_confirmed')
      .in('status', ['pending', 'accepted'])
      .order('last_name')
      // A booking row is what makes someone "booked" (interview_confirmed is only the applicant's
      // own "I signed up" checkbox from the apply form).
      .then(({ data }) => { if (!cancelled) setApps(data ?? []) })
    return () => { cancelled = true }
  }, [])
  const unbooked = apps?.filter(a => !bookedAppIds.has(a.id)) ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) { setErr('Choose an applicant'); return }
    setSaving(true)
    setErr(null)
    try {
      await onBook(selectedId, notes)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      className="px-4 py-4 bg-surface-sunken border-t border-border space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="book-applicant" className="block font-sans text-sm font-semibold text-ink mb-1.5">Applicant</label>
          <select id="book-applicant" autoFocus value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
            <option value="">{unbooked === null ? 'Loading…' : 'Select applicant…'}</option>
            {(unbooked ?? []).map(a => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name} — {a.email}</option>
            ))}
          </select>
          {unbooked?.length === 0 && (
            <p className="mt-1 font-sans text-xs text-ink-muted">Every applicant already has an interview booked.</p>
          )}
        </div>
        <div>
          <label htmlFor="book-notes" className="block font-sans text-sm font-semibold text-ink mb-1.5">Notes <span className="font-normal text-ink-muted">(optional)</span></label>
          <input id="book-notes" value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Pre-interview notes…" />
        </div>
      </div>
      {err && <p role="alert" className="text-danger text-sm font-sans">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={cancelCls}>Cancel</button>
        <button type="submit" disabled={saving} className={saveCls}>
          <Check size={14} /> {saving ? 'Booking…' : 'Book slot'}
        </button>
      </div>
    </form>
  )
}

// Inline notes editor under a booked slot.
function NotesPanel({
  initialNotes,
  onSave,
  onCancel,
}: {
  initialNotes: string
  onSave: (notes: string) => Promise<void>
  onCancel: () => void
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      await onSave(notes)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSave}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      className="px-4 py-4 bg-surface-sunken border-t border-border space-y-3"
    >
      <label htmlFor="interview-notes" className="block font-sans text-sm font-semibold text-ink">Interview notes</label>
      <textarea id="interview-notes" autoFocus value={notes} onChange={e => setNotes(e.target.value)}
        rows={4} className={textareaCls} placeholder="How did it go? Strengths, concerns, recommended experience level…" />
      {err && <p role="alert" className="text-danger text-sm font-sans">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={cancelCls}>Cancel</button>
        <button type="submit" disabled={saving} className={saveCls}>
          <Check size={14} /> {saving ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </form>
  )
}

type Panel =
  | { kind: 'book'; slotId: string }
  | { kind: 'notes'; slotId: string }
  | { kind: 'unbook'; slotId: string }
  | { kind: 'delete'; slotId: string }
  | null

export default function AdminInterviews() {
  const { slots, loading, createSlot, deleteSlot, bookSlot, unbookSlot, updateNotes } = useInterviews()

  const [slotForm, setSlotForm] = useState({ date: '', time: '', duration: '15' })
  const [addingSlot, setAddingSlot] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!slotForm.date || !slotForm.time) { setErr('Pick a date and time'); return }
    setAddingSlot(true)
    setErr(null)
    try {
      await createSlot({
        // Interpret the picked date/time in the admin's timezone, then store it as an instant.
        slot_datetime: new Date(`${slotForm.date}T${slotForm.time}`).toISOString(),
        duration_minutes: Number(slotForm.duration) || 15,
      })
      setSlotForm(f => ({ ...f, time: '' }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setAddingSlot(false)
    }
  }

  async function run(action: () => Promise<void>, failMsg: string) {
    setBusy(true)
    setActionError(null)
    try {
      await action()
      setPanel(null)
    } catch (e) {
      setActionError(`${failMsg}: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  const grouped = slots.reduce<Record<string, typeof slots>>((acc, s) => {
    const date = localDateKey(s.slot_datetime)
    acc[date] = acc[date] ?? []
    acc[date].push(s)
    return acc
  }, {})

  const booked = slots.filter(s => s.booking)
  const bookedAppIds = new Set(booked.map(s => s.booking!.application_id))
  const available = slots.filter(s => !s.booking)
  const iconBtn = 'p-1.5 rounded-[6px] transition'

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-sans font-bold text-2xl text-ink mb-1">Interviews</h1>
        <p className="font-sans text-sm text-ink-muted">Open interview slots, book applicants into them, and keep notes.</p>
      </div>

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Total slots', value: slots.length },
          { label: 'Booked', value: booked.length },
          { label: 'Available', value: available.length },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-[14px] p-4">
            <p className="font-sans text-xs text-ink-muted uppercase tracking-wide mb-1">{s.label}</p>
            <p className="font-sans font-bold text-3xl text-ink tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-[14px] p-4 sm:p-5 space-y-3">
        <p className="font-sans font-semibold text-sm text-ink">Add interview slot</p>
        <form onSubmit={handleAddSlot} className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="slot-date" className="font-sans text-xs text-ink-muted">Date</label>
            <input id="slot-date" type="date" value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} className={`${inputCls} w-auto`} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="slot-time" className="font-sans text-xs text-ink-muted">Time</label>
            <input id="slot-time" type="time" value={slotForm.time} onChange={e => setSlotForm(f => ({ ...f, time: e.target.value }))} className={`${inputCls} w-auto`} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="slot-duration" className="font-sans text-xs text-ink-muted">Minutes</label>
            <input id="slot-duration" type="number" min={5} max={120} value={slotForm.duration} onChange={e => setSlotForm(f => ({ ...f, duration: e.target.value }))} className={`${inputCls} w-24`} />
          </div>
          <button type="submit" disabled={addingSlot}
            className="h-10 px-4 bg-brand text-brand-on font-sans font-semibold text-sm rounded-[8px] flex items-center gap-2 hover:bg-brand-hover transition disabled:opacity-50">
            {addingSlot ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Plus size={15} />}
            Add slot
          </button>
        </form>
        {err && <p role="alert" className="text-danger text-sm font-sans">{err}</p>}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-surface border border-border rounded-[14px] animate-pulse" />)}
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
          <Calendar size={24} className="text-ink-muted mx-auto mb-3" />
          <p className="font-sans font-semibold text-ink mb-1">No interview slots yet</p>
          <p className="font-sans text-sm text-ink-muted">Add a few times above, then book applicants into them.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, daySlots]) => (
              <div key={date}>
                <h2 className="font-sans font-semibold text-sm text-ink-muted mb-2">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                <div className="bg-surface border border-border rounded-[14px] overflow-hidden divide-y divide-border">
                  {daySlots.map(slot => {
                    const time = new Date(slot.slot_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    const applicantName = slot.booking?.application
                      ? `${slot.booking.application.first_name} ${slot.booking.application.last_name}`
                      : null
                    const open = panel?.slotId === slot.id ? panel.kind : null
                    return (
                      <div key={slot.id}>
                        <div className="flex items-center gap-3 sm:gap-4 px-4 py-3.5">
                          <div className="w-16 sm:w-20 shrink-0">
                            <p className="font-sans font-semibold text-sm text-ink">{time}</p>
                            <p className="font-sans text-xs text-ink-muted">{slot.duration_minutes} min</p>
                          </div>

                          <div className="flex-1 min-w-0">
                            {slot.booking ? (
                              <div>
                                <div className="flex items-center gap-2 min-w-0">
                                  <User size={13} className="text-ink-muted shrink-0" />
                                  <p className="font-sans font-semibold text-sm text-ink truncate">{applicantName}</p>
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-success-soft text-success shrink-0">Booked</span>
                                </div>
                                {slot.booking.admin_notes && open !== 'notes' && (
                                  <p className="font-sans text-xs text-ink-muted mt-0.5 ml-[21px] truncate">{slot.booking.admin_notes}</p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-warning-soft text-warning">Available</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {slot.booking ? (
                              <>
                                <button
                                  onClick={() => setPanel(open === 'notes' ? null : { kind: 'notes', slotId: slot.id })}
                                  aria-expanded={open === 'notes'}
                                  aria-label={`Notes for ${applicantName}`}
                                  title="Interview notes"
                                  className={`${iconBtn} ${open === 'notes' ? 'text-ink bg-brand-soft' : 'text-ink-muted hover:text-ink hover:bg-brand-soft'}`}
                                >
                                  <FileText size={14} />
                                </button>
                                <button
                                  onClick={() => setPanel({ kind: 'unbook', slotId: slot.id })}
                                  aria-label={`Cancel ${applicantName}'s booking`}
                                  title="Cancel booking"
                                  className={`${iconBtn} text-ink-muted hover:text-danger hover:bg-danger-soft`}
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setPanel(open === 'book' ? null : { kind: 'book', slotId: slot.id })}
                                aria-expanded={open === 'book'}
                                className="h-8 px-3 text-xs font-semibold font-sans bg-brand text-brand-on rounded-[8px] hover:bg-brand-hover transition flex items-center gap-1.5"
                              >
                                <Check size={12} /> Book
                              </button>
                            )}
                            <button
                              onClick={() => setPanel({ kind: 'delete', slotId: slot.id })}
                              aria-label={`Delete ${time} slot`}
                              title="Delete slot"
                              className={`${iconBtn} text-ink-muted hover:text-danger hover:bg-danger-soft`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {open === 'book' && (
                          <BookPanel
                            bookedAppIds={bookedAppIds}
                            onCancel={() => setPanel(null)}
                            onBook={async (appId, notes) => { await bookSlot(slot.id, appId, notes); setPanel(null) }}
                          />
                        )}
                        {open === 'notes' && slot.booking && (
                          <NotesPanel
                            initialNotes={slot.booking.admin_notes ?? ''}
                            onCancel={() => setPanel(null)}
                            onSave={async notes => { await updateNotes(slot.booking!.id, notes); setPanel(null) }}
                          />
                        )}
                        {open === 'unbook' && slot.booking && (
                          <InlineConfirm
                            message={`Cancel ${applicantName}'s interview? The slot opens up again${slot.booking.admin_notes ? ' and the notes on this booking are deleted' : ''}.`}
                            confirmLabel="Cancel booking"
                            cancelLabel="Keep booking"
                            busy={busy}
                            onConfirm={() => run(() => unbookSlot(slot.booking!.id), "Couldn't cancel the booking")}
                            onCancel={() => setPanel(null)}
                          />
                        )}
                        {open === 'delete' && (
                          <InlineConfirm
                            message={slot.booking
                              ? `Delete this slot? ${applicantName}'s booking and its notes are deleted too. This can't be undone.`
                              : "Delete this slot? This can't be undone."}
                            confirmLabel="Delete slot"
                            busy={busy}
                            onConfirm={() => run(() => deleteSlot(slot.id), "Couldn't delete the slot")}
                            onCancel={() => setPanel(null)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
