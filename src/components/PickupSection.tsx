import { useEffect, useId, useRef, useState } from 'react'
import { Footprints, UserRound } from 'lucide-react'
import InlineConfirm from './InlineConfirm'
import Segmented from './Segmented'
import { Input } from './Field'
import { buttonClass } from '../lib/ui'
import { localDateISO, sessionDays } from '../lib/campDay'
import { closeAndFocus } from '../lib/focus'
import { camperFirstName } from '../lib/parentHome'
import {
  LEAVE_MODES, daysAhead, daysPhrase, leaveVerb, openWeeks, pickupDraftError, shortDay,
  type PickupDraft, type PickupField,
} from '../lib/pickups'
import { usePickups } from '../hooks/usePickups'
import { ErrorLine, hintCls, labelCls } from '../pages/parent/parts'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import type { AuthorizedPickup, LeaveMode, ReleaseConsent, Session, Student } from '../types/database'

const textBtn = buttonClass('text')
const mutedBtn = 'ui-btn ui-btn--text text-ink-muted font-semibold'
const choiceCls = 'flex items-center gap-3 min-h-[52px] px-4 py-2 rounded border-2 border-border bg-surface cursor-pointer has-[input:checked]:border-ink'

// The camper card's Pickup section (spec 36): the adults who may collect the camper besides the
// parent (any day, or named days), and, per week, whether the camper may leave on their own. Shown
// while the camper holds a seat in a week that hasn't ended: a same-day change still works, and
// during camp week the lead is emailed (by the database).
export default function PickupSection({ student, regs, sessions }: {
  student: Student
  regs: RegistrationWithSection[]
  sessions: Session[]
}) {
  const today = localDateISO()
  const weeks = openWeeks(regs, sessions, today)
  const first = camperFirstName(student)
  const data = usePickups(student.id, weeks.length > 0)
  const [adding, setAdding] = useState(false)
  const headingId = useId()
  if (weeks.length === 0) return null
  const days = daysAhead(weeks, today)

  return (
    <section aria-labelledby={headingId} className="py-3 border-t border-border">
      <h3 id={headingId} className="text-lg font-bold leading-[1.3]">Pickup</h3>
      <p className="text-ink-muted text-pretty max-w-[60ch]">
        You can always collect {first}. Anyone else must be on this list, and the crew checks it at dismissal.
      </p>
      {data.error && !data.pickups && <ErrorLine className="mt-2">Couldn't load {first}'s pickup list. Refresh to try again.</ErrorLine>}
      {data.pickups === null && !data.error && <div className="mt-2 h-12 rounded bg-surface-sunken animate-pulse" aria-busy="true" />}

      {data.pickups && (
        <>
          {data.pickups.length > 0 && (
            <ul aria-label={`Who else can collect ${first}`} className="mt-2 border-y-2 border-ink">
              {data.pickups.map(p => <AdultRow key={p.id} adult={p} first={first} days={days} data={data} />)}
            </ul>
          )}
          {adding ? (
            <AdultForm first={first} days={days} onCancel={() => closeAndFocus(() => setAdding(false), `${headingId}-add`)}
              onSave={async (d, ds) => { await data.savePickup(null, d, ds); closeAndFocus(() => setAdding(false), `${headingId}-add`) }} />
          ) : (
            <button type="button" id={`${headingId}-add`} onClick={() => setAdding(true)} className={textBtn}>
              <UserRound size={16} strokeWidth={2.5} aria-hidden="true" /> Add an adult
            </button>
          )}

          <ul aria-label={`${first} leaving on their own`} className="mt-1">
            {weeks.map(w => (
              <ConsentLine key={w.id} week={w} first={first} today={today}
                consent={data.consents?.find(c => c.session_id === w.id) ?? null} data={data} />
            ))}
          </ul>
          <p className="mt-1 text-sm text-ink-muted text-pretty">You can change these until the week ends, even on the day.</p>
        </>
      )}
    </section>
  )
}

type Data = ReturnType<typeof usePickups>

