import { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, User, FileText, X, Check } from 'lucide-react'
import { useInterviews } from '../hooks/useInterviews'
import { useConfirm } from '../hooks/useConfirm'
import { ActionError } from '../components/ActionError'
import { supabase } from '../lib/supabase'

interface Application {
  id: string
  first_name: string
  last_name: string
  email: string
  status: string
  interview_confirmed: boolean
}

function BookModal({
  onBook,
  onClose,
}: {
  onBook: (applicationId: string, notes: string) => Promise<void>
  onClose: () => void
}) {
  const [apps, setApps] = useState<Application[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('volunteer_applications')
      .select('id, first_name, last_name, email, status, interview_confirmed')
      .in('status', ['pending', 'accepted'])
      .eq('interview_confirmed', false)
      .order('last_name')
      .then(({ data }) => setApps(data ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setSaving(true)
    setErr(null)
    try {
      await onBook(selectedId, notes)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full h-10 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-sans font-bold text-base text-ink">Book applicant</h2>
          <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink rounded transition">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block font-sans text-sm font-semibold text-ink mb-1.5">Applicant</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={input} required>
              <option value="">Select applicant…</option>
              {apps.map(a => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name} — {a.email}
                </option>
              ))}
            </select>
            {apps.length === 0 && (
              <p className="mt-1 font-sans text-xs text-ink-muted">No unbooked applicants found.</p>
            )}
          </div>
          <div>
            <label className="block font-sans text-sm font-semibold text-ink mb-1.5">Notes (optional)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              placeholder="Pre-interview notes…"
            />
          </div>
          {err && <p className="text-danger text-xs font-sans">⚠ {err}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="h-9 px-4 font-sans text-sm font-semibold text-ink-muted bg-surface border border-border-strong rounded-[8px] hover:bg-surface-sunken transition">
              Cancel
            </button>
            <button type="submit" disabled={saving || !selectedId} className="h-9 px-4 font-sans text-sm font-semibold bg-brand text-brand-on rounded-[8px] hover:bg-brand-hover transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Book slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NotesModal({
  bookingId,
  initialNotes,
  applicantName,
  onSave,
  onClose,
}: {
  bookingId: string
  initialNotes: string
  applicantName: string
  onSave: (bookingId: string, notes: string) => Promise<void>
  onClose: () => void
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try { await onSave(bookingId, notes); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-sans font-bold text-base text-ink">Interview notes</h2>
            <p className="font-sans text-xs text-ink-muted mt-0.5">{applicantName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink rounded transition">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            placeholder="Interview notes…"
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="h-9 px-4 font-sans text-sm font-semibold text-ink-muted bg-surface border border-border-strong rounded-[8px] hover:bg-surface-sunken transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="h-9 px-4 font-sans text-sm font-semibold bg-brand text-brand-on rounded-[8px] hover:bg-brand-hover transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminInterviews() {
  const { slots, loading, createSlot, deleteSlot, bookSlot, unbookSlot, updateNotes } = useInterviews()

  const [slotForm, setSlotForm] = useState({ date: '', time: '', duration: '15' })
  const [addingSlot, setAddingSlot] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null)
  const [notesTarget, setNotesTarget] = useState<{ bookingId: string; notes: string; name: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [unbookingId, setUnbookingId] = useState<string | null>(null)

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!slotForm.date || !slotForm.time) return
    setAddingSlot(true)
    setErr(null)
    try {
      await createSlot({
        slot_datetime: `${slotForm.date}T${slotForm.time}:00`,
        duration_minutes: Number(slotForm.duration) || 15,
      })
      setSlotForm(f => ({ ...f, date: '', time: '' }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingSlot(false)
    }
  }

  const [actionError, setActionError] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()

  async function handleDelete(slot: (typeof slots)[number]) {
    const ok = await confirm({
      title: 'Delete this interview slot?',
      body: slot.booking
        ? 'It is booked — the booking and its interview notes are deleted too. This cannot be undone.'
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

  async function handleUnbook(bookingId: string, applicationId: string) {
    setUnbookingId(bookingId)
    setActionError(null)
    try { await unbookSlot(bookingId, applicationId) }
    catch (e) { setActionError(`Couldn't cancel the booking: ${e instanceof Error ? e.message : 'unknown error'}`) }
    finally { setUnbookingId(null) }
  }

  const grouped = slots.reduce<Record<string, typeof slots>>((acc, s) => {
    const date = s.slot_datetime.split('T')[0]
    acc[date] = acc[date] ?? []
    acc[date].push(s)
    return acc
  }, {})

  const booked = slots.filter(s => s.booking)
  const available = slots.filter(s => !s.booking)

  const input = 'h-10 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand'

  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-[1000px] mx-auto px-6 py-8 space-y-8">
        {dialog}
        <ActionError message={actionError} onDismiss={() => setActionError(null)} />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
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

        {/* Add slot form */}
        <div className="bg-surface border border-border rounded-[14px] p-5 space-y-3">
          <p className="font-sans font-semibold text-sm text-ink">Add interview slot</p>
          <form onSubmit={handleAddSlot} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="font-sans text-xs text-ink-muted">Date</label>
              <input type="date" value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-xs text-ink-muted">Time</label>
              <input type="time" value={slotForm.time} onChange={e => setSlotForm(f => ({ ...f, time: e.target.value }))} className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-xs text-ink-muted">Duration (min)</label>
              <input type="number" min={5} max={120} value={slotForm.duration} onChange={e => setSlotForm(f => ({ ...f, duration: e.target.value }))} className={`${input} w-24`} />
            </div>
            <button type="submit" disabled={addingSlot || !slotForm.date || !slotForm.time}
              className="h-10 px-4 bg-brand text-brand-on font-sans font-semibold text-sm rounded-[8px] flex items-center gap-2 hover:bg-brand-hover transition disabled:opacity-50">
              {addingSlot ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Plus size={15} />}
              Add slot
            </button>
          </form>
          {err && <p className="text-danger text-xs font-sans">⚠ {err}</p>}
        </div>

        {/* Slots list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-surface border border-border rounded-[14px] animate-pulse" />)}
          </div>
        ) : slots.length === 0 ? (
          <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
            <Calendar size={24} className="text-ink-muted mx-auto mb-3" />
            <p className="font-sans text-sm text-ink-muted">No interview slots yet.</p>
            <p className="font-sans text-xs text-ink-faint mt-1">Requires <code>migration_interviews.sql</code> to be applied first.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, daySlots]) => (
                <div key={date}>
                  <p className="font-sans font-semibold text-sm text-ink-muted mb-2">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
                    {daySlots.map((slot, idx) => {
                      const time = new Date(slot.slot_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      const applicantName = slot.booking?.application
                        ? `${slot.booking.application.first_name} ${slot.booking.application.last_name}`
                        : null
                      return (
                        <div key={slot.id} className={`flex items-center gap-4 px-4 py-3.5 ${idx < daySlots.length - 1 ? 'border-b border-border' : ''}`}>
                          <div className="w-20 shrink-0">
                            <p className="font-sans font-semibold text-sm text-ink">{time}</p>
                            <p className="font-sans text-xs text-ink-muted">{slot.duration_minutes} min</p>
                          </div>

                          <div className="flex-1 min-w-0">
                            {slot.booking ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <User size={13} className="text-ink-muted shrink-0" />
                                  <p className="font-sans font-semibold text-sm text-ink truncate">{applicantName}</p>
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-success-soft text-success shrink-0">Booked</span>
                                </div>
                                {slot.booking.admin_notes && (
                                  <p className="font-sans text-xs text-ink-muted mt-0.5 ml-[21px] truncate">{slot.booking.admin_notes}</p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-warning-soft text-warning">Available</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {slot.booking ? (
                              <>
                                <button
                                  onClick={() => setNotesTarget({ bookingId: slot.booking!.id, notes: slot.booking!.admin_notes ?? '', name: applicantName ?? '' })}
                                  className="p-1.5 text-ink-muted hover:text-brand hover:bg-brand-soft rounded-[6px] transition"
                                  title="Edit notes"
                                >
                                  <FileText size={14} />
                                </button>
                                <button
                                  onClick={() => handleUnbook(slot.booking!.id, slot.booking!.application_id)}
                                  disabled={unbookingId === slot.booking.id}
                                  className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[6px] transition disabled:opacity-40"
                                  title="Unbook"
                                >
                                  {unbookingId === slot.booking.id
                                    ? <span className="w-3.5 h-3.5 rounded-full border-2 border-danger border-t-transparent animate-spin inline-block" />
                                    : <X size={14} />}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setBookingSlotId(slot.id)}
                                className="h-8 px-3 text-xs font-semibold font-sans bg-brand text-brand-on rounded-[8px] hover:bg-brand-hover transition flex items-center gap-1.5"
                              >
                                <Check size={12} /> Book
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(slot)}
                              disabled={deletingId === slot.id}
                              className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[6px] transition disabled:opacity-40"
                              title="Delete slot"
                            >
                              {deletingId === slot.id
                                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-danger border-t-transparent animate-spin inline-block" />
                                : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>

      {bookingSlotId && (
        <BookModal
          onBook={(appId, notes) => bookSlot(bookingSlotId, appId, notes)}
          onClose={() => setBookingSlotId(null)}
        />
      )}

      {notesTarget && (
        <NotesModal
          bookingId={notesTarget.bookingId}
          initialNotes={notesTarget.notes}
          applicantName={notesTarget.name}
          onSave={updateNotes}
          onClose={() => setNotesTarget(null)}
        />
      )}
    </div>
  )
}
