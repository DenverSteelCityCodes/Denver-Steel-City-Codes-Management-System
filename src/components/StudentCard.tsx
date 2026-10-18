import { useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, CircleX, Clock, Hourglass } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GRADES, gradeToAge, realNote } from '../lib/campers'
import { formatTimeRange } from '../lib/campDay'
import { CAMP_TIME_ZONE } from '../lib/denverTime'
import { buttonClass } from '../lib/ui'
import { camperFirstName, cancelledByCamp, holdsSeat, offerDeadline, type WeekLine } from '../lib/homeDecision'
import type { Student } from '../types/database'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import type { SwapOption } from '../hooks/useMyChanges'
import { Input, Select } from './Field'
import ParentConfirm from './ParentConfirm'
import { focusOnMount } from '../lib/focus'

type CamperPatch = Partial<Omit<Student, 'id' | 'parent_id' | 'created_at'>>

export interface CamperChanges {
  deadlines: Map<string, string>
  openRequests: Set<string>
  cancelSpot: (registrationId: string) => Promise<void>
  requestChange: (registrationId: string, message: string) => Promise<void>
  acceptOffer: (registrationId: string) => Promise<void>
  declineOffer: (registrationId: string) => Promise<void>
  swapOptions: (registrationId: string) => Promise<SwapOption[]>
  swapSpot: (registrationId: string, sectionId: string) => Promise<void>
}

interface Props {
  student: Student
  // One line per week (lib/homeDecision › weekLines).
  lines: WeekLine[]
  // The camper re-confirms their details for this camp year before registering (#42).
  needsReconfirm?: boolean
  // The offer shown in the sign band at the top of Home: the line points there instead of repeating it.
  offerInSign?: string | null
  onSave?: (id: string, patch: CamperPatch) => Promise<void>
  // Self-service changes (spec 11). Without these, the block is read-only.
  changes?: CamperChanges
}

// Text actions that still have a 44px target (DESIGN.md › Buttons › Text link).
const textAction = buttonClass('text', 'text-ink-muted font-semibold')
const textActionStrong = buttonClass('text')