function AdultRow({ adult, first, days, data }: { adult: AuthorizedPickup; first: string; days: string[]; data: Data }) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'remove'>('idle')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const prev = useRef(mode)
  useEffect(() => {
    if (mode === 'idle' && prev.current !== 'idle') actionsRef.current?.querySelector('button')?.focus()
    prev.current = mode
  }, [mode])

  if (mode === 'edit') {
    return (
      <li className="py-2 border-t border-border first:border-t-0">
        <AdultForm first={first} days={days} initial={adult} onCancel={() => setMode('idle')}
          onSave={async (d, ds) => { await data.savePickup(adult.id, d, ds); setMode('idle') }} />
      </li>
    )
  }
  return (
    <li className="py-2 border-t border-border first:border-t-0">
      <p><span className="font-bold">{adult.name}</span> · {adult.relation}</p>
      <p className="text-sm text-ink-muted">{adult.phone} · {daysPhrase(adult.days)}</p>
      {mode === 'remove' ? (
        <div className="mt-2">
          <InlineConfirm
            message={`Take ${adult.name} off ${first}'s pickup list? The crew won't let ${first} go with them.`}
            confirmLabel={busy ? 'Removing…' : 'Remove'} cancelLabel="Keep" busy={busy}
            onConfirm={() => {
              setBusy(true); setErr(null)
              data.removePickup(adult.id).catch(e => { setErr(e instanceof Error ? e.message : 'Something went wrong'); setBusy(false) })
            }}
            onCancel={() => { setMode('idle'); setErr(null) }}
          />
        </div>
      ) : (
        <div ref={actionsRef} className="flex flex-wrap gap-x-6">
          <button type="button" onClick={() => setMode('edit')} className={textBtn}>Change<span className="sr-only"> {adult.name}</span></button>
          <button type="button" onClick={() => setMode('remove')} className={mutedBtn}>Remove<span className="sr-only"> {adult.name}</span></button>
        </div>
      )}
      {err && <ErrorLine className="mt-2">{err}</ErrorLine>}
    </li>
  )
}

