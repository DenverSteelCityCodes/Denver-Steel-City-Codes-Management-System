import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import { useDutySlots, type DutySlot } from '../../hooks/useDutyRoles'
import InlineConfirm from '../../components/InlineConfirm'
import { formatDayLong, localDateISO, parseLocalDate } from '../../lib/campDay'
import { countLabel, groupDutyWeeks } from '../../lib/volunteerHome'
import { PageHead, Sect, linkCls, listCls, primaryCls } from './parts'

const weekday = (iso: string) => parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'short' })
const dayNum = (iso: string) => parseLocalDate(iso).getDate()

// One of your duties: date block, duty, and (on the Duties tab) a Cancel that asks first.
export function MyDutyRow({ slot, onDrop }: { slot: DutySlot; onDrop?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <span className="w-10 text-center shrink-0 leading-tight">
        <span className="block font-sans text-[12.5px] font-semibold text-ink-muted">{weekday(slot.slot_date)}</span>
        <span className="block font-sans text-xl font-bold text-ink">{dayNum(slot.slot_date)}</span>
      </span>
      <span className="flex-1 min-w-0 font-sans text-base font-semibold text-ink">{slot.duty_type?.name ?? 'Duty'}</span>
      {onDrop && (
        <button type="button" onClick={onDrop}
          className="h-11 px-3 rounded-[10px] font-sans font-semibold text-[15px] text-ink-muted hover:bg-danger-soft hover:text-danger transition">
          Cancel
        </button>
      )}
    </div>
  )
}

