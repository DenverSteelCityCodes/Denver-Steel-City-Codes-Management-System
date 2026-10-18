import { Fragment, useState } from 'react'
import { ChevronDown, Plus, UserPlus } from 'lucide-react'
import { useDutyTypes, useDutySlots, type DutySlot } from '../hooks/useDutyRoles'
import { useSessions, campSessions, formatSessionDates } from '../hooks/useSessions'
import { sessionDays, parseLocalDate } from '../lib/campDay'
import InlineConfirm from '../components/InlineConfirm'
import Button from '../components/Button'
import { Input, Select } from '../components/Field'
import Segmented from '../components/Segmented'
import { AdminPageHead, VolunteersTabs, pageClass, h2Class } from '../components/AdminTabs'

type PendingDelete = { kind: 'slot'; id: string } | { kind: 'type'; id: string } | null

const label = 'block font-bold mb-1.5'
const dayHead = (iso: string) => parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
const dayLong = (iso: string) => parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const openOf = (s: DutySlot) => Math.max(s.capacity - s.assigned_count, 0)

export default function AdminDuties() {
  const { sessions } = useSessions()
  const weeks = campSessions(sessions)
  const { types, error: typesError, createType, deleteType, refetch: refetchTypes } = useDutyTypes()
  const [pickedWeek, setPickedWeek] = useState<string>('')
  // Every slot loads once and is placed by its date, so a slot whose session link is missing (or
  // points at another week) still shows under the week it falls in.
  const { slots, loading, error: slotsError, createSlot, deleteSlot, refetch } = useDutySlots(undefined)

  const selectedSession = weeks.some(w => w.id === pickedWeek) ? pickedWeek : (weeks[0]?.id ?? '')
  const week = weeks.find(w => w.id === selectedSession) ?? null
  const days = week ? sessionDays(week) : []

  const [newTypeName, setNewTypeName] = useState('')
  const [addingType, setAddingType] = useState(false)
  const [typeErr, setTypeErr] = useState<string | null>(null)

  const [slotForm, setSlotForm] = useState({ duty_type_id: '', slot_date: '', capacity: '2' })
  const [addingSlot, setAddingSlot] = useState(false)
  const [slotErr, setSlotErr] = useState<string | null>(null)
  const [slotNote, setSlotNote] = useState<string | null>(null)

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
    // cleaned up with it) regardless of which week is showing.
    const session = sessions.find(s => slotForm.slot_date >= s.start_date && slotForm.slot_date <= s.end_date)
    const sessionId = session?.id ?? (selectedSession || null)
    setAddingSlot(true)
    setSlotErr(null)
    setSlotNote(null)
    try {
      await createSlot({
        duty_type_id: slotForm.duty_type_id,
        session_id: sessionId,
        slot_date: slotForm.slot_date,
        capacity: Number(slotForm.capacity) || 2,
      })
      setSlotForm(f => ({ ...f, slot_date: '' }))
      // A slot in another week than the one showing would save out of sight, inviting a
      // duplicate: switch to the week it landed in and say so.
      if (session && weeks.some(w => w.id === session.id) && session.id !== selectedSession) {
        setPickedWeek(session.id)
        setSlotNote(`Added to ${session.name}. Now showing it.`)
      } else if (!session || !weeks.some(w => w.id === session.id)) {
        setSlotNote('Added. That date is outside the camp weeks, so it is listed under Other dates.')
      }
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

  const inWeek = (w: { start_date: string; end_date: string }) =>
    slots.filter(s => s.slot_date >= w.start_date && s.slot_date <= w.end_date)
  const weekSlots = week ? inWeek(week) : []
  const openIn = (list: DutySlot[]) => list.reduce((n, s) => n + openOf(s), 0)
  const otherSlots = slots.filter(s => !weeks.some(w => s.slot_date >= w.start_date && s.slot_date <= w.end_date))
  const cellSlots = (typeId: string, day: string) => weekSlots.filter(s => s.duty_type_id === typeId && s.slot_date === day)
  // Duties with slots this week but no type row any more (shouldn't happen; deleting a type
  // deletes its slots) would vanish from the grid, so list them too.
  const rowTypes = [...types, ...[...new Set(weekSlots.map(s => s.duty_type_id))]
    .filter(id => !types.some(t => t.id === id))
    .map(id => ({ id, name: weekSlots.find(s => s.duty_type_id === id)?.duty_type?.name ?? 'Duty', description: null as string | null }))]
  const pendingSlot = pendingDelete?.kind === 'slot' ? slots.find(s => s.id === pendingDelete.id) ?? null : null

  const slotConfirm = (slot: DutySlot) => (
    <InlineConfirm
      frame
      message={`Delete ${slot.duty_type?.name ?? 'this duty'} on ${dayLong(slot.slot_date)}?${slot.assigned_count > 0
        ? ` ${slot.assigned_count} volunteer sign-up${slot.assigned_count === 1 ? '' : 's'} will be removed.` : ''}`}
      confirmLabel="Delete slot"
      cancelLabel="Keep it"
      busy={deleting}
      onConfirm={confirmDelete}
      onCancel={() => setPendingDelete(null)}
    />
  )

  const linkBtn = 'min-h-11 md:min-h-9 text-sm font-bold underline underline-offset-[3px] cursor-pointer'

  return (
    <div className={pageClass}>
      <AdminPageHead title="Volunteers" />
      <VolunteersTabs current="duties" />

      {weeks.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmented
            label="Week"
            value={selectedSession}
            onChange={id => { setPickedWeek(id); setSlotNote(null); setPendingDelete(null) }}
            options={weeks.map(w => ({
              value: w.id,
              label: <>{w.name}<span className="max-sm:hidden font-semibold"> · {formatSessionDates(w, false)}</span></>,
            }))}
          />
          {!loading && !slotsError && (
            <span className="text-sm text-ink-muted">
              {weeks.map(w => { const n = openIn(inWeek(w)); return `${n === 0 ? 'No' : n} open spot${n === 1 ? '' : 's'} in ${w.name}` }).join(' · ')}
            </span>
          )}
        </div>
      )}

      {actionError && <p role="alert" className="mb-4 text-sm font-bold text-danger text-pretty">{actionError}</p>}

      {slotsError ? (
        <div role="alert" className="py-4 border-y-2 border-ink flex flex-wrap items-center gap-x-4 gap-y-2">
          <p title={slotsError} className="flex-1 min-w-[min(100%,16rem)] font-bold text-danger">Couldn't load the duty slots. Check your connection, then try again.</p>
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      ) : loading ? (
        <div aria-busy="true" aria-label="Loading duties" className="border-y-2 border-ink">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 my-1 rounded bg-surface-sunken animate-pulse" />)}
        </div>
      ) : !week ? (
        <p className="py-4 border-y-2 border-ink">
          <b className="font-bold">No camp weeks yet.</b> <span className="text-ink-muted">Add the weeks in Setup › Season, then their duties here.</span>
        </p>
      ) : rowTypes.length === 0 ? (
        <p className="py-4 border-y-2 border-ink">
          <b className="font-bold">No duties yet.</b> <span className="text-ink-muted">Add a duty type below, then its slots.</span>
        </p>
      ) : (
        <div role="region" aria-label={`Duties, ${week.name}. Scrolls sideways on a small screen.`} tabIndex={0}
          className="overflow-x-auto focus-visible:outline-offset-2">
          <table className="w-full min-w-[760px] table-fixed bg-surface border-y-2 border-ink">
            <caption className="sr-only">Duties, {week.name}, {formatSessionDates(week, false)}</caption>
            <colgroup><col className="w-[11rem]" />{days.map(d => <col key={d} />)}</colgroup>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-[1] bg-surface px-3 py-2.5 text-left text-sm font-bold text-ink-muted border-b border-ink">Duty</th>
                {days.map(d => (
                  <th key={d} scope="col" className="px-3 py-2.5 text-left text-sm font-bold text-ink-muted border-b border-ink whitespace-nowrap">
                    <span aria-hidden="true">{dayHead(d)}</span><span className="sr-only">{dayLong(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowTypes.map(t => {
                const rowPending = pendingSlot && pendingSlot.duty_type_id === t.id && days.includes(pendingSlot.slot_date) ? pendingSlot : null
                return (
                  <Fragment key={t.id}>
                    <tr className="border-t border-border first:border-t-0">
                      <th scope="row" className="sticky left-0 z-[1] bg-surface px-3 py-3 text-left align-top font-bold">
                        {t.name}
                        {t.description && <span className="block text-sm font-normal text-ink-muted text-pretty">{t.description}</span>}
                      </th>
                      {days.map(d => {
                        const list = cellSlots(t.id, d)
                        return (
                          <td key={d} className="px-3 py-3 align-top">
                            {list.length === 0 ? (
                              <span className="text-ink-muted" aria-label="No slot">–</span>
                            ) : list.map(slot => {
                              const names = (slot.assignments ?? []).map(a => a.volunteer?.profiles?.display_name ?? 'A volunteer')
                              const gap = openOf(slot)
                              return (
                                <div key={slot.id} className="[&+&]:mt-3 [&+&]:pt-3 [&+&]:border-t [&+&]:border-border">
                                  {names.length > 0 && (
                                    <ul className="leading-[1.4]">
                                      {names.map((n, i) => <li key={i} className="[overflow-wrap:anywhere]">{n}</li>)}
                                    </ul>
                                  )}
                                  {gap > 0 && (
                                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-extrabold">
                                      <UserPlus size={16} strokeWidth={2.5} aria-hidden="true" /> {gap} open
                                    </p>
                                  )}
                                  <div>
                                    <button type="button" className={`${linkBtn} text-ink-muted`}
                                      aria-expanded={pendingDelete?.kind === 'slot' && pendingDelete.id === slot.id}
                                      onClick={() => setPendingDelete({ kind: 'slot', id: slot.id })}>
                                      Delete<span className="sr-only"> {t.name} on {dayLong(d)}</span>
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </td>
                        )
                      })}
                    </tr>
                    {rowPending && (
                      <tr>
                        <td colSpan={days.length + 1} className="px-3 pb-4">
                          <div className="sticky left-3 max-w-[min(640px,calc(100vw-4rem))]">{slotConfirm(rowPending)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-ink-muted">Accepted volunteers sign up for these from their Duties tab.</p>

      {otherSlots.length > 0 && (
        <details className="group mt-6">
          <summary className="inline-flex items-center gap-1.5 min-h-11 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Other dates ({otherSlots.length})
            <ChevronDown size={18} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 border-y-2 border-ink">
            {otherSlots.map(slot => (
              <li key={slot.id} className="py-3 border-t border-border first:border-t-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p className="flex-1 min-w-[min(100%,16rem)]">
                    <b className="font-bold">{slot.duty_type?.name ?? 'Duty'}</b> · {dayLong(slot.slot_date)} {parseLocalDate(slot.slot_date).getFullYear()}
                    <span className="block text-sm text-ink-muted">{slot.assigned_count} of {slot.capacity} signed up</span>
                  </p>
                  <button type="button" className={`${linkBtn} text-ink-muted`}
                    aria-expanded={pendingDelete?.kind === 'slot' && pendingDelete.id === slot.id}
                    onClick={() => setPendingDelete({ kind: 'slot', id: slot.id })}>
                    Delete<span className="sr-only"> {slot.duty_type?.name} on {dayLong(slot.slot_date)}</span>
                  </button>
                </div>
                {pendingDelete?.kind === 'slot' && pendingDelete.id === slot.id && <div className="mt-2">{slotConfirm(slot)}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section aria-labelledby="add-slot-heading" className="mt-10">
        <h2 id="add-slot-heading" className={h2Class}>Add a duty slot</h2>
        <form onSubmit={handleAddSlot} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-[1_1_14rem] min-w-0 max-w-[20rem]">
            <label htmlFor="slot-duty" className={label}>Duty</label>
            <Select id="slot-duty" value={slotForm.duty_type_id}
              onChange={e => setSlotForm(f => ({ ...f, duty_type_id: e.target.value }))}>
              <option value="">Choose…</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="slot-day" className={label}>Date</label>
            <Input id="slot-day" type="date" value={slotForm.slot_date} className="w-auto"
              onChange={e => setSlotForm(f => ({ ...f, slot_date: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="slot-capacity" className={label}>Volunteers</label>
            <Input id="slot-capacity" type="number" inputMode="numeric" min={1} max={10} value={slotForm.capacity} className="w-[6.5rem]"
              onChange={e => setSlotForm(f => ({ ...f, capacity: e.target.value }))} />
          </div>
          <Button type="submit" variant="primary" disabled={addingSlot}>
            {addingSlot
              ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : <Plus size={18} strokeWidth={2.5} aria-hidden="true" />}
            Add slot
          </Button>
        </form>
        {slotErr && <p role="alert" className="mt-2 text-sm font-bold text-danger">{slotErr}</p>}
        {slotNote && <p role="status" className="mt-2 text-sm text-ink-muted">{slotNote}</p>}

        <details className="group mt-6">
          <summary className="inline-flex items-center gap-1.5 min-h-11 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Duty types ({types.length})
            <ChevronDown size={18} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 border-y-2 border-ink max-w-[640px]">
            {types.map(t => (
              <li key={t.id} className="border-t border-border first:border-t-0">
                <div className="flex items-center gap-4 min-h-12 py-1">
                  <span className="flex-1 min-w-0">{t.name}</span>
                  <button type="button" className={`${linkBtn} text-ink-muted`}
                    aria-expanded={pendingDelete?.kind === 'type' && pendingDelete.id === t.id}
                    onClick={() => setPendingDelete({ kind: 'type', id: t.id })}>
                    Remove<span className="sr-only"> {t.name}</span>
                  </button>
                </div>
                {pendingDelete?.kind === 'type' && pendingDelete.id === t.id && (
                  <div className="pb-3">
                    <InlineConfirm
                      frame
                      message={`Delete "${t.name}"? Every slot of this duty and its sign-ups go too.`}
                      confirmLabel="Delete duty"
                      cancelLabel="Keep it"
                      busy={deleting}
                      onConfirm={confirmDelete}
                      onCancel={() => setPendingDelete(null)}
                    />
                  </div>
                )}
              </li>
            ))}
            {typesError ? (
              <li role="alert" className="py-3 border-t border-border first:border-t-0 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span title={typesError} className="flex-1 font-bold text-danger">Couldn't load the duty types.</span>
                <Button onClick={() => void refetchTypes()}>Try again</Button>
              </li>
            ) : types.length === 0 && <li className="py-3 text-ink-muted">No duty types yet.</li>}
          </ul>
          <form onSubmit={handleAddType} className="mt-3 flex flex-wrap items-end gap-3 max-w-[640px]">
            <div className="flex-1 min-w-[min(100%,14rem)]">
              <label htmlFor="new-duty-type" className={label}>New duty type</label>
              <Input id="new-duty-type" type="text" placeholder="For example, Water refill" value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)} />
            </div>
            <Button type="submit" disabled={addingType}>{addingType ? 'Adding…' : 'Add duty type'}</Button>
          </form>
          {typeErr && <p role="alert" className="mt-2 text-sm font-bold text-danger">{typeErr}</p>}
        </details>
      </section>
    </div>
  )
}