// Add or change one adult: name, relation, phone, and any day or named days.
function AdultForm({ first, days, initial, onSave, onCancel }: {
  first: string
  days: string[]
  initial?: AuthorizedPickup
  onSave: (d: PickupDraft, days: string[] | null) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const [d, setD] = useState<PickupDraft>({ name: initial?.name ?? '', relation: initial?.relation ?? '', phone: initial?.phone ?? '' })
  const [some, setSome] = useState<'any' | 'some'>(initial?.days ? 'some' : 'any')
  const [picked, setPicked] = useState<string[]>(initial?.days ?? [])
  const [bad, setBad] = useState<{ field: PickupField | 'days'; message: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Days already set that have passed stay listed, so saving doesn't drop them silently.
  const choices = [...new Set([...picked, ...days])].sort()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = pickupDraftError(d) ?? (some === 'some' && picked.length === 0 ? { field: 'days' as const, message: 'Pick at least one day' } : null)
    setBad(problem); setErr(null)
    if (problem) { document.getElementById(`${id}-${problem.field}`)?.focus(); return }
    setBusy(true)
    try { await onSave(d, some === 'some' ? picked : null) } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  const field = (key: PickupField, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={`${id}-${key}`} className={labelCls}>{label}</label>
      <Input id={`${id}-${key}`} value={d[key]} onChange={e => setD(v => ({ ...v, [key]: e.target.value }))}
        aria-invalid={bad?.field === key || undefined} aria-describedby={bad?.field === key ? `${id}-err` : undefined} {...props} />
      {bad?.field === key && <ErrorLine id={`${id}-err`} className="mt-1.5">{bad.message}</ErrorLine>}
    </div>
  )

  return (
    <form onSubmit={submit} noValidate className="mt-2 space-y-3 max-w-[640px]">
      {field('name', 'Their name', { type: 'text', autoComplete: 'off', maxLength: 100, autoFocus: true })}
      <div className="grid gap-3 sm:grid-cols-2">
        {field('relation', `How they know ${first}`, { type: 'text', maxLength: 50, placeholder: 'Grandparent, carpool, neighbour' })}
        {field('phone', 'Phone', { type: 'tel', autoComplete: 'off', maxLength: 30 })}
      </div>
      <div>
        <p id={`${id}-when`} className={labelCls}>When can they collect {first}?</p>
        <Segmented labelledBy={`${id}-when`} mode="radio" value={some} onChange={setSome}
          options={[{ value: 'any', label: 'Any day' }, { value: 'some', label: 'Only some days' }]} />
      </div>
      {some === 'some' && (
        <fieldset aria-describedby={bad?.field === 'days' ? `${id}-err` : undefined}>
          <legend className={labelCls}>Which days?</legend>
          <div id={`${id}-days`} tabIndex={-1} className="grid gap-2 sm:grid-cols-2 focus:outline-none">
            {choices.map(day => (
              <label key={day} className={choiceCls}>
                <input type="checkbox" className="w-[22px] h-[22px] shrink-0" checked={picked.includes(day)}
                  onChange={e => setPicked(p => (e.target.checked ? [...p, day] : p.filter(x => x !== day)))} />
                <span className="font-bold">{shortDay(day)}</span>
              </label>
            ))}
          </div>
          {bad?.field === 'days' && <ErrorLine id={`${id}-err`} className="mt-1.5">{bad.message}</ErrorLine>}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCancel} className={buttonClass('secondary')}>Cancel</button>
        <button type="submit" disabled={busy} aria-busy={busy} className={buttonClass('ink')}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add to the list'}</button>
      </div>
      {err && <ErrorLine>{err}</ErrorLine>}
    </form>
  )
}

// One week: may the camper leave on their own, how, and which days.
function ConsentLine({ week, first, today, consent, data }: { week: Session; first: string; today: string; consent: ReleaseConsent | null; data: Data }) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'remove'>('idle')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // The buttons that open the form and the confirm, for focus to come back to when they close.
  const lid = useId()
  const changeId = `${lid}-change`, removeId = `${lid}-remove`, letId = `${lid}-let`

  return (
    <li className="py-2">
      <p className="flex items-start gap-1.5 text-pretty">
        <Footprints size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-1" />
        <span>
          <b className="font-bold">{week.name}:</b>{' '}
          {consent
            ? `${first} ${leaveVerb(consent.mode)} on their own, ${daysPhrase(consent.days, 'every day').replace(/^./, c => c.toLowerCase())}.`
            : `${first} leaves only with you or an adult on the list.`}
          {consent?.note && <span className="block text-sm text-ink-muted">Your note: {consent.note}</span>}
        </span>
      </p>
      {mode === 'edit' ? (
        <ConsentForm week={week} first={first} today={today} consent={consent} onCancel={() => closeAndFocus(() => setMode('idle'), changeId, letId)}
          onSave={async (m, ds, note) => { await data.saveConsent(week.id, m, ds, note); closeAndFocus(() => setMode('idle'), changeId, letId) }} />
      ) : mode === 'remove' && consent ? (
        <div className="mt-2">
          <InlineConfirm
            message={`Take back ${first}'s consent to leave on their own in ${week.name}? The crew will wait for you or an adult on the list.`}
            confirmLabel={busy ? 'Removing…' : 'Take it back'} cancelLabel="Keep" busy={busy}
            onConfirm={() => {
              setBusy(true); setErr(null)
              data.removeConsent(consent.id).then(
                () => closeAndFocus(() => { setMode('idle'); setBusy(false) }, letId),
                e => { setErr(e instanceof Error ? e.message : 'Something went wrong'); setBusy(false) })
            }}
            onCancel={() => closeAndFocus(() => { setMode('idle'); setErr(null) }, removeId)}
          />
        </div>
      ) : consent ? (
        <div className="flex flex-wrap gap-x-6">
          <button type="button" id={changeId} onClick={() => setMode('edit')} className={textBtn}>Change<span className="sr-only">, {week.name}</span></button>
          <button type="button" id={removeId} onClick={() => setMode('remove')} className={mutedBtn}>Take it back<span className="sr-only">, {week.name}</span></button>
        </div>
      ) : (
        <button type="button" id={letId} onClick={() => setMode('edit')} className={textBtn}>
          Let {first} leave on their own<span className="sr-only">, {week.name}</span>
        </button>
      )}
      {err && <ErrorLine className="mt-2">{err}</ErrorLine>}
    </li>
  )
}

function ConsentForm({ week, first, today, consent, onSave, onCancel }: {
  week: Session
  first: string
  today: string
  consent: ReleaseConsent | null
  onSave: (mode: LeaveMode, days: string[] | null, note: string) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const [how, setHow] = useState<LeaveMode | ''>(consent?.mode ?? '')
  const [some, setSome] = useState<'all' | 'some'>(consent?.days ? 'some' : 'all')
  const [picked, setPicked] = useState<string[]>(consent?.days ?? [])
  const [note, setNote] = useState(consent?.note ?? '')
  const [bad, setBad] = useState<{ field: 'how' | 'days'; message: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const choices = [...new Set([...picked, ...sessionDays(week).filter(d => d >= today)])].sort()
  // The button that opened the form is gone, so focus starts on its first answer, not <body>.
  useEffect(() => {
    document.querySelector<HTMLElement>(`[aria-labelledby="${id}-how"] button:not([tabindex="-1"])`)?.focus()
  }, [id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = !how ? { field: 'how' as const, message: `Choose how ${first} gets home` }
      : some === 'some' && picked.length === 0 ? { field: 'days' as const, message: 'Pick at least one day' } : null
    setBad(problem); setErr(null)
    if (problem) {
      const target = problem.field === 'how' ? document.querySelector<HTMLElement>(`[aria-labelledby="${id}-how"] button`) : document.getElementById(`${id}-days`)
      target?.focus()
      return
    }
    setBusy(true)
    try { await onSave(how as LeaveMode, some === 'some' ? picked : null, note) } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 space-y-3 max-w-[640px]">
      <div>
        <p id={`${id}-how`} className={labelCls}>How does {first} get home?</p>
        <Segmented labelledBy={`${id}-how`} mode="radio" value={how} onChange={v => { setHow(v); setBad(null) }}
          options={LEAVE_MODES.map(m => ({ value: m.key, label: m.label }))} />
        {bad?.field === 'how' && <ErrorLine className="mt-1.5">{bad.message}</ErrorLine>}
      </div>
      <div>
        <p id={`${id}-when`} className={labelCls}>Which days?</p>
        <Segmented labelledBy={`${id}-when`} mode="radio" value={some} onChange={setSome}
          options={[{ value: 'all', label: `Every day of ${week.name}` }, { value: 'some', label: 'Only some days' }]} />
      </div>
      {some === 'some' && (
        <fieldset>
          <legend className="sr-only">Days {first} may leave on their own</legend>
          <div id={`${id}-days`} tabIndex={-1} className="grid gap-2 sm:grid-cols-2 focus:outline-none">
            {choices.map(day => (
              <label key={day} className={choiceCls}>
                <input type="checkbox" className="w-[22px] h-[22px] shrink-0" checked={picked.includes(day)}
                  onChange={e => setPicked(p => (e.target.checked ? [...p, day] : p.filter(x => x !== day)))} />
                <span className="font-bold">{shortDay(day)}</span>
              </label>
            ))}
          </div>
          {bad?.field === 'days' && <ErrorLine className="mt-1.5">{bad.message}</ErrorLine>}
        </fieldset>
      )}
      <div>
        <label htmlFor={`${id}-note`} className={labelCls}>A note for the crew <span className="font-normal text-ink-muted">(optional)</span></label>
        <span id={`${id}-note-hint`} className={hintCls}>For example: walks home with her brother.</span>
        <Input id={`${id}-note`} type="text" maxLength={300} value={note} aria-describedby={`${id}-note-hint`} onChange={e => setNote(e.target.value)} className="mt-1.5" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCancel} className={buttonClass('secondary')}>Cancel</button>
        <button type="submit" disabled={busy} aria-busy={busy} className={buttonClass('ink')}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {err && <ErrorLine>{err}</ErrorLine>}
    </form>
  )
}
