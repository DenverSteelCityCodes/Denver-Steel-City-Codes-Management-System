import { Fragment, useEffect, useRef, useState } from 'react'
import { ChevronDown, Lock, Plus, UserPlus } from 'lucide-react'
import { useDutyTypes, useDutySlots, useDutySettings, useDutyShortfall, type DutySlot, type DutyType } from '../hooks/useDutyRoles'
import type { DutyShortfall } from '../types/database'
import { useSessions, campSessions } from '../hooks/useSessions'
import { shortRange } from '../lib/weekRange'
import { sessionDays, parseLocalDate, localDateISO } from '../lib/campDay'
import { closeAndFocus } from '../lib/focus'
import InlineConfirm from '../components/InlineConfirm'
import Button from '../components/Button'
import { Input, Select } from '../components/Field'
import Segmented from '../components/Segmented'
import AdminPageHead, { pageClass, h2Class } from '../components/AdminPageHead'

type PendingDelete = { kind: 'slot'; id: string } | { kind: 'type'; id: string } | null

const label = 'block font-bold mb-1.5'
const dayHead = (iso: string) => { const d = parseLocalDate(iso); return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}` }
const dayLong = (iso: string) => parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const openOf = (s: DutySlot) => Math.max(s.capacity - s.assigned_count, 0)
const addDays = (iso: string, n: number) => { const d = parseLocalDate(iso); d.setDate(d.getDate() + n); return localDateISO(d) }

export default function AdminDuties() {
  const { sessions } = useSessions()
  const weeks = campSessions(sessions)
  const { types, loading: typesLoading, error: typesError, createType, setTypeMinutes, deleteType, refetch: refetchTypes } = useDutyTypes()
  // The Duty types fold opens by itself when there are none yet or they couldn't load, since
  // nothing else on the page works without them. It never closes itself.
  const typesFold = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!typesLoading && (typesError || types.length === 0) && typesFold.current) typesFold.current.open = true
  }, [typesLoading, typesError, types.length])
  const [pickedWeek, setPickedWeek] = useState<string>('')
  // Every slot loads once and is placed by its date, so a slot whose session link is missing (or
  // points at another week) still shows under the week it falls in.
  const { slots, loading, error: slotsError, createSlot, deleteSlot, setSlotLocked, claimSlot, refetch } = useDutySlots(undefined)
  const { rulesFor, save: saveRules, loading: rulesLoading } = useDutySettings()
  const [locking, setLocking] = useState<string | null>(null)

  const selectedSession = weeks.some(w => w.id === pickedWeek) ? pickedWeek : (weeks[0]?.id ?? '')
  const week = weeks.find(w => w.id === selectedSession) ?? null
  const days = week ? sessionDays(week) : []
  const year = week?.year ?? new Date().getFullYear()
  const rules = rulesFor(year)
  // Spec 38: who in this week's crew is under the duty minimum.
  const { rows: short, error: shortError, refetch: refetchShort } = useDutyShortfall(selectedSession)

  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeMinutes, setNewTypeMinutes] = useState('30')
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
    try { await createType(newTypeName.trim(), undefined, Number(newTypeMinutes) || 30); setNewTypeName('') }
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

  // Spec 37: a locked slot can't be joined or dropped by volunteers; admins still change it.
  async function toggleLock(slot: DutySlot) {
    if (locking === slot.id) return
    setLocking(slot.id)
    setActionError(null)
    try { await setSlotLocked(slot.id, !slot.locked) }
    catch (e) { setActionError(`Couldn't ${slot.locked ? 'unlock' : 'lock'} it: ${e instanceof Error ? e.message : 'unknown error'}`) }
    finally { setLocking(null) }
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
    .map(id => ({ id, name: weekSlots.find(s => s.duty_type_id === id)?.duty_type?.name ?? 'Duty', description: null as string | null, minutes: 0 }))]
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
      onCancel={() => closeAndFocus(() => setPendingDelete(null), `delete-slot-${slot.id}`)}
    />
  )

  const linkBtn = 'min-h-11 text-sm font-bold underline underline-offset-[3px] cursor-pointer'

  return (
    <div className={pageClass}>
      <AdminPageHead title="Duties" lede={`Accepted volunteers sign up for these from their Duties tab, and can drop one until ${rules.drop_lock_days} days before it.${rules.minutes_per_week > 0 ? ` Each needs ${rules.minutes_per_week} duty minutes in a week they're on a crew.` : ''} Lock a slot to stop all changes to it.`} />

      {weeks.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmented
            label="Week"
            value={selectedSession}
            onChange={id => { setPickedWeek(id); setSlotNote(null); setPendingDelete(null) }}
            options={weeks.map(w => ({
              value: w.id,
              label: <>{w.name}<span className="max-sm:hidden font-semibold"> · {shortRange(w.start_date, w.end_date)}</span></>,
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
          className="relative overflow-x-auto focus-visible:outline-offset-2">
          <table className="w-full min-w-[760px] table-fixed bg-surface border-y-2 border-ink">
            <caption className="sr-only">Duties, {week.name}, {shortRange(week.start_date, week.end_date)}</caption>
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
                        {t.minutes > 0 && <span className="block text-sm font-normal text-ink-muted">{t.minutes} min</span>}
                        {t.description && <span className="block text-sm font-normal text-ink-muted text-pretty">{t.description}</span>}
                      </th>
                      {days.map(d => {
                        const list = cellSlots(t.id, d)
                        return (
                          <td key={d} className="group/cell px-3 py-3 align-top">
                            {list.length === 0 ? (
                              <span className="text-ink-muted" aria-label="No slot">–</span>
                            ) : list.map(slot => {
                              const names = (slot.assignments ?? []).map(a => a.volunteer?.profiles?.display_name ?? 'A volunteer')
                              const gap = openOf(slot)
                              return (
                                <div key={slot.id} className="[&+&]:mt-3 [&+&]:pt-3 [&+&]:border-t [&+&]:border-border">
                                  {slot.locked && (
                                    <p className="mb-0.5 inline-flex items-center gap-1.5 text-sm font-bold text-ink-muted">
                                      <Lock size={14} strokeWidth={2.5} aria-hidden="true" /> Locked
                                    </p>
                                  )}
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
                                  <div className="flex flex-wrap gap-x-3">
                                    {/* Quiet until the cell is hovered or a link is focused; always shown on touch screens. */}
                                    {/* aria-disabled, not disabled: a disabled button drops keyboard focus mid-save. */}
                                    <button type="button" aria-disabled={locking === slot.id || undefined} aria-pressed={slot.locked}
                                      className={`${linkBtn} text-ink-muted [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/cell:opacity-100 focus-visible:opacity-100`}
                                      onClick={() => void toggleLock(slot)}>
                                      {slot.locked ? 'Unlock' : 'Lock'}<span className="sr-only"> {t.name} on {dayLong(d)}</span>
                                    </button>
                                    <button type="button" id={`delete-slot-${slot.id}`} className={`${linkBtn} text-ink-muted [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/cell:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100`}
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

      {week && rules.minutes_per_week > 0 && !loading && !slotsError && (
        <ShortList week={week} required={rules.minutes_per_week} deadlineDays={rules.signup_deadline_days}
          rows={short} error={shortError} slots={weekSlots} types={types}
          onAssign={async (slotId, volunteerId) => { await claimSlot(slotId, volunteerId); await refetchShort() }}
          onRetry={() => void refetchShort()} />
      )}

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
                  <button type="button" id={`delete-slot-${slot.id}`} className={`${linkBtn} text-ink-muted`}
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

        <details ref={typesFold} className="group mt-6">
          <summary className="inline-flex items-center gap-1.5 min-h-11 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Duty types ({types.length})
            <ChevronDown size={18} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 border-y-2 border-ink max-w-[640px]">
            {types.map(t => (
              <li key={t.id} className="border-t border-border first:border-t-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-h-12 py-1">
                  <span className="flex-1 min-w-[min(100%,10rem)]">{t.name}</span>
                  <TypeMinutes key={`${t.id}-${t.minutes}`} type={t} onSave={async m => { await setTypeMinutes(t.id, m); void refetchShort() }} />
                  <button type="button" id={`remove-type-${t.id}`} className={`${linkBtn} text-ink-muted`}
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
                      onCancel={() => closeAndFocus(() => setPendingDelete(null), `remove-type-${t.id}`)}
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
            <div>
              <label htmlFor="new-duty-minutes" className={label}>Minutes</label>
              <Input id="new-duty-minutes" type="number" inputMode="numeric" min={5} max={480} step={5} value={newTypeMinutes} className="w-[6.5rem]"
                onChange={e => setNewTypeMinutes(e.target.value)} />
            </div>
            <Button type="submit" disabled={addingType}>{addingType ? 'Adding…' : 'Add duty type'}</Button>
          </form>
          {typeErr && <p role="alert" className="mt-2 text-sm font-bold text-danger">{typeErr}</p>}
        </details>

        <DutyRules key={`${year}-${rulesLoading ? 'loading' : 'loaded'}`} year={year} values={rules}
          onSave={async v => { await saveRules(year, v); void refetchShort() }} />
      </section>
    </div>
  )
}

const fieldNote = 'mt-1 text-sm text-ink-muted'

// A duty type's length, edited in place (spec 38). Save shows once the number changes.
function TypeMinutes({ type, onSave }: { type: DutyType; onSave: (minutes: number) => Promise<void> }) {
  const [value, setValue] = useState(String(type.minutes))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const n = Number(value)
  const dirty = n !== type.minutes
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!Number.isInteger(n) || n < 5 || n > 480) { setErr('5 to 480 minutes'); return }
    setBusy(true); setErr(null)
    try { await onSave(n) } catch (e) { setErr(e instanceof Error ? e.message : 'Couldn\'t save') } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <label htmlFor={`minutes-${type.id}`} className="sr-only">Minutes for {type.name}</label>
      <Input id={`minutes-${type.id}`} type="number" inputMode="numeric" min={5} max={480} step={5} value={value}
        className="w-[5.5rem]" onChange={e => setValue(e.target.value)} />
      <span aria-hidden="true" className="text-sm text-ink-muted">min</span>
      {dirty && <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>}
      {err && <span role="alert" className="text-sm font-bold text-danger">{err}</span>}
    </form>
  )
}

type Rules = { drop_lock_days: number; minutes_per_week: number; signup_deadline_days: number }

// The year's duty rules (specs 37, 38), saved together.
function DutyRules({ year, values, onSave }: { year: number; values: Rules; onSave: (v: Rules) => Promise<void> }) {
  const [form, setForm] = useState({ minutes_per_week: String(values.minutes_per_week), signup_deadline_days: String(values.signup_deadline_days), drop_lock_days: String(values.drop_lock_days) })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, [k]: e.target.value })); setMsg(null) }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = { minutes_per_week: Number(form.minutes_per_week), signup_deadline_days: Number(form.signup_deadline_days), drop_lock_days: Number(form.drop_lock_days) }
    if (!Number.isInteger(v.minutes_per_week) || v.minutes_per_week < 0 || v.minutes_per_week > 1200) { setMsg({ ok: false, text: 'Minutes per week: 0 to 1200' }); return }
    if (!Number.isInteger(v.signup_deadline_days) || v.signup_deadline_days < 0 || v.signup_deadline_days > 60) { setMsg({ ok: false, text: 'Deadline: 0 to 60 days' }); return }
    if (!Number.isInteger(v.drop_lock_days) || v.drop_lock_days < 0 || v.drop_lock_days > 30) { setMsg({ ok: false, text: 'Drop lock: 0 to 30 days' }); return }
    setBusy(true); setMsg(null)
    try { await onSave(v); setMsg({ ok: true, text: 'Saved.' }) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Couldn\'t save' }) }
    finally { setBusy(false) }
  }
  return (
    <details className="group mt-6">
      <summary className="inline-flex items-center gap-1.5 min-h-11 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        Duty rules for {year}
        <ChevronDown size={18} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <form onSubmit={submit} className="mt-2 max-w-[640px] space-y-4">
        <div>
          <label htmlFor="rule-minutes" className={label}>Duty minutes each volunteer needs per week</label>
          <Input id="rule-minutes" type="number" inputMode="numeric" min={0} max={1200} step={5} value={form.minutes_per_week}
            className="w-[7rem]" aria-describedby="rule-minutes-note" onChange={set('minutes_per_week')} />
          <p id="rule-minutes-note" className={fieldNote}>Any mix of duties counts. Applies to each week a volunteer is on a crew. 0 means no minimum.</p>
        </div>
        <div>
          <label htmlFor="rule-deadline" className={label}>Sign-ups due (days before the week starts)</label>
          <Input id="rule-deadline" type="number" inputMode="numeric" min={0} max={60} value={form.signup_deadline_days}
            className="w-[7rem]" aria-describedby="rule-deadline-note" onChange={set('signup_deadline_days')} />
          <p id="rule-deadline-note" className={fieldNote}>Anyone still short gets a reminder 2 days before. After it, you assign them, and they can't drop a duty they need for the minimum.</p>
        </div>
        <div>
          <label htmlFor="rule-lock" className={label}>Drops lock (days before the duty)</label>
          <Input id="rule-lock" type="number" inputMode="numeric" min={0} max={30} value={form.drop_lock_days}
            className="w-[7rem]" aria-describedby="rule-lock-note" onChange={set('drop_lock_days')} />
          <p id="rule-lock-note" className={fieldNote}>Late sign-ups stay open and lock at once.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save rules'}</Button>
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm font-bold ${msg.ok ? 'text-ink-muted' : 'text-danger'}`}>{msg.text}</p>}
        </div>
      </form>
    </details>
  )
}

// Spec 38: crewed volunteers under the week's minimum, each with a picker of the week's open slots.
function ShortList({ week, required, deadlineDays, rows, error, slots, types, onAssign, onRetry }: {
  week: { name: string; start_date: string }
  required: number
  deadlineDays: number
  rows: DutyShortfall[]
  error: string | null
  slots: DutySlot[]
  types: DutyType[]
  onAssign: (slotId: string, volunteerId: string) => Promise<void>
  onRetry: () => void
}) {
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<{ id: string; text: string } | null>(null)
  const deadline = addDays(week.start_date, -deadlineDays)
  const today = localDateISO()
  const due = parseLocalDate(deadline).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const minutesOf = (s: DutySlot) => types.find(t => t.id === s.duty_type_id)?.minutes ?? 0

  async function assign(v: DutyShortfall) {
    const slotId = picked[v.volunteer_id]
    if (!slotId) { setErr({ id: v.volunteer_id, text: 'Pick a duty first' }); return }
    setBusy(v.volunteer_id); setErr(null)
    try {
      await onAssign(slotId, v.volunteer_id)
      setPicked(p => ({ ...p, [v.volunteer_id]: '' }))
      // A person who now meets the minimum leaves the list, and their button with it: keep the
      // focus on the list instead of losing it to the page.
      setTimeout(() => { if (!document.getElementById(`assign-btn-${v.volunteer_id}`)) document.getElementById('short-heading')?.focus() }, 0)
    }
    catch (e) { setErr({ id: v.volunteer_id, text: e instanceof Error ? e.message : 'Couldn\'t assign' }) }
    finally { setBusy(null) }
  }

  return (
    <section aria-labelledby="short-heading" className="mt-8">
      <h2 id="short-heading" tabIndex={-1} className={`${h2Class} focus:outline-none`}>Short on duty minutes</h2>
      <p className="mt-1 text-ink-muted text-pretty">
        {today > deadline
          ? `Sign-ups for ${week.name} were due ${due}. Put each person on an open duty; they get an email.`
          : `Volunteers pick their own until ${due}${today === deadline ? ' (today)' : ''}. You can add someone now too.`}
      </p>
      {error ? (
        <div role="alert" className="mt-3 py-3 border-y-2 border-ink flex flex-wrap items-center gap-x-4 gap-y-2">
          <p title={error} className="flex-1 font-bold text-danger">Couldn't load who is short.</p>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 py-3 border-y-2 border-ink">Everyone on the {week.name} crew has at least {required} duty minutes.</p>
      ) : (
        <ul className="mt-3 border-y-2 border-ink">
          {rows.map(v => {
            const open = slots.filter(s => s.slot_date >= today && s.assigned_count < s.capacity && !s.assignments?.some(a => a.volunteer_id === v.volunteer_id))
            const id = `assign-${v.volunteer_id}`
            return (
              <li key={v.volunteer_id} className="py-3 border-t border-border first:border-t-0 flex flex-wrap items-end gap-x-4 gap-y-2">
                <p className="flex-[1_1_12rem] min-w-0">
                  <b className="font-bold">{v.display_name}</b>
                  <span className="block text-sm text-ink-muted">{v.minutes} of {v.required_minutes} min</span>
                </p>
                {open.length === 0 ? (
                  <p className="text-sm text-ink-muted">No open duties left this week. Add a slot below.</p>
                ) : (
                  <>
                    <div className="flex-[1_1_16rem] min-w-0 max-w-[24rem]">
                      <label htmlFor={id} className="sr-only">Duty for {v.display_name}</label>
                      <Select id={id} value={picked[v.volunteer_id] ?? ''} onChange={e => setPicked(p => ({ ...p, [v.volunteer_id]: e.target.value }))}>
                        <option value="">Choose a duty…</option>
                        {open.map(s => (
                          <option key={s.id} value={s.id}>{dayHead(s.slot_date)} · {s.duty_type?.name ?? 'Duty'} · {minutesOf(s)} min{s.locked ? ' · locked' : ''}</option>
                        ))}
                      </Select>
                    </div>
                    <Button id={`assign-btn-${v.volunteer_id}`} onClick={() => void assign(v)} disabled={busy === v.volunteer_id}>
                      {busy === v.volunteer_id ? 'Assigning…' : 'Assign'}<span className="sr-only"> {v.display_name}</span>
                    </Button>
                  </>
                )}
                {err?.id === v.volunteer_id && <p role="alert" className="basis-full text-sm font-bold text-danger">{err.text}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
