import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleAlert, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import { useDutySettings, useDutySlots, useDutyTypes, type DutySlot } from '../../hooks/useDutyRoles'
import InlineConfirm from '../../components/InlineConfirm'
import { formatDayLong, localDateISO, parseLocalDate } from '../../lib/campDay'
import { segCls, segItemCls } from '../../lib/segmented'
import { countLabel, dutyDropLocked, dutyYear, groupDutyWeeks } from '../../lib/volunteerHome'
import { PageHead, Sect, Segmented, inkCls, linkCls, listCls, primaryCls, rowCls } from './parts'

const weekday = (iso: string) => parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'short' })
const dayNum = (iso: string) => parseLocalDate(iso).getDate()
const shortDate = (iso: string) => parseLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// Drop and sign-up refusals from the database (spec 37) are written for volunteers; anything else
// gets the caller's wording.
const DUTY_RULE = /^(Duties lock|The camp has locked|That duty has already)/
const ruleOr = (e: unknown, text: string) => e instanceof Error && DUTY_RULE.test(e.message) ? e.message : text

// One of your duties: a date block (it is a real date), the duty and what it involves, and (on the
// Duties tab) a Cancel that asks first, or "Locked" once it can't be dropped. On its own it is a
// row of a framed list (Today); pass `className=""` when the caller draws the row.
export function MyDutyRow({ slot, description, onDrop, locked = false, className = rowCls }: { slot: DutySlot; description?: string | null; onDrop?: () => void; locked?: boolean; className?: string }) {
  const duty = slot.duty_type?.name ?? 'Duty'
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span className="w-11 shrink-0 text-center leading-none">
        <span className="block text-sm font-bold text-ink-muted">{weekday(slot.slot_date)}</span>
        <span className="block mt-1 text-[1.375rem] font-extrabold text-ink">{dayNum(slot.slot_date)}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-lg font-bold leading-[1.3] text-ink">{duty}</span>
        {description && <span className="block text-ink-muted text-pretty">{description}</span>}
      </span>
      {locked ? (
        <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-ink-muted">
          <Lock size={16} strokeWidth={2.5} aria-hidden="true" /> Locked
        </span>
      ) : onDrop && (
        <button type="button" onClick={onDrop} className={`${linkCls} shrink-0 text-danger`}>
          Cancel<span className="sr-only"> {duty}, {formatDayLong(slot.slot_date)}</span>
        </button>
      )}
    </div>
  )
}

