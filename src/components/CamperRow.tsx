import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, GraduationCap } from 'lucide-react'
import InlineConfirm from './InlineConfirm'
import { focusOnMount } from '../lib/focus'
import { formatTimeRange } from '../lib/campDay'
import { byCamp, camperFirstName, holdsSeat, rollup, weekName, type Tone } from '../lib/parentHome'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import type { SwapOption } from '../hooks/useMyChanges'
import type { Session, Student } from '../types/database'

// Parent self-service changes (spec 11, 12, 10). Each call refetches the registrations after.
export interface Changes {
  deadlines: Map<string, string>
  openRequests: Set<string>
  cancelSpot: (registrationId: string) => Promise<void>
  requestChange: (registrationId: string, message: string) => Promise<void>
  swapOptions: (registrationId: string) => Promise<SwapOption[]>
  swapSpot: (registrationId: string, sectionId: string) => Promise<void>
}

const TONE_CLS: Record<Tone, string> = {
  ok: 'bg-success-soft text-success',
  wait: 'bg-info-soft text-info',
  offer: 'bg-brand-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  none: 'bg-surface-sunken text-ink-muted',
}

const textBtn = 'min-h-11 font-sans text-[15px] font-semibold text-ink underline decoration-brand-hover decoration-2 underline-offset-4 disabled:opacity-50'
const btnCls = 'h-11 px-4 rounded-[10px] border border-border-strong bg-surface text-ink font-sans font-semibold text-[15px] inline-flex items-center justify-center gap-1.5 hover:bg-surface-sunken transition disabled:opacity-50'
const primaryCls = 'h-11 px-4 rounded-[10px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-[15px] inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50'

// One row per camper on Home: name, one status, and each week's class. Tapping it opens the class
// details and the change actions in place (no modal), with the same inline confirmations as before.
export default function CamperRow({ student, regs, sessions, leadNames, changes, open, onToggle }: {
  student: Student
  regs: RegistrationWithSection[]
  sessions: Session[]
  leadNames: Map<string, string>
  changes: Changes
  open: boolean
  onToggle: () => void
}) {
  const first = camperFirstName(student)
  const status = rollup(regs)
  const initials = student.full_name.split(/\s+/).map(n => n.match(/\p{L}/u)?.[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
  const panelId = `camper-${student.id}`

  const line = (r: RegistrationWithSection) => {
    const cls = r.sections?.classes?.name ?? 'a class'
    if (byCamp(r)) return <>{weekName(r, sessions)}: the camp cancelled <strong className="font-semibold text-ink">{cls}</strong></>
    if (!holdsSeat(r)) return <>{weekName(r, sessions)}: <strong className="font-semibold text-ink">{cls}</strong></>
    const lead = leadNames.get(r.section_id)
    return <>{weekName(r, sessions)}: <strong className="font-semibold text-ink">{cls}</strong>{r.sections?.room ? `, ${r.sections.room}` : ''}{lead ? ` with ${lead}` : ''}</>
  }

  return (
    <div className="border-b border-border last:border-0">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId}
        className="w-full text-left flex items-start gap-3 px-4 py-3.5 min-h-16 hover:bg-surface-sunken transition">
        <span aria-hidden="true" className="w-9 h-9 mt-px rounded-full bg-role-parent-soft text-role-parent grid place-items-center font-sans font-bold text-[13px] shrink-0">{initials}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-sans text-[17px] font-semibold text-ink leading-snug">{student.full_name}</span>
          <span className="block font-sans text-[14.5px] text-ink-muted leading-normal mt-0.5">
            {regs.length === 0 ? 'Not in a class yet' : regs.map(r => <span key={r.id} className="block">{line(r)}</span>)}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-sans text-[12.5px] font-semibold whitespace-nowrap ${TONE_CLS[status.tone]}`}>{status.label}</span>
        <ChevronDown size={18} aria-hidden="true" className={`shrink-0 mt-0.5 text-ink-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={panelId} className="pb-4 pl-16 pr-4">
          {regs.map(r => (
            <RegistrationBlock key={r.id} reg={r} camper={first} studentId={student.id} sessions={sessions} changes={changes} showName={regs.length > 1} />
          ))}
          <Link to={`/parent/classes?camper=${student.id}`} className={`${regs.length ? btnCls : primaryCls} mt-3`}>
            <GraduationCap size={16} /> {regs.length ? 'Add another week' : `Find a class for ${first}`}
          </Link>
        </div>
      )}
    </div>
  )
}