// Duties tab: your duties first, then one week and one day at a time instead of every slot in one
// list. Sign up and cancel use the same claim/unclaim as before; cancelling now asks inline first.
export default function VolunteerDuties() {
  const { user } = useAuth()
  const { sessions } = useVolunteerHome()
  const { slots, loading, error, claimSlot, unclaimSlot, refetch } = useDutySlots()
  const today = localDateISO()
  const upcoming = slots.filter(s => s.slot_date >= today)
  const weeks = groupDutyWeeks(upcoming, sessions)
  const mine = upcoming.filter(s => s.assignments?.some(a => a.volunteer_id === user?.id))

  const [weekKey, setWeekKey] = useState<string | null>(null)
  const [dayPick, setDayPick] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dropping, setDropping] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const week = weeks.find(w => w.key === weekKey) ?? weeks[0]
  const day = week?.days.find(d => d.date === dayPick) ?? week?.days[0]

  async function act(slotId: string, fn: () => Promise<void>, fallback: string) {
    setBusy(slotId); setErr(null)
    try { await fn(); setDropping(null) }
    catch (e) { setErr(e instanceof Error ? e.message : fallback) }
    finally { setBusy(null) }
  }

  if (loading) {
    return <div className="space-y-3" aria-busy="true">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface-sunken rounded-[14px] animate-pulse" />)}</div>
  }
  if (error) {
    return (
      <div role="alert">
        <PageHead title="Couldn't load duties">{error}</PageHead>
        <button type="button" onClick={() => void refetch()} className={`${primaryCls} mt-5`}>Try again</button>
      </div>
    )
  }

  return (
    <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-10 sm:items-start">
      <div>
        <PageHead title={mine.length ? `You're on ${countLabel(mine.length, 'duty', 'duties')}` : 'No duties yet'} />
        {mine.length > 0 ? (
          <div className={`${listCls} mt-4`}>
            {mine.map(s => (
              <div key={s.id}>
                <MyDutyRow slot={s} onDrop={dropping === s.id ? undefined : () => setDropping(s.id)} />
                {dropping === s.id && (
                  <InlineConfirm
                    message={`Drop ${s.duty_type?.name ?? 'this duty'} on ${formatDayLong(s.slot_date)}? The camp will need someone else to cover it.`}
                    confirmLabel="Drop duty" cancelLabel="Keep it" busy={busy === s.id}
                    onConfirm={() => void act(s.id, () => unclaimSlot(s.id, user!.id), "Couldn't cancel that sign-up")}
                    onCancel={() => setDropping(null)} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="font-sans text-[15px] text-ink-muted mt-2">Pick an open slot{weeks.length ? ' below' : ' when the camp posts them'}.</p>
        )}
        <p className="font-sans text-[15px] text-ink-muted mt-2">
          Can't make a day? <Link to="/volunteer/profile#days-off" className={linkCls}>Tell the camp</Link>
        </p>
      </div>

      {weeks.length > 0 && week && day && (
        <Sect title="Find a duty" id="find-duty" className="sm:mt-0">
          {weeks.length > 1 && (
            <div role="group" aria-label="Week" className="grid grid-flow-col auto-cols-fr border border-border-strong rounded-[10px] overflow-hidden bg-surface mb-2.5">
              {weeks.map(w => (
                <button key={w.key} type="button" aria-pressed={w.key === week.key} onClick={() => { setWeekKey(w.key); setDayPick(null) }}
                  className={`h-11 font-sans font-semibold text-[15px] border-l border-border-strong first:border-l-0 transition ${
                    w.key === week.key ? 'bg-ink text-bg' : 'text-ink hover:bg-surface-sunken'}`}>
                  {w.label}
                </button>
              ))}
            </div>
          )}
          <div role="group" aria-label="Day" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(week.days.length, 5)}, minmax(0, 1fr))` }}>
            {week.days.map(d => {
              const open = d.slots.filter(s => s.assigned_count < s.capacity).length
              const has = d.slots.some(s => s.assignments?.some(a => a.volunteer_id === user?.id))
              const on = d.date === day.date
              return (
                <button key={d.date} type="button" aria-pressed={on} onClick={() => setDayPick(d.date)}
                  aria-label={`${formatDayLong(d.date)}, ${open ? `${open} open` : 'full'}${has ? ', you have a duty' : ''}`}
                  className={`relative h-[66px] rounded-[12px] border flex flex-col items-center justify-center gap-0.5 font-sans transition ${
                    on ? 'bg-brand border-brand text-brand-on' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'}`}>
                  {has && <span aria-hidden="true" className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${on ? 'bg-brand-on' : 'bg-role-volunteer'}`} />}
                  <span className={`text-[13px] font-semibold ${on ? '' : 'text-ink-muted'}`}>{weekday(d.date)}</span>
                  <span className="text-lg font-bold leading-none">{dayNum(d.date)}</span>
                  <span className={`text-xs font-semibold ${on ? '' : 'text-ink-muted'}`}>{open ? `${open} open` : 'Full'}</span>
                </button>
              )
            })}
          </div>

          <p className="font-sans text-[15px] font-bold text-ink mt-4 mb-1.5">{formatDayLong(day.date)}</p>
          {err && <p role="alert" className="font-sans text-sm text-danger mb-2">{err}</p>}
          <div className={listCls}>
            {day.slots.map(slot => {
              const mineHere = slot.assignments?.some(a => a.volunteer_id === user?.id)
              const full = slot.assigned_count >= slot.capacity && !mineHere
              return (
                <div key={slot.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <span className="flex-1 min-w-0">
                    <span className="block font-sans text-base font-semibold text-ink">{slot.duty_type?.name ?? 'Duty'}</span>
                    <span className="block font-sans text-sm text-ink-muted">{seatsLine(slot.assigned_count, slot.capacity, !!mineHere)}</span>
                  </span>
                  {mineHere ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sans text-[13px] font-semibold bg-success-soft text-success"><Check size={13} /> You're on</span>
                  ) : full ? (
                    <span className="rounded-full px-2.5 py-1 font-sans text-[13px] font-semibold bg-surface-sunken text-ink-muted">Full</span>
                  ) : (
                    <button type="button" disabled={busy === slot.id} className={primaryCls}
                      onClick={() => void act(slot.id, () => claimSlot(slot.id, user!.id), "Couldn't sign up for that slot")}>
                      {busy === slot.id ? 'Signing up…' : 'Sign up'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Sect>
      )}
    </div>
  )
}

// "Both seats open" / "1 of 2 seats taken" / "You and 1 other"
function seatsLine(taken: number, capacity: number, mine: boolean): string {
  if (mine) return taken > 1 ? `You and ${countLabel(taken - 1, 'other', 'others')}` : 'Just you so far'
  if (taken === 0) return capacity === 2 ? 'Both seats open' : `${capacity} seats open`
  return `${taken} of ${capacity} seats taken`
}