// Duties tab: your duties first, then one week and one day at a time instead of every slot in one
// list. Sign up and cancel use the same claim/unclaim as before; cancelling asks inline first.
export default function VolunteerDuties() {
  const { user } = useAuth()
  const { sessions } = useVolunteerHome()
  const { slots, loading, error, claimSlot, unclaimSlot, refetch } = useDutySlots()
  // Each duty's "what it involves" line (duty_types.description, readable by everyone).
  const { types } = useDutyTypes()
  // Spec 37: a duty can't be dropped once it is this close (or an admin locked it).
  const { lockDays } = useDutySettings()
  const describe = (s: DutySlot) => types.find(t => t.id === s.duty_type_id)?.description ?? null
  const today = localDateISO()
  const upcoming = slots.filter(s => s.slot_date >= today)
  const weeks = groupDutyWeeks(upcoming, sessions)
  const mine = upcoming.filter(s => s.assignments?.some(a => a.volunteer_id === user?.id))
  const daysFor = (s: DutySlot) => lockDays(dutyYear(s, sessions))
  const dropLocked = (s: DutySlot) => dutyDropLocked(s, today, daysFor(s))
  const anyLocked = mine.some(dropLocked)

  const [weekKey, setWeekKey] = useState<string | null>(null)
  const [dayPick, setDayPick] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dropping, setDropping] = useState<string | null>(null)
  const [err, setErr] = useState<{ slotId: string; text: string } | null>(null)

  const week = weeks.find(w => w.key === weekKey) ?? weeks[0]
  const day = week?.days.find(d => d.date === dayPick) ?? week?.days[0]

  // Errors land on the row that was tapped, in words (never the raw database message). A failed
  // sign-up re-reads the slots, since the usual cause is that someone else just took the seat.
  async function act(slotId: string, fn: () => Promise<void>, text: string, reread = false) {
    setBusy(slotId); setErr(null)
    try { await fn(); setDropping(null) }
    catch (e) { setErr({ slotId, text: ruleOr(e, text) }); if (reread || DUTY_RULE.test(ruleOr(e, ''))) void refetch() }
    finally { setBusy(null) }
  }

  if (loading) {
    return <div className="space-y-3" aria-busy="true">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface-sunken rounded animate-pulse" />)}</div>
  }
  if (error) {
    return (
      <div role="alert">
        <PageHead title="Couldn't load duties">Check your connection and try again.</PageHead>
        <button type="button" onClick={() => void refetch()} className={`${primaryCls} mt-5`}>Try again</button>
      </div>
    )
  }

  const rowError = (slotId: string) => err?.slotId === slotId && (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-bold text-danger">
      <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{err.text}
    </p>
  )

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-10 lg:items-start">
      <div>
        <PageHead title={mine.length ? `You're on ${countLabel(mine.length, 'duty', 'duties')}` : 'No duties yet'} />
        {mine.length > 0 ? (
          <ul className={`${listCls} mt-4`}>
            {mine.map(s => (
              <li key={s.id} className={rowCls}>
                <MyDutyRow slot={s} description={describe(s)} className="" locked={dropLocked(s)}
                  onDrop={dropping === s.id ? undefined : () => { setErr(null); setDropping(s.id) }} />
                {dropping === s.id && (
                  <div className="mt-3">
                    <InlineConfirm frame
                      message={`Drop ${s.duty_type?.name ?? 'this duty'} on ${formatDayLong(s.slot_date)}? The camp will need someone else to cover it.`}
                      confirmLabel="Drop duty" cancelLabel="Keep it" busy={busy === s.id}
                      onConfirm={() => void act(s.id, () => unclaimSlot(s.id, user!.id), "Couldn't drop it. Check your connection and try again.")}
                      onCancel={() => setDropping(null)} />
                  </div>
                )}
                {rowError(s.id)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-ink-muted">Pick an open slot{weeks.length ? ' below' : ' when the camp posts them'}.</p>
        )}
        <p className="mt-3 text-ink">
          {anyLocked && <span className="block text-ink-muted text-pretty">Duties lock {countLabel(daysFor(mine.find(dropLocked)!), 'day', 'days')} before, so a locked one can't be dropped here.</span>}
          Can't make a day? <Link to="/volunteer/profile#days-off" className={linkCls}>Tell the camp</Link>
        </p>
      </div>

      {weeks.length > 0 && week && day && (
        <Sect title="Find a duty" id="find-duty" className="lg:mt-0">
          {weeks.length > 1 && (
            <Segmented label="Week" className="mb-3"
              value={week.key}
              onChange={k => { setWeekKey(k); setDayPick(null) }}
              options={weeks.map(w => {
                const start = sessions.find(s => s.id === w.key)?.start_date ?? w.days[0]?.date
                return { value: w.key, label: start && !w.label.startsWith('Week of') ? `${w.label}, ${shortDate(start)}` : w.label }
              })} />
          )}
          <div role="group" aria-label="Day" className={segCls}>
            {week.days.map(d => {
              const open = d.slots.filter(s => s.assigned_count < s.capacity && !s.locked).length
              const has = d.slots.some(s => s.assignments?.some(a => a.volunteer_id === user?.id))
              const on = d.date === day.date
              const state = has ? "You're on" : open ? `${open} open` : 'Full'
              return (
                <button key={d.date} type="button" aria-pressed={on} onClick={() => setDayPick(d.date)}
                  aria-label={`${weekday(d.date)} ${dayNum(d.date)} ${state}: ${formatDayLong(d.date)}${has && open ? `, ${open} open` : ''}`}
                  className={`${segItemCls(on)} min-h-[76px] px-0.5 flex flex-col items-center justify-center gap-0.5`}>
                  {/* The name starts with what the button shows (WCAG 2.5.3); the spaces keep the words apart. */}
                  <span className="text-sm font-bold">{weekday(d.date)}</span>{' '}
                  <span className="text-[1.375rem] font-extrabold leading-none">{dayNum(d.date)}</span>{' '}
                  <span className={`text-sm ${has ? 'font-extrabold' : 'font-normal'}`}>{state}</span>
                </button>
              )
            })}
          </div>

          <h3 className="mt-5 text-lg font-bold leading-[1.3] text-ink">{formatDayLong(day.date)}</h3>
          <ul className={`${listCls} mt-2`}>
            {day.slots.map(slot => {
              const mineHere = slot.assignments?.some(a => a.volunteer_id === user?.id)
              const left = slot.capacity - slot.assigned_count
              const full = left <= 0 && !mineHere
              // Signing up late is fine (it covers a gap), but that duty can't be dropped later.
              const lateSignUp = !mineHere && !full && !slot.locked && dropLocked(slot)
              const duty = slot.duty_type?.name ?? 'Duty'
              const description = describe(slot)
              return (
                <li key={slot.id} className={rowCls}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex-[1_1_12rem] min-w-0">
                      <span className="block text-lg font-bold leading-[1.3] text-ink">{duty}</span>
                      {description && <span className="block text-ink-muted text-pretty">{description}</span>}
                      {mineHere
                        ? <span className="block text-sm text-ink-muted">{slot.assigned_count > 1 ? `You and ${countLabel(slot.assigned_count - 1, 'other', 'others')}` : 'Just you so far'}</span>
                        : !full && !slot.locked && <span className="block text-sm font-bold text-ink">{left} of {slot.capacity} open</span>}
                      {lateSignUp && <span className="block text-sm text-ink-muted">You can't drop this one later</span>}
                    </span>
                    {mineHere ? (
                      <span className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-bold bg-success-soft text-success">
                        <Check size={16} strokeWidth={2.5} aria-hidden="true" /> You're on
                      </span>
                    ) : full ? (
                      <span className="text-sm font-bold text-ink-muted">Full</span>
                    ) : slot.locked ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-muted">
                        <Lock size={16} strokeWidth={2.5} aria-hidden="true" /> Locked
                      </span>
                    ) : (
                      <button type="button" disabled={busy === slot.id} aria-busy={busy === slot.id} className={inkCls}
                        onClick={() => void act(slot.id, () => claimSlot(slot.id, user!.id), "Couldn't sign you up. Someone may have just taken the seat, so the list is refreshed. Try again.", true)}>
                        {busy === slot.id ? 'Signing up…' : 'Sign up'}<span className="sr-only"> for {duty}, {formatDayLong(slot.slot_date)}</span>
                      </button>
                    )}
                  </div>
                  {rowError(slot.id)}
                </li>
              )
            })}
          </ul>
        </Sect>
      )}
    </div>
  )
}