function RegistrationBlock({ reg, camper, studentId, sessions, changes, showName }: {
  reg: RegistrationWithSection; camper: string; studentId: string; sessions: Session[]; changes: Changes; showName: boolean
}) {
  const sec = reg.sections
  const where = `${sec?.classes?.name ?? 'this class'}, ${weekName(reg, sessions)}`
  const time = sec?.start_time ? `${sec.days}, ${formatTimeRange(sec.start_time, sec.end_time)}` : null
  return (
    <div className="py-2.5 border-t border-border first:border-t-0 first:pt-0">
      {showName && <p className="font-sans text-[15px] font-semibold text-ink">{where}</p>}
      {byCamp(reg) ? (
        <p className="font-sans text-sm text-ink-muted mt-0.5">
          Sorry, the camp cancelled this class. You're first in line for that week's waitlists.{' '}
          <Link to={`/parent/classes?camper=${studentId}`} className="font-semibold text-ink underline decoration-brand-hover decoration-2 underline-offset-4">Pick another class</Link>
        </p>
      ) : reg.status === 'offered' ? (
        <p className="font-sans text-sm text-ink-muted mt-0.5">A spot opened up. Claim or decline it at the top of Home.</p>
      ) : (
        <>
          {holdsSeat(reg)
            ? <p className="font-sans text-sm text-ink-muted mt-0.5">{[sec?.label, time].filter(Boolean).join(', ')}{!time ? '. Times and room will be posted here.' : ''}</p>
            : <p className="font-sans text-sm text-ink-muted mt-0.5">We'll email you if a spot opens.</p>}
          <RegistrationActions reg={reg} camper={camper} where={where} changes={changes} />
        </>
      )}
    </div>
  )
}

// Cancel / leave the waitlist before the change deadline; "Request a change" after it (spec 11).
function RegistrationActions({ reg, camper, where, changes }: { reg: RegistrationWithSection; camper: string; where: string; changes: Changes }) {
  const [mode, setMode] = useState<'idle' | 'confirm' | 'request' | 'switch'>('idle')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  // Closing a panel puts focus back on the row's first action instead of dropping it (L6a).
  const idleRef = useRef<HTMLDivElement>(null)
  const prevMode = useRef(mode)
  useEffect(() => {
    if (mode === 'idle' && prevMode.current !== 'idle') idleRef.current?.querySelector('button')?.focus()
    prevMode.current = mode
  }, [mode])

  const deadline = changes.deadlines.get(reg.id)
  const seat = holdsSeat(reg)
  // A seat can be cancelled online until the deadline; a waitlist place can always be left.
  // eslint-disable-next-line react-hooks/purity -- a render-time clock read is fine for a deadline label
  const open = !seat || !deadline || Date.now() < new Date(deadline).getTime()
  const lastDay = deadline
    ? new Date(new Date(deadline).getTime() - 1).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver' })
    : null

  async function run(fn: () => Promise<void>, after: () => void) {
    setBusy(true); setErr(null)
    try { await fn(); after() } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  if (sent || changes.openRequests.has(reg.id)) {
    return <p role="status" className="mt-1 font-sans text-sm font-semibold text-success">Change request sent. The camp will email you.</p>
  }

  return (
    <div className="mt-1">
      {mode === 'idle' && (
        <>
          <div ref={idleRef} className="flex flex-wrap items-center gap-x-5">
            {open && seat && <button type="button" onClick={() => setMode('switch')} className={textBtn}>Switch class</button>}
            {open
              ? <button type="button" onClick={() => setMode('confirm')} className={textBtn}>{seat ? 'Cancel this spot' : 'Leave the waitlist'}</button>
              : <button type="button" onClick={() => setMode('request')} className={textBtn}>Request a change</button>}
          </div>
          {seat && lastDay && (
            <p className="font-sans text-sm text-ink-muted">
              {open ? `You can switch or cancel online until ${lastDay}.` : `Online changes closed after ${lastDay}. The camp can still help.`}
            </p>
          )}
        </>
      )}
      {mode === 'confirm' && (
        <div className="mt-1 -mr-4 -ml-16">
          <InlineConfirm
            message={seat
              ? `Cancel ${camper}'s spot in ${where}? The seat goes to the next family on the waitlist. You can sign up again later if spots are left.`
              : `Take ${camper} off the waitlist for ${where}?`}
            confirmLabel={seat ? 'Cancel spot' : 'Leave waitlist'}
            cancelLabel={seat ? 'Keep spot' : 'Stay on it'}
            busy={busy}
            onConfirm={() => { void run(() => changes.cancelSpot(reg.id), () => setMode('idle')) }}
            onCancel={() => { setMode('idle'); setErr(null) }}
          />
        </div>
      )}
      {mode === 'switch' && <SwitchClass reg={reg} camper={camper} changes={changes} onDone={() => setMode('idle')} />}
      {mode === 'request' && (
        <form
          onSubmit={e => { e.preventDefault(); void run(() => changes.requestChange(reg.id, message), () => { setSent(true); setMode('idle') }) }}
          className="mt-2 space-y-2"
        >
          <label htmlFor={`req-${reg.id}`} className="block font-sans text-sm font-semibold text-ink-muted">What would you like to change about {where}?</label>
          <textarea id={`req-${reg.id}`} rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} autoFocus
            className="w-full px-3 py-2.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-base focus:outline-none focus:ring-2 focus:ring-brand" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setMode('idle')} className={btnCls}>Cancel</button>
            <button type="submit" disabled={busy || !message.trim()} className={primaryCls}>{busy ? 'Sending…' : 'Send to the camp'}</button>
          </div>
        </form>
      )}
      {err && <p role="alert" className="mt-1 font-sans text-sm text-danger">{err}</p>}
    </div>
  )
}

