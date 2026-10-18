import { Fragment, useState, useEffect } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useInterviews, type InterviewSlot } from '../hooks/useInterviews'
import { useVolunteerApplications } from '../hooks/useVolunteerApplications'
import InlineConfirm from '../components/InlineConfirm'
import Button from '../components/Button'
import { Input, Select, Textarea } from '../components/Field'
import { AdminPageHead, VolunteersTabs, pageClass, h2Class } from '../components/AdminTabs'
import { supabase } from '../lib/supabase'
import { campDateKey, campInputToISO, formatCampTime } from '../lib/denverTime'
import type { VolunteerApplication } from '../types/database'

interface Application {
  id: string
  first_name: string
  last_name: string
  email: string
  status: string
  interview_confirmed: boolean
}

const label = 'block font-bold mb-1.5'
const dayLabel = (key: string) =>
  new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const shortDay = (key: string) =>
  new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const weeksText = (w1: boolean, w2: boolean) =>
  w1 && w2 ? 'Weeks 1, 2' : w1 ? 'Week 1' : w2 ? 'Week 2' : 'No weeks picked'

// Inline panel under an open slot: pick any applicant without an interview and book.
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
  const [appsError, setAppsError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
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
      .then(({ data, error }) => {
        if (cancelled) return
        setAppsError(error?.message ?? null)
        setApps(error ? null : data ?? [])
      })
    return () => { cancelled = true }
  }, [reloadKey])
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
    <form onSubmit={handleSubmit} onKeyDown={e => { if (e.key === 'Escape') onCancel() }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="book-applicant" className={label}>Applicant</label>
          <Select id="book-applicant" autoFocus value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">{appsError ? "Couldn't load applicants" : unbooked === null ? 'Loading…' : 'Choose an applicant…'}</option>
            {(unbooked ?? []).map(a => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name} · {a.email}</option>
            ))}
          </Select>
          {appsError ? (
            <p role="alert" className="mt-1.5 text-sm font-bold text-danger">
              Couldn't load applicants.{' '}
              <button type="button" title={appsError} onClick={() => setReloadKey(k => k + 1)} className="min-h-11 underline underline-offset-[3px]">Try again</button>
            </p>
          ) : unbooked?.length === 0 && (
            <p className="mt-1.5 text-sm text-ink-muted">Every applicant already has an interview booked.</p>
          )}
        </div>
        <div>
          <label htmlFor="book-notes" className={label}>Notes <span className="font-normal text-ink-muted">(optional)</span></label>
          <Input id="book-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Before the interview" />
        </div>
      </div>
      {err && <p role="alert" className="text-sm font-bold text-danger">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="ink" disabled={saving}>{saving ? 'Booking…' : 'Book this time'}</Button>
      </div>
    </form>
  )
}

