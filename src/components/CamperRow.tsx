import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, GraduationCap, Lock, Repeat } from 'lucide-react'
import InlineConfirm from './InlineConfirm'
import ExceptionRequest from './ExceptionRequest'
import LaptopLoanLine from './LaptopLoanLine'
import { focusOnMount } from '../lib/focus'
import { formatTimeRange } from '../lib/campDay'
import { buttonClass } from '../lib/ui'
import { byCamp, camperFirstName, holdsSeat, rollup, weekName, type Tone } from '../lib/parentHome'
import { isCourseRuleError, repeatNote } from '../lib/courseRules'
import { ErrorLine, StatusWord, hintCls, labelCls, rowCls, type StatusTone } from '../pages/parent/parts'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import { exceptionKey, type SwapOption } from '../hooks/useMyChanges'
import type { Laptops } from '../hooks/useMyLaptops'
import type { Session, Student } from '../types/database'

// Parent self-service changes (spec 11, 12, 10, 31). Each call refetches the registrations after.
export interface Changes {
  deadlines: Map<string, string>
  openRequests: Set<string>
  // Open exception requests, as exceptionKey(student, section) (spec 31).
  exceptions: Set<string>
  cancelSpot: (registrationId: string) => Promise<void>
  requestChange: (registrationId: string, message: string) => Promise<void>
  requestException: (studentId: string, sectionId: string, message: string) => Promise<void>
  setPlaceWith: (registrationId: string, placeWith: string) => Promise<void>
  swapOptions: (registrationId: string) => Promise<SwapOption[]>
  swapSpot: (registrationId: string, sectionId: string) => Promise<void>
}

// The camper's one-word status as a DESIGN.md status word: done is green, waiting and "needs you"
// are ink frames (a class the camp cancelled is attention, not red: nothing is unsafe).
const TONE: Record<Tone, StatusTone> = { ok: 'ok', wait: 'wait', offer: 'offer', danger: 'attention', none: 'plain' }

const textBtn = buttonClass('text')
const btnCls = buttonClass('secondary')