// One status per registration (DESIGN.md › Status Words): done is green, waiting is an ink frame,
// danger is red, plain is muted with no box.
function StatusWord({ tone, icon: Icon, children }: { tone: 'ok' | 'wait' | 'danger' | 'plain'; icon?: LucideIcon; children: string }) {
  const cls = {
    ok: 'bg-success-soft text-success px-2',
    wait: 'text-ink shadow-[inset_0_0_0_2px_var(--color-ink)] px-2',
    danger: 'bg-danger-soft text-danger px-2',
    plain: 'text-ink-muted',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded py-1.5 text-sm font-bold leading-none whitespace-nowrap ${cls}`}>
      {Icon && <Icon size={16} strokeWidth={2.5} aria-hidden="true" />}
      {children}
    </span>
  )
}

// "Oct 4", the last day online changes are open.
const lastDayOf = (deadline: string) => new Date(new Date(deadline).getTime() - 1)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: CAMP_TIME_ZONE })

function Problem({ children }: { children: string }) {
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-bold text-danger">
      <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-0.5" aria-hidden="true" /> {children}
    </p>
  )
}

// What a parent can do with one registration: switch or cancel before the change deadline, leave a
// waitlist, request a change after the deadline, or claim / decline an offer (specs 10–12).
function RegistrationActions({ reg, camper, changes, offerInSign }: { reg: RegistrationWithSection; camper: string; changes: CamperChanges; offerInSign: boolean }) {
  const [mode, setMode] = useState<'idle' | 'confirm' | 'request' | 'switch'>('idle')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  // Closing a panel puts focus back on the line's first action instead of dropping it (L6a).
  const idleRef = useRef<HTMLDivElement>(null)
  const prevMode = useRef(mode)
  useEffect(() => {
    if (mode === 'idle' && prevMode.current !== 'idle') idleRef.current?.querySelector('button')?.focus()
    prevMode.current = mode
  }, [mode])

  const where = `${reg.sections?.classes?.name ?? 'this class'}${reg.sections?.week ? `, Week ${reg.sections.week}` : ''}`
  const deadline = changes.deadlines.get(reg.id)
  const seat = holdsSeat(reg)
  // A seat can be changed online until the deadline; a waitlist place can always be left.
  // eslint-disable-next-line react-hooks/purity -- a render-time clock read is fine for a deadline label
  const open = !seat || !deadline || Date.now() < new Date(deadline).getTime()

  async function run(fn: () => Promise<void>, after: () => void) {
    setBusy(true); setErr(null)
    try { await fn(); after() } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  // A waitlist offer (spec 10). The first one lives in the sign at the top of Home.
  if (reg.status === 'offered') {
    const until = reg.offer_expires_at ? offerDeadline(reg.offer_expires_at) : null
    return (
      <div>
        <p className="mt-1 text-sm text-ink-muted">
          Held for {camper}{until ? ` until ${until}` : ''}. After that it goes to the next family on the waitlist.
        </p>
        {offerInSign ? (
          <a href="#offer" className={textActionStrong}>Claim or decline it</a>
        ) : mode === 'confirm' ? (
          <ParentConfirm
            message={`Decline the spot in ${where}? It goes to the next family on the waitlist.`}
            confirmLabel="Decline the spot" cancelLabel="Keep the offer" busy={busy}
            onConfirm={() => { void run(() => changes.declineOffer(reg.id), () => setMode('idle')) }}
            onCancel={() => { setMode('idle'); setErr(null) }}
          />
        ) : (
          <div ref={idleRef} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" disabled={busy} onClick={() => { void run(() => changes.acceptOffer(reg.id), () => setMode('idle')) }} className={buttonClass('ink')}>
              {busy ? 'Claiming…' : `Claim ${camper}'s spot`}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode('confirm')} className={textAction}>Decline</button>
          </div>
        )}
        {err && <Problem>{err}</Problem>}
      </div>
    )
  }

  if (sent || changes.openRequests.has(reg.id)) {
    return (
      <p role="status" className="mt-2 flex items-start gap-1.5 text-sm font-bold">
        <Check size={16} strokeWidth={2.5} className="shrink-0 mt-0.5 text-success" aria-hidden="true" /> Change request sent. The camp will email you.
      </p>
    )
  }

  return (
    <div>
      {seat && deadline && mode === 'idle' && (
        <p className="mt-1 text-sm text-ink-muted">
          {open ? `You can switch or cancel online until ${lastDayOf(deadline)}.` : `Online changes closed ${lastDayOf(deadline)}.`}
        </p>
      )}
      {!seat && mode === 'idle' && (
        <p className="mt-1 text-sm text-ink-muted text-pretty">If a seat opens, we hold it for {camper} and it shows here with a time to claim it by.</p>
      )}
      {mode === 'idle' && (
        <div ref={idleRef} className="flex flex-wrap items-center gap-x-5">
          {open && seat && <button type="button" onClick={() => setMode('switch')} className={textAction}>Switch class</button>}
          {open
            ? <button type="button" onClick={() => setMode('confirm')} className={textAction}>{seat ? 'Cancel this spot' : 'Leave the waitlist'}</button>
            : <button type="button" onClick={() => setMode('request')} className={textActionStrong}>Request a change</button>}
        </div>
      )}
      {mode === 'confirm' && (
        <ParentConfirm
          message={seat
            ? `Cancel ${camper}'s spot in ${where}? The seat goes to the next family on the waitlist. You can sign up again later if seats are left.`
            : `Take ${camper} off the waitlist for ${where}? Their place in line goes to the next family.`}
          confirmLabel={seat ? 'Cancel the spot' : 'Leave the waitlist'}
          cancelLabel={seat ? 'Keep the spot' : 'Keep their place'}
          busy={busy}
          onConfirm={() => { void run(() => changes.cancelSpot(reg.id), () => setMode('idle')) }}
          onCancel={() => { setMode('idle'); setErr(null) }}
        />
      )}
      {mode === 'switch' && <SwitchClass reg={reg} camper={camper} changes={changes} onDone={() => setMode('idle')} />}
      {mode === 'request' && (
        <form
          onSubmit={e => { e.preventDefault(); void run(() => changes.requestChange(reg.id, message), () => { setSent(true); setMode('idle') }) }}
          className="mt-3"
        >
          <label htmlFor={`req-${reg.id}`} className="block font-bold mb-1.5">What would you like to change about {where}?</label>
          <textarea id={`req-${reg.id}`} rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} autoFocus className="ui-input" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !message.trim()} className={buttonClass('ink')}>{busy ? 'Sending…' : 'Send to the camp'}</button>
            <button type="button" onClick={() => setMode('idle')} className={buttonClass('secondary')}>Cancel</button>
          </div>
        </form>
      )}
      {err && <Problem>{err}</Problem>}
    </div>
  )
}