// Inline notes editor under a booked slot.
function NotesPanel({
  name,
  initialNotes,
  onSave,
  onCancel,
}: {
  name: string
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
    <form onSubmit={handleSave} onKeyDown={e => { if (e.key === 'Escape') onCancel() }} className="space-y-3 max-w-[640px]">
      <label htmlFor="interview-notes" className={label}>Interview notes for {name}</label>
      <Textarea id="interview-notes" autoFocus value={notes} onChange={e => setNotes(e.target.value)}
        rows={4} className="resize-y" placeholder="How did it go? Strengths, concerns, the level you'd suggest" />
      {err && <p role="alert" className="text-sm font-bold text-danger">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="ink" disabled={saving}>{saving ? 'Saving…' : 'Save notes'}</Button>
      </div>
    </form>
  )
}

// "Needs a time": one pending applicant with no booking, an open time to pick and Book.
function NeedsTime({
  app,
  openSlots,
  onBook,
}: {
  app: VolunteerApplication
  openSlots: InterviewSlot[]
  onBook: (slotId: string) => Promise<void>
}) {
  const [slotId, setSlotId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const byDay = openSlots.reduce<Record<string, InterviewSlot[]>>((acc, s) => {
    ;(acc[campDateKey(s.slot_datetime)] ??= []).push(s)
    return acc
  }, {})
  // A slot booked in the meantime drops out of the list; don't keep pointing at it.
  const chosen = openSlots.some(s => s.id === slotId) ? slotId : ''

  async function book() {
    if (!chosen) { setErr(`Choose a time for ${app.first_name} first.`); return }
    setSaving(true)
    setErr(null)
    try {
      await onBook(chosen)
    } catch (e) {
      setErr(`Couldn't book ${app.first_name}: ${e instanceof Error ? e.message : 'unknown error'}. Try again.`)
      setSaving(false)
    }
  }

  return (
    <li className="py-4 border-t border-border first:border-t-0">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex-[1_1_18rem] min-w-0 self-center">
          <p className="text-lg font-bold leading-[1.3]">{app.first_name} {app.last_name}</p>
          <p className="text-sm text-ink-muted text-pretty">{app.school} · {app.grade} · {weeksText(app.availability_week_1, app.availability_week_2)}</p>
        </div>
        <div className="flex-[1_1_16rem] md:flex-[0_0_18rem] min-w-0">
          <label htmlFor={`need-${app.id}`} className="block text-sm font-bold mb-1.5">Interview time for {app.first_name}</label>
          <Select id={`need-${app.id}`} value={chosen} onChange={e => { setSlotId(e.target.value); setErr(null) }} disabled={openSlots.length === 0}>
            <option value="">{openSlots.length === 0 ? 'No open times' : 'Choose an open time…'}</option>
            {Object.entries(byDay).map(([day, list]) => (
              <optgroup key={day} label={dayLabel(day)}>
                {list.map(s => <option key={s.id} value={s.id}>{shortDay(day)}, {formatCampTime(s.slot_datetime)}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
        <Button onClick={book} disabled={saving || openSlots.length === 0} className="md:min-w-[9rem]">
          {saving ? 'Booking…' : `Book ${app.first_name}`}
        </Button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm font-bold text-danger text-pretty">{err}</p>}
    </li>
  )
}

type Panel =
  | { kind: 'book'; slotId: string }
  | { kind: 'notes'; slotId: string }
  | { kind: 'unbook'; slotId: string }
  | { kind: 'delete'; slotId: string }
  | null

export default function AdminInterviews() {
  const { slots, loading, error: loadError, createSlot, deleteSlot, bookSlot, unbookSlot, updateNotes, refetch } = useInterviews()
  const { applications, loading: appsLoading } = useVolunteerApplications()

  const [slotForm, setSlotForm] = useState({ date: '', time: '', duration: '15' })
  const [addingSlot, setAddingSlot] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!slotForm.date || !slotForm.time) { setErr('Pick a date and time'); return }
    setAddingSlot(true)
    setErr(null)
    try {
      await createSlot({
        // The picked date and time are Denver time, whatever zone the admin's device is in (#147).
        slot_datetime: campInputToISO(`${slotForm.date}T${slotForm.time}`)!,
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

  const today = campDateKey(new Date(now).toISOString())
  const grouped = slots.reduce<Record<string, InterviewSlot[]>>((acc, s) => {
    ;(acc[campDateKey(s.slot_datetime)] ??= []).push(s)
    return acc
  }, {})
  const days = Object.keys(grouped).sort()
  const upcomingDays = days.filter(d => d >= today)
  const pastDays = days.filter(d => d < today)

  const booked = slots.filter(s => s.booking)
  const bookedAppIds = new Set(booked.map(s => s.booking!.application_id))
  const open = slots.filter(s => !s.booking)
  // Times an applicant can still be booked into: open, and not already over.
  const openAhead = open.filter(s => new Date(s.slot_datetime).getTime() > now)
  const durations = new Set(slots.map(s => s.duration_minutes))
  const oneDuration = durations.size === 1 ? [...durations][0] : null
  const needsTime = applications.filter(a => a.status === 'pending' && !bookedAppIds.has(a.id))
  const pastCount = pastDays.reduce((n, d) => n + grouped[d].filter(s => s.booking).length, 0)

  const th = 'px-3 py-2.5 text-left text-sm font-bold text-ink-muted border-b border-ink whitespace-nowrap'
  const linkBtn = 'min-h-11 md:min-h-9 font-bold underline underline-offset-[3px] cursor-pointer'

  function slotTable(dayKeys: string[], caption: string) {
    return (
      <table className="w-full bg-surface border-y-2 border-ink max-md:block">
        <caption className="sr-only">{caption}</caption>
        <thead className="max-md:sr-only">
          <tr>
            <th scope="col" className={`${th} w-28`}>Time</th>
            <th scope="col" className={th}>Applicant</th>
            <th scope="col" className={th}>Notes</th>
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="max-md:block">
          {dayKeys.map(day => (
            <Fragment key={day}>
              <tr className="max-md:block">
                <th scope="colgroup" colSpan={4} className="px-3 pt-5 pb-2 text-left font-extrabold border-b border-ink max-md:block max-md:px-0 [tr:first-child>&]:pt-3">
                  {dayLabel(day)}
                </th>
              </tr>
              {grouped[day].map(slot => {
                const time = formatCampTime(slot.slot_datetime)
                const name = slot.booking?.application
                  ? `${slot.booking.application.first_name} ${slot.booking.application.last_name}`
                  : slot.booking ? 'An applicant' : null
                const kind = panel?.slotId === slot.id ? panel.kind : null
                const when = `${dayLabel(day)}, ${time}`
                return (
                  <Fragment key={slot.id}>
                    <tr className="border-t border-border [tr:has(>th)+&]:border-t-0 max-md:block max-md:py-2">
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap max-md:inline max-md:p-0">
                        <b className="font-bold">{time}</b>
                        {oneDuration === null && <span className="text-sm text-ink-muted"> · {slot.duration_minutes} min</span>}
                      </td>
                      <td className="px-3 py-2.5 align-middle max-md:inline max-md:p-0 max-md:before:content-['_·_']">
                        {name ? <b className="font-bold">{name}</b> : <span className="text-ink-muted">Open</span>}
                      </td>
                      <td className="px-3 py-2.5 align-middle max-md:block max-md:p-0 max-md:empty:hidden">
                        {slot.booking && kind !== 'notes' && (
                          slot.booking.admin_notes
                            ? <span className="line-clamp-2 text-pretty">{slot.booking.admin_notes}</span>
                            : <span className="text-sm text-ink-muted">No notes yet</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap max-md:block max-md:p-0">
                        <span className="inline-flex flex-wrap gap-x-4">
                          {slot.booking ? (
                            <>
                              <button type="button" className={linkBtn} aria-expanded={kind === 'notes'}
                                onClick={() => setPanel(kind === 'notes' ? null : { kind: 'notes', slotId: slot.id })}>
                                Notes<span className="sr-only"> for {name}</span>
                              </button>
                              <button type="button" className={`${linkBtn} text-ink-muted`} aria-expanded={kind === 'unbook'}
                                onClick={() => setPanel({ kind: 'unbook', slotId: slot.id })}>
                                Unbook<span className="sr-only"> {name}</span>
                              </button>
                            </>
                          ) : (
                            <button type="button" className={linkBtn} aria-expanded={kind === 'book'}
                              onClick={() => setPanel(kind === 'book' ? null : { kind: 'book', slotId: slot.id })}>
                              Book<span className="sr-only"> {when}</span>
                            </button>
                          )}
                          <button type="button" className={`${linkBtn} text-ink-muted`} aria-expanded={kind === 'delete'}
                            onClick={() => setPanel({ kind: 'delete', slotId: slot.id })}>
                            Delete<span className="sr-only"> the {when} slot</span>
                          </button>
                        </span>
                      </td>
                    </tr>
                    {kind && (
                      <tr className="max-md:block">
                        <td colSpan={4} className="px-3 pb-4 pt-1 max-md:block max-md:px-0">
                          {kind === 'book' && (
                            <BookPanel
                              bookedAppIds={bookedAppIds}
                              onCancel={() => setPanel(null)}
                              onBook={async (appId, notes) => { await bookSlot(slot.id, appId, notes); setPanel(null) }}
                            />
                          )}
                          {kind === 'notes' && slot.booking && (
                            <NotesPanel
                              name={name ?? 'this applicant'}
                              initialNotes={slot.booking.admin_notes ?? ''}
                              onCancel={() => setPanel(null)}
                              onSave={async notes => { await updateNotes(slot.booking!.id, notes); setPanel(null) }}
                            />
                          )}
                          {kind === 'unbook' && slot.booking && (
                            <InlineConfirm
                              frame
                              message={`Cancel ${name}'s interview? The slot opens up again${slot.booking.admin_notes ? ' and the notes on this booking are deleted' : ''}.`}
                              confirmLabel="Cancel booking"
                              cancelLabel="Keep booking"
                              busy={busy}
                              onConfirm={() => run(() => unbookSlot(slot.booking!.id), "Couldn't cancel the booking")}
                              onCancel={() => setPanel(null)}
                            />
                          )}
                          {kind === 'delete' && (
                            <InlineConfirm
                              frame
                              message={slot.booking
                                ? `Delete this slot? ${name}'s booking and its notes are deleted too. This can't be undone.`
                                : "Delete this slot? This can't be undone."}
                              confirmLabel="Delete slot"
                              cancelLabel="Keep it"
                              busy={busy}
                              onConfirm={() => run(() => deleteSlot(slot.id), "Couldn't delete the slot")}
                              onCancel={() => setPanel(null)}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className={pageClass}>
      <AdminPageHead title="Volunteers" />
      <VolunteersTabs current="interviews" pending={appsLoading ? undefined : applications.filter(a => a.status === 'pending').length} />

      {!loading && !loadError && (
        <p className="text-ink-muted">
          {booked.length} booked · {open.length} open{oneDuration !== null ? ` · ${oneDuration} minutes each` : ''} · all times Denver
        </p>
      )}

      {actionError && <p role="alert" className="mt-4 text-sm font-bold text-danger text-pretty">{actionError}</p>}

      <section aria-labelledby="need-heading" className="mt-6">
        <h2 id="need-heading" className={h2Class}>Needs a time{appsLoading ? '' : ` (${needsTime.length})`}</h2>
        <p className="mt-1 text-sm text-ink-muted text-pretty">Pending applicants with no interview booked yet.</p>
        {appsLoading || loading ? (
          <div aria-busy="true" aria-label="Loading applicants" className="mt-3 border-y-2 border-ink">
            {[1, 2].map(i => <div key={i} className="h-14 my-2 rounded bg-surface-sunken animate-pulse" />)}
          </div>
        ) : needsTime.length === 0 ? (
          <p className="mt-3 py-4 border-y-2 border-ink font-bold">Every pending applicant has an interview booked.</p>
        ) : (
          <>
            {openAhead.length === 0 && !loadError && (
              <p className="mt-3 font-bold">No open times left. Add a slot below, then book them.</p>
            )}
            <ul className="mt-3 border-y-2 border-ink">
              {needsTime.map(app => (
                <NeedsTime key={app.id} app={app} openSlots={openAhead}
                  onBook={slotId => bookSlot(slotId, app.id, '')} />
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="slots-heading" className="mt-10">
        <h2 id="slots-heading" className={h2Class}>Slots</h2>
        <form onSubmit={handleAddSlot} aria-label="Add an interview slot" className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="slot-date" className={label}>Date</label>
            <Input id="slot-date" type="date" value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} className="w-auto" />
          </div>
          <div>
            <label htmlFor="slot-time" className={label}>Time (Denver)</label>
            <Input id="slot-time" type="time" value={slotForm.time} onChange={e => setSlotForm(f => ({ ...f, time: e.target.value }))} className="w-auto" />
          </div>
          <div>
            <label htmlFor="slot-duration" className={label}>Minutes</label>
            <Input id="slot-duration" type="number" inputMode="numeric" min={5} max={120} value={slotForm.duration} onChange={e => setSlotForm(f => ({ ...f, duration: e.target.value }))} className="w-[6.5rem]" />
          </div>
          <Button type="submit" variant="primary" disabled={addingSlot}>
            {addingSlot
              ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : <Plus size={18} strokeWidth={2.5} aria-hidden="true" />}
            Add slot
          </Button>
        </form>
        {err && <p role="alert" className="mt-2 text-sm font-bold text-danger">{err}</p>}

        {loadError && (
          <div role="alert" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p title={loadError} className="flex-1 min-w-[min(100%,16rem)] font-bold text-danger">Couldn't load the interview slots. Check your connection, then try again.</p>
            <Button onClick={() => void refetch()}>Try again</Button>
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div aria-busy="true" aria-label="Loading slots" className="border-y-2 border-ink">
              {[1, 2, 3].map(i => <div key={i} className="h-12 my-1 rounded bg-surface-sunken animate-pulse" />)}
            </div>
          ) : slots.length === 0 ? (loadError ? null : (
            <p className="py-4 border-y-2 border-ink">
              <b className="font-bold">No interview slots yet.</b> <span className="text-ink-muted">Add a few times above, then book applicants into them.</span>
            </p>
          )) : (
            <>
              {upcomingDays.length > 0
                ? slotTable(upcomingDays, 'Upcoming interview slots')
                : <p className="py-4 border-y-2 border-ink font-bold">No upcoming slots. Add a time above.</p>}
              {pastDays.length > 0 && (
                <details className="group mt-4">
                  <summary className="inline-flex items-center gap-1.5 min-h-11 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    Past days · {shortDay(pastDays[0])}{pastDays.length > 1 ? ` – ${shortDay(pastDays[pastDays.length - 1])}` : ''} · {pastCount} interview{pastCount === 1 ? '' : 's'}
                    <ChevronDown size={18} aria-hidden="true" className="transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2">{slotTable(pastDays, 'Past interview slots')}</div>
                </details>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