// One row per camper on Home: name, one status, and each week's class. Tapping it opens the class
// details and the change actions in place (no modal), with the same inline confirmations as before.
export default function CamperRow({ student, regs, sessions, leadNames, changes, laptops, open, onToggle }: {
  student: Student
  regs: RegistrationWithSection[]
  sessions: Session[]
  leadNames: Map<string, string>
  changes: Changes
  // Each week's loaner laptop (spec 29); left out, the laptop lines aren't shown.
  laptops?: Laptops
  open: boolean
  onToggle: () => void
}) {
  const first = camperFirstName(student)
  const status = rollup(regs)
  const panelId = `camper-${student.id}`

  const line = (r: RegistrationWithSection) => {
    const cls = r.sections?.classes?.name ?? 'a class'
    if (byCamp(r)) return <>{weekName(r, sessions)}: the camp cancelled <strong className="font-bold text-ink">{cls}</strong></>
    if (!holdsSeat(r)) return <>{weekName(r, sessions)}: <strong className="font-bold text-ink">{cls}</strong></>
    const lead = leadNames.get(r.section_id)
    return <>{weekName(r, sessions)}: <strong className="font-bold text-ink">{cls}</strong>{r.sections?.room ? `, ${r.sections.room}` : ''}{lead ? ` with ${lead}` : ''}</>
  }

  // A row of the campers list (DESIGN.md › Rows): name at row weight, each week's class, one status
  // word. It opens in place; nothing here is a card or a disc.
  return (
    <li className={rowCls}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId}
        className="w-full text-left flex items-start gap-3 py-3.5 min-h-16 hover:bg-ink/[0.04] transition-colors">
        <span className="flex-1 min-w-0">
          <span className="block text-lg font-bold leading-snug">{student.full_name}</span>
          <span className="block text-ink-muted leading-normal mt-0.5">
            {regs.length === 0 ? 'Not in a class yet' : regs.map(r => <span key={r.id} className="block">{line(r)}</span>)}
          </span>
        </span>
        <span className="shrink-0 mt-px"><StatusWord tone={TONE[status.tone]}>{status.label}</StatusWord></span>
        <ChevronDown size={20} strokeWidth={2.25} aria-hidden="true" className={`shrink-0 mt-1 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={panelId} className="pb-4">
          {regs.map(r => (
            <RegistrationBlock key={r.id} reg={r} others={regs.filter(o => o.id !== r.id)} camper={first} studentId={student.id}
              sessions={sessions} changes={changes} laptops={laptops} showName={regs.length > 1} />
          ))}
          <Link to={`/parent/classes?camper=${student.id}`} className={`${btnCls} mt-3`}>
            <GraduationCap size={20} strokeWidth={2.25} aria-hidden="true" /> {regs.length ? 'Add another week' : `Find a class for ${first}`}
          </Link>
        </div>
      )}
    </li>
  )
}

function RegistrationBlock({ reg, others, camper, studentId, sessions, changes, laptops, showName }: {
  reg: RegistrationWithSection; others: RegistrationWithSection[]; camper: string; studentId: string; sessions: Session[]; changes: Changes; laptops?: Laptops; showName: boolean
}) {
  const sec = reg.sections
  const where = `${sec?.classes?.name ?? 'this class'}, ${weekName(reg, sessions)}`
  const time = sec?.start_time ? `${sec.days}, ${formatTimeRange(sec.start_time, sec.end_time)}` : null
  return (
    <div className="py-3 border-t border-border first:border-t-0 first:pt-0">
      {showName && <p className="font-bold">{where}</p>}
      {byCamp(reg) ? (
        <p className="text-ink-muted mt-0.5 text-pretty">
          Sorry, the camp cancelled this class. You're first in line for that week's waitlists.{' '}
          <Link to={`/parent/classes?camper=${studentId}`} className={textBtn}>Pick another class</Link>
        </p>
      ) : reg.status === 'offered' ? (
        <p className="text-ink-muted mt-0.5">A spot opened up. Claim or decline it at the top of Home.</p>
      ) : (
        <>
          {holdsSeat(reg)
            ? <p className="text-ink-muted mt-0.5">{[sec?.label, time].filter(Boolean).join(', ')}{!time ? '. Times and room will be posted here.' : ''}</p>
            : <p className="text-ink-muted mt-0.5">We'll email you if a spot opens.</p>}
          {reg.place_with && (
            <p className="text-ink-muted mt-0.5 text-pretty">Placement request: <span className="font-bold text-ink">{reg.place_with}</span></p>
          )}
          <RegistrationActions reg={reg} others={others} camper={camper} where={where} changes={changes} />
          {holdsSeat(reg) && laptops && <LaptopLoanLine registrationId={reg.id} camper={camper} where={where} laptops={laptops} />}
        </>
      )}
    </div>
  )
}

// Cancel / leave the waitlist before the change deadline; "Request a change" after it (spec 11).
// The "place with" request can be changed until the deadline too (spec 31).
function RegistrationActions({ reg, others, camper, where, changes }: { reg: RegistrationWithSection; others: RegistrationWithSection[]; camper: string; where: string; changes: Changes }) {
  const [mode, setMode] = useState<'idle' | 'confirm' | 'request' | 'switch' | 'place'>('idle')
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

  const [placeWith, setPlaceWith] = useState('')
  const deadline = changes.deadlines.get(reg.id)
  const seat = holdsSeat(reg)
  // A seat can be cancelled online until the deadline; a waitlist place can always be left.
  // eslint-disable-next-line react-hooks/purity -- a render-time clock read is fine for a deadline label
  const open = !seat || !deadline || Date.now() < new Date(deadline).getTime()
  // The "place with" request follows the change deadline for every live spot (spec 31).
  // eslint-disable-next-line react-hooks/purity -- a render-time clock read is fine for a deadline label
  const placeOpen = !deadline || Date.now() < new Date(deadline).getTime()
  const lastDay = deadline
    ? new Date(new Date(deadline).getTime() - 1).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver' })
    : null

  async function run(fn: () => Promise<void>, after: () => void) {
    setBusy(true); setErr(null)
    try { await fn(); after() } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  if (sent || changes.openRequests.has(reg.id)) {
    return (
      <p role="status" className="mt-1 flex items-center gap-1.5 text-sm font-bold text-success">
        <Check size={16} strokeWidth={2.5} aria-hidden="true" /> Change request sent. The camp will email you.
      </p>
    )
  }

  return (
    <div className="mt-1">
      {mode === 'idle' && (
        <>
          <div ref={idleRef} className="flex flex-wrap items-center gap-x-6">
            {open && seat && <button type="button" onClick={() => setMode('switch')} className={textBtn}>Switch class</button>}
            {open
              ? <button type="button" onClick={() => setMode('confirm')} className={textBtn}>{seat ? 'Cancel this spot' : 'Leave the waitlist'}</button>
              : <button type="button" onClick={() => setMode('request')} className={textBtn}>Request a change</button>}
            {placeOpen && (
              <button type="button" onClick={() => { setPlaceWith(reg.place_with ?? ''); setMode('place') }} className={textBtn}>
                {reg.place_with ? 'Change placement request' : 'Ask to be placed with someone'}
              </button>
            )}
          </div>
          {seat && lastDay && (
            <p className="text-sm text-ink-muted">
              {open ? `You can switch or cancel online until ${lastDay}.` : `Online changes closed after ${lastDay}. The camp can still help.`}
            </p>
          )}
        </>
      )}
      {mode === 'confirm' && (
        <div className="mt-2">
          <InlineConfirm
            frame
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
      {mode === 'switch' && <SwitchClass reg={reg} others={others} camper={camper} changes={changes} onDone={() => setMode('idle')} />}
      {mode === 'place' && (
        <form
          onSubmit={e => { e.preventDefault(); void run(() => changes.setPlaceWith(reg.id, placeWith), () => setMode('idle')) }}
          className="mt-2 space-y-2"
        >
          <label htmlFor={`place-${reg.id}`} className={labelCls}>A friend or sibling to place {camper} with</label>
          <p id={`place-${reg.id}-hint`} className={hintCls}>Their name. The camp reads every request but can't promise a placement. Leave it blank to remove it.</p>
          <input id={`place-${reg.id}`} type="text" maxLength={100} value={placeWith} onChange={e => setPlaceWith(e.target.value)} autoFocus
            aria-describedby={`place-${reg.id}-hint`} className="ui-input" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setMode('idle'); setErr(null) }} className={btnCls}>Cancel</button>
            <button type="submit" disabled={busy} className={buttonClass('ink')}>{busy ? 'Saving…' : 'Save request'}</button>
          </div>
        </form>
      )}
      {mode === 'request' && (
        <form
          onSubmit={e => { e.preventDefault(); void run(() => changes.requestChange(reg.id, message), () => { setSent(true); setMode('idle') }) }}
          className="mt-2 space-y-2"
        >
          <label htmlFor={`req-${reg.id}`} className={labelCls}>What would you like to change about {where}?</label>
          <textarea id={`req-${reg.id}`} rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} autoFocus
            className="ui-input" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode('idle')} className={btnCls}>Cancel</button>
            <button type="submit" disabled={busy || !message.trim()} className={buttonClass('ink')}>{busy ? 'Sending…' : 'Send to the camp'}</button>
          </div>
        </form>
      )}
      {err && <ErrorLine className="mt-2">{err}</ErrorLine>}
    </div>
  )
}

// Switch a held seat to another class the same week (spec 12). Only classes with a free seat can be
// picked: a camper holding a seat can't join another waitlist that week (Q-W4). Classes the camper
// doesn't fit stay in the list, greyed out with the reason; when it's the class's own rules (grade,
// prerequisite) the family can ask for an exception instead (spec 31).
function SwitchClass({ reg, others, camper, changes, onDone }: { reg: RegistrationWithSection; others: RegistrationWithSection[]; camper: string; changes: Changes; onDone: () => void }) {
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
  // The class the database refused under its own rules (a race with an admin's edit), if any.
  const [ruleRefused, setRuleRefused] = useState<SwapOption | null>(null)
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
    setBusy(true); setErr(null); setRuleRefused(null)
    try { await changes.swapSpot(reg.id, picked.section_id); onDone() }
    catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      if (isCourseRuleError(e)) setRuleRefused(picked)
      setPicked(null)
    }
    finally { setBusy(false) }
  }

  // Same course in the camper's other week this year: a warning, never a block (spec 31).
  const repeatFor = (o: SwapOption) => {
    const same = others.find(x => holdsSeat(x) && x.year === reg.year && x.sections?.class_id === o.class_id &&
      x.sections.week != null && x.sections.week !== reg.sections?.week)
    return same?.sections?.week ? repeatNote(o.class_name, same.sections.week, o.next_class_name) : null
  }
  const exceptionUI = (o: SwapOption) => (
    <ExceptionRequest camper={camper} className={o.class_name} idPrefix={`swap-exc-${o.section_id}`}
      sent={changes.exceptions.has(exceptionKey(reg.student_id, o.section_id))}
      onSend={m => changes.requestException(reg.student_id, o.section_id, m)} />
  )
  // Classes that can be picked first, then full ones, then the ones the camper doesn't fit.
  const rank = (o: SwapOption) => (o.blocked_reason ? 2 : o.spots_left > 0 ? 0 : 1)
  const sorted = options ? [...options].sort((a, b) => rank(a) - rank(b)) : null

  const name = (o: SwapOption) => `${o.class_name}, ${o.label}`
  return (
    <div className="mt-1">
      <p ref={focusOnMount} tabIndex={-1} className="font-bold mb-2 focus:outline-none">
        Switch {camper} to another class{reg.sections?.week ? ` in Week ${reg.sections.week}` : ''}:
      </p>
      {loadErr && <ErrorLine>{loadErr}</ErrorLine>}
      {!options && !loadErr && <div className="h-14 bg-surface-sunken rounded animate-pulse" />}
      {sorted && sorted.length === 0 && (
        <p className="text-ink-muted">No other class runs that week.</p>
      )}
      {sorted && sorted.length > 0 && !picked && (
        <ul ref={listRef} className="border-y-2 border-ink">
          {sorted.map(o => {
            const when = [o.room, o.start_time && formatTimeRange(o.start_time, o.end_time)].filter(Boolean).join(', ')
            const repeat = repeatFor(o)
            return (
              <li key={o.section_id} className={rowCls}>
                {o.blocked_reason ? (
                  <div className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-ink-muted">{name(o)}</span>
                        <span className="block text-sm text-ink-muted text-pretty">{o.blocked_reason}</span>
                      </span>
                      <Lock size={16} strokeWidth={2.5} aria-hidden="true" className="text-ink-muted shrink-0" />
                    </div>
                    {o.rule_blocked && exceptionUI(o)}
                  </div>
                ) : o.spots_left > 0 ? (
                  <button type="button" data-section={o.section_id} onClick={() => { setPicked(o); setErr(null); setRuleRefused(null) }}
                    className="w-full text-left flex items-center gap-2 py-2.5 min-h-14 hover:bg-ink/[0.04] transition-colors">
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold">{name(o)}</span>
                      <span className="block text-sm text-ink-muted">{when}{when ? ', ' : ''}{o.spots_left} {o.spots_left === 1 ? 'spot' : 'spots'} left</span>
                      {repeat && (
                        <span className="mt-1 flex items-start gap-1.5 text-sm font-bold text-pretty">
                          <Repeat size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-px" />{repeat}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" className="text-ink-muted shrink-0" />
                  </button>
                ) : (
                  <div className="py-2.5">
                    <span className="block font-bold text-ink-muted">{name(o)} is full</span>
                    <span className="block text-sm text-ink-muted">To join its waitlist, cancel {camper}'s spot in {current} first.</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {picked && (
        <div>
          <InlineConfirm
            frame
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
      {err && <ErrorLine className="mt-2">{err}</ErrorLine>}
      {ruleRefused && exceptionUI(ruleRefused)}
      {!picked && (
        <button type="button" onClick={onDone} className={`${btnCls} mt-3`}>Keep {current}</button>
      )}
    </div>
  )
}