// Switch a held seat to another class the same week (spec 12). Only classes with a free seat can be
// picked: a camper holding a seat can't join another waitlist that week (Q-W4).
function SwitchClass({ reg, camper, changes, onDone }: { reg: RegistrationWithSection; camper: string; changes: Changes; onDone: () => void }) {
  const [options, setOptions] = useState<SwapOption[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [picked, setPicked] = useState<SwapOption | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const lastPicked = useRef<string | null>(null)
  // "Back" from the confirm returns focus to the class that was picked.
  useEffect(() => {
    if (picked) { lastPicked.current = picked.section_id; return }
    if (lastPicked.current) listRef.current?.querySelector<HTMLElement>(`[data-section="${lastPicked.current}"]`)?.focus()
  }, [picked])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const current = `${reg.sections?.classes?.name ?? 'this class'}${reg.sections?.label ? ` ${reg.sections.label}` : ''}`

  // Load once when the panel opens; spots are counted fresh from the server each time.
  useEffect(() => {
    let alive = true
    changes.swapOptions(reg.id)
      .then(o => { if (alive) setOptions(o) })
      .catch(e => { if (alive) setLoadErr(e instanceof Error ? e.message : 'Something went wrong') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [reg.id])

  async function confirm() {
    if (!picked) return
    setBusy(true); setErr(null)
    try { await changes.swapSpot(reg.id, picked.section_id); onDone() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong'); setPicked(null) }
    finally { setBusy(false) }
  }

  const name = (o: SwapOption) => `${o.class_name}, ${o.label}`
  return (
    <div className="mt-1">
      <p ref={focusOnMount} tabIndex={-1} className="font-sans text-[15px] font-semibold text-ink mb-1 focus:outline-none">
        Switch {camper} to another class{reg.sections?.week ? ` in Week ${reg.sections.week}` : ''}:
      </p>
      {loadErr && <p role="alert" className="font-sans text-sm text-danger">{loadErr}</p>}
      {!options && !loadErr && <div className="h-14 bg-surface-sunken rounded-[10px] animate-pulse" />}
      {options && options.length === 0 && (
        <p className="font-sans text-[15px] text-ink-muted">No other class that week fits {camper}'s age and grade.</p>
      )}
      {options && options.length > 0 && !picked && (
        <ul ref={listRef} className="border-t border-border">
          {options.map(o => {
            const when = [o.room, o.start_time && formatTimeRange(o.start_time, o.end_time)].filter(Boolean).join(', ')
            return (
              <li key={o.section_id} className="border-b border-border">
                {o.spots_left > 0 ? (
                  <button type="button" data-section={o.section_id} onClick={() => { setPicked(o); setErr(null) }}
                    className="w-full text-left flex items-center gap-2 py-2.5 min-h-14 hover:bg-surface-sunken transition">
                    <span className="flex-1 min-w-0">
                      <span className="block font-sans text-[15.5px] font-semibold text-ink">{name(o)}</span>
                      <span className="block font-sans text-sm text-ink-muted">{when}{when ? ', ' : ''}{o.spots_left} {o.spots_left === 1 ? 'spot' : 'spots'} left</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className="text-ink-muted shrink-0" />
                  </button>
                ) : (
                  <div className="py-2.5">
                    <span className="block font-sans text-[15.5px] font-semibold text-ink-muted">{name(o)} is full</span>
                    <span className="block font-sans text-sm text-ink-muted">To join its waitlist, cancel {camper}'s spot in {current} first.</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {picked && (
        <div className="-mr-4 -ml-16">
          <InlineConfirm
            tone="neutral"
            message={`Move ${camper} from ${current} to ${name(picked)}? The old seat goes to the next family on that waitlist.`}
            confirmLabel={busy ? 'Switching…' : 'Switch class'}
            cancelLabel="Back"
            busy={busy}
            onConfirm={() => { void confirm() }}
            onCancel={() => setPicked(null)}
          />
        </div>
      )}
      {err && <p role="alert" className="mt-1 font-sans text-sm text-danger">{err}</p>}
      {!picked && (
        <button type="button" onClick={onDone} className={`${btnCls} mt-3`}>Keep {current}</button>
      )}
    </div>
  )
}