// Switch a held seat to another class the same week (spec 12). Only classes with a free seat
// can be picked: a camper holding a seat can't join another waitlist that week (Q-W4).
function SwitchClass({ reg, camper, changes, onDone }: {
  reg: RegistrationWithSection; camper: string; changes: CamperChanges; onDone: () => void
}) {
  const [options, setOptions] = useState<SwapOption[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [picked, setPicked] = useState<SwapOption | null>(null)
  // "Back" from the confirm returns focus to the class that was picked.
  const listRef = useRef<HTMLUListElement>(null)
  const lastPicked = useRef<string | null>(null)
  useEffect(() => {
    if (picked) { lastPicked.current = picked.section_id; return }
    if (lastPicked.current) listRef.current?.querySelector<HTMLElement>(`[data-section="${lastPicked.current}"]`)?.focus()
  }, [picked])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const current = reg.sections?.classes?.name ?? 'this class'

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

  return (
    <div className="mt-3 p-4 border-2 border-ink rounded">
      <p ref={focusOnMount} tabIndex={-1} className="font-bold focus:outline-none">
        Switch {camper} from {current} to another class{reg.sections?.week ? ` in Week ${reg.sections.week}` : ''}
      </p>
      {loadErr && <Problem>{loadErr}</Problem>}
      {!options && !loadErr && <div className="mt-3 h-12 bg-surface-sunken rounded animate-pulse" />}
      {options && options.length === 0 && (
        <p className="mt-2 text-ink-muted">No other class that week fits {camper}'s grade.</p>
      )}
      {options && options.length > 0 && !picked && (
        <ul ref={listRef} className="mt-3 grid gap-2">
          {options.map(o => {
            const when = [o.days, formatTimeRange(o.start_time, o.end_time), o.room].filter(Boolean).join(' · ')
            return (
              <li key={o.section_id}>
                {o.spots_left > 0 ? (
                  <button type="button" data-section={o.section_id} onClick={() => { setPicked(o); setErr(null) }}
                    className="w-full min-h-[52px] text-left px-4 py-2 bg-surface border-2 border-border hover:border-ink rounded transition-colors">
                    <span className="block font-bold">{o.class_name}</span>
                    <span className="block text-sm text-ink-muted">{when}{when ? ' · ' : ''}{o.spots_left} {o.spots_left === 1 ? 'spot' : 'spots'} left</span>
                  </button>
                ) : (
                  <div className="px-4 py-2 border-2 border-dashed border-border-strong rounded">
                    <span className="block font-bold">{o.class_name} · Full</span>
                    <span className="block text-sm text-ink-muted">To join its waitlist you'd need to cancel {camper}'s spot in {current} first.</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {picked && (
        <ParentConfirm
          tone="neutral"
          message={`Move ${camper} from ${current} to ${picked.class_name}? The old seat goes to the next family on that waitlist.`}
          confirmLabel={busy ? 'Switching…' : 'Switch class'}
          cancelLabel="Back"
          busy={busy}
          onConfirm={() => { void confirm() }}
          onCancel={() => setPicked(null)}
        />
      )}
      {err && <Problem>{err}</Problem>}
      {!picked && (
        <button type="button" onClick={onDone} className={buttonClass('secondary', 'mt-3')}>Keep {current}</button>
      )}
    </div>
  )
}

const fieldLabel = 'block font-bold mb-1.5'

// Inline editor for the details parents actually change mid-year (name, grade, health, emergency
// contact). The full yearly review still happens in the registration flow.
function CamperEditor({ student, onSave, onDone }: { student: Student; onSave: Props['onSave']; onDone: () => void }) {
  const [first, ...rest] = student.full_name.split(' ')
  const [form, setForm] = useState({
    first_name: student.first_name ?? first ?? '',
    last_name: student.last_name ?? rest.join(' '),
    grade: student.grade ?? '',
    allergies: student.allergies ?? '',
    medical_conditions: student.medical_conditions ?? student.medical_info ?? '',
    emergency_contact_name: student.emergency_contact_name ?? '',
    emergency_contact_phone: student.emergency_contact_phone ?? '',
    emergency_contact_relation: student.emergency_contact_relation ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const name = camperFirstName(student)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) { setErr(`Enter ${name}'s first and last name.`); return }
    if (!form.emergency_contact_name.trim() || !form.emergency_contact_phone.trim()) { setErr("Enter an emergency contact's name and phone."); return }
    setSaving(true)
    setErr(null)
    try {
      const age = gradeToAge(form.grade)
      await onSave?.(student.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
        grade: form.grade || null,
        ...(age ? { age } : {}),
        allergies: form.allergies.trim() || null,
        medical_conditions: form.medical_conditions.trim() || null,
        medical_info: form.medical_conditions.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        emergency_contact_relation: form.emergency_contact_relation.trim() || null,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const id = (k: string) => `camper-${student.id}-${k}`
  const pair = 'grid gap-5 min-[480px]:grid-cols-2 min-[480px]:gap-4'

  return (
    <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onDone() }} aria-label={`Edit ${name}'s details`} className="mt-3 pt-4 pb-2 border-t border-border grid gap-5">
      <div className={pair}>
        <div><label htmlFor={id('first')} className={fieldLabel}>First name</label><Input id={id('first')} autoFocus autoComplete="off" value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
        <div><label htmlFor={id('last')} className={fieldLabel}>Last name</label><Input id={id('last')} autoComplete="off" value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
      </div>
      <div>
        <label htmlFor={id('grade')} className={fieldLabel}>Grade this fall</label>
        <Select id={id('grade')} value={form.grade} onChange={e => set('grade', e.target.value)}>
          <option value="">Select…</option>
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </Select>
      </div>
      <div>
        <label htmlFor={id('allergies')} className={fieldLabel}>Allergies or dietary needs</label>
        <p id={id('allergies-h')} className="-mt-1 mb-1.5 text-sm text-ink-muted">Write None if there aren't any.</p>
        <Input id={id('allergies')} aria-describedby={id('allergies-h')} value={form.allergies} onChange={e => set('allergies', e.target.value)} />
      </div>
      <div>
        <label htmlFor={id('medical')} className={fieldLabel}>Medical conditions</label>
        <p id={id('medical-h')} className="-mt-1 mb-1.5 text-sm text-ink-muted">Write None if there aren't any.</p>
        <Input id={id('medical')} aria-describedby={id('medical-h')} value={form.medical_conditions} onChange={e => set('medical_conditions', e.target.value)} />
      </div>
      <div><label htmlFor={id('ec-name')} className={fieldLabel}>Emergency contact</label><Input id={id('ec-name')} autoComplete="off" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
      <div className={pair}>
        <div><label htmlFor={id('ec-phone')} className={fieldLabel}>Their phone</label><Input id={id('ec-phone')} type="tel" autoComplete="off" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
        <div><label htmlFor={id('ec-rel')} className={fieldLabel}>Relationship</label><Input id={id('ec-rel')} autoComplete="off" value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} /></div>
      </div>
      {err && <Problem>{err}</Problem>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" disabled={saving} className={buttonClass('ink')}>{saving ? 'Saving…' : `Save ${name}'s details`}</button>
        <button type="button" onClick={onDone} className={textAction}>Cancel</button>
      </div>
    </form>
  )
}

// One week line: the week, one status word, then class · days and time · room, then its actions.
function Line({ line, student, needsReconfirm, offerInSign, changes }: {
  line: WeekLine; student: Student; needsReconfirm: boolean; offerInSign: string | null; changes?: CamperChanges
}) {
  const name = camperFirstName(student)
  const reg = line.reg
  const pick = `/parent/classes?camper=${student.id}`
  if (!reg) {
    return (
      <li className="grid grid-cols-[5rem_1fr] gap-x-3 py-1 border-t border-border items-center">
        <span className="text-sm font-extrabold whitespace-nowrap">{line.label}</span>
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <StatusWord tone="plain">Not registered</StatusWord>
          <Link to={pick} className={textActionStrong}>{needsReconfirm ? `Review ${name}'s details` : `Register ${name}`}</Link>
        </div>
      </li>
    )
  }
  const sec = reg.sections
  const camp = cancelledByCamp(reg)
  const status = camp
    ? <StatusWord tone="danger" icon={CircleX}>Cancelled by camp</StatusWord>
    : holdsSeat(reg) ? <StatusWord tone="ok" icon={Check}>Confirmed</StatusWord>
    : reg.status === 'offered' ? <StatusWord tone="wait" icon={Clock}>Spot offered</StatusWord>
    : <StatusWord tone="wait" icon={Hourglass}>On the waitlist</StatusWord>
  // The line wraps between pieces, never inside the time: "Web Development · Mon–Fri 9:00 AM – 3:00 PM
  // · Room 202" stays readable on a 375px screen.
  const range = sec?.start_time ? formatTimeRange(sec.start_time, sec.end_time) : ''
  const parts: ReactNode[] = [
    sec?.classes?.name ?? 'Class',
    range ? <>{sec.days} <span className="whitespace-nowrap">{range}</span></> : null,
    sec?.room ? <span className="whitespace-nowrap">{sec.room}</span> : null,
  ].filter(Boolean)
  return (
    <li className="grid grid-cols-[5rem_1fr] gap-x-3 pt-3 pb-1 border-t border-border">
      <span className="text-sm font-extrabold whitespace-nowrap pt-1.5">{line.label}</span>
      <div className="min-w-0">
        {status}
        <p className="mt-1.5">
          {parts.map((p, i) => (
            <span key={i}>{p}{i < parts.length - 1 && <span className="text-ink-muted px-[0.35em]">·</span>}{i < parts.length - 1 ? ' ' : ''}</span>
          ))}
        </p>
        {camp ? (
          <>
            <p className="mt-1 text-sm text-ink-muted text-pretty">Sorry, the camp cancelled this class. You're first in line for that week's waitlists.</p>
            <Link to={pick} className={textActionStrong}>Pick another class</Link>
          </>
        ) : changes ? (
          <RegistrationActions reg={reg} camper={name} changes={changes} offerInSign={offerInSign === reg.id} />
        ) : <div className="pb-2" />}
      </div>
    </li>
  )
}

// A camper on Home (DESIGN.md › Camper block with its week strip): name, grade, health on file, then
// one line per week. No avatar disc, no rollup badge: each week says its own status once.
export default function StudentCard({ student, lines, needsReconfirm = false, offerInSign = null, onSave, changes }: Props) {
  const [editing, setEditing] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const name = camperFirstName(student)
  const allergies = realNote(student.allergies)
  const medical = realNote(student.medical_conditions) ?? realNote(student.medical_info)
  const healthId = `camper-${student.id}-health`

  return (
    <li id={`camper-${student.id}`} className="pt-4 pb-1 border-t-2 border-ink scroll-mt-32 md:scroll-mt-24">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold leading-[1.3]">{student.full_name}</h3>
          <p className="flex flex-wrap items-center text-sm text-ink-muted">
            <span>{student.grade ? `Entering ${student.grade}` : `Age ${student.age}`}</span>
            {(allergies || medical) && (
              <>
                <span className="px-[0.35em]" aria-hidden="true">·</span>
                <button type="button" onClick={() => setHealthOpen(o => !o)} aria-expanded={healthOpen} aria-controls={healthId}
                  className="inline-flex items-center min-h-11 underline underline-offset-[3px] decoration-1">
                  Health info on file
                </button>
              </>
            )}
          </p>
        </div>
        {onSave && !editing && (
          <button type="button" onClick={() => setEditing(true)} aria-expanded={editing} className={`${textAction} -mt-2.5 min-w-11 justify-end`}>
            Edit<span className="sr-only"> {name}'s details</span>
          </button>
        )}
      </div>
      {healthOpen && (allergies || medical) && (
        <div id={healthId} className="mb-2">
          {allergies && <p><b>Allergies:</b> {allergies}</p>}
          {medical && <p><b>Medical:</b> {medical}</p>}
          <p className="mt-1 text-sm text-ink-muted">Shared with your camper's volunteers and camp admins only.</p>
        </div>
      )}
      {editing && <CamperEditor student={student} onSave={onSave} onDone={() => setEditing(false)} />}
      <ul className="mt-1">
        {lines.map(line => (
          <Line key={line.key} line={line} student={student} needsReconfirm={needsReconfirm} offerInSign={offerInSign} changes={changes} />
        ))}
      </ul>
    </li>
  )
}
