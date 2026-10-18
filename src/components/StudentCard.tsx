import { useEffect, useRef, useState } from 'react'
import { CircleCheck, List, CircleX, Pencil, GraduationCap, Check, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GRADES, gradeToAge, realNote } from '../lib/campers'
import { formatTimeRange } from '../lib/campDay'
import type { Student, RegistrationStatus } from '../types/database'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import type { SwapOption } from '../hooks/useMyChanges'
import MedicalFlag from './MedicalFlag'
import InlineConfirm from './InlineConfirm'
import { focusOnMount } from '../lib/focus'

// Human-friendly status copy (DS §7.5 Deep-on-Soft chips, §10 warm voice).
// note: an optional reassuring sub-line shown beneath the chip.
const STATUS_CONFIG: Record<
  RegistrationStatus,
  { label: string; className: string; Icon: LucideIcon; note: string | null }
> = {
  confirmed: { label: 'Confirmed', className: 'bg-success-soft text-success', Icon: CircleCheck, note: null },
  // Registrations auto-confirm (spec 14); a legacy 'pending' row reads as confirmed.
  pending: { label: 'Confirmed', className: 'bg-success-soft text-success', Icon: CircleCheck, note: null },
  waitlisted: { label: 'On waitlist', className: 'bg-info-soft text-info', Icon: List, note: null },
  cancelled: { label: 'Cancelled', className: 'bg-danger-soft text-danger', Icon: CircleX, note: null },
  // A freed seat held for this camper (spec 10); the actions below say how long it's held.
  offered: { label: 'Spot offered', className: 'bg-brand-soft text-warning', Icon: Sparkles, note: null },
}

// Rollup status badge (DS §7.5) that summarizes all of a camper's registrations
// into a single at-a-glance signal — the "is my kid all set?" answer (§2).
function rollupStatus(
  registrations: RegistrationWithSection[],
): { label: string; className: string; Icon: LucideIcon | null } {
  const active = registrations.filter(r => r.status !== 'cancelled')
  if (active.length === 0) {
    return { label: 'Not enrolled', className: 'bg-surface-sunken text-ink-muted', Icon: null }
  }
  if (active.some(r => r.status === 'offered')) {
    return { label: 'Spot offered', className: 'bg-brand-soft text-warning', Icon: Sparkles }
  }
  if (active.every(r => r.status === 'waitlisted')) {
    return { label: 'On waitlist', className: 'bg-info-soft text-info', Icon: List }
  }
  if (active.some(r => r.status === 'waitlisted')) {
    return { label: 'Partly waitlisted', className: 'bg-info-soft text-info', Icon: List }
  }
  return { label: 'All set', className: 'bg-success-soft text-success', Icon: CircleCheck }
}

type CamperPatch = Partial<Omit<Student, 'id' | 'parent_id' | 'created_at'>>

interface Props {
  student: Student
  registrations: RegistrationWithSection[]
  onSave?: (id: string, patch: CamperPatch) => Promise<void>
  // Self-service changes (spec 11). Without these, the card is read-only.
  changes?: {
    deadlines: Map<string, string>
    openRequests: Set<string>
    cancelSpot: (registrationId: string) => Promise<void>
    requestChange: (registrationId: string, message: string) => Promise<void>
    acceptOffer: (registrationId: string) => Promise<void>
    declineOffer: (registrationId: string) => Promise<void>
    swapOptions: (registrationId: string) => Promise<SwapOption[]>
    swapSpot: (registrationId: string, sectionId: string) => Promise<void>
  }
}

// Cancel / leave waitlist before the change deadline; "Request a change" after it (spec 11).
function RegistrationActions({ reg, camper, changes }: { reg: RegistrationWithSection; camper: string; changes: NonNullable<Props['changes']> }) {
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
  if (reg.status === 'cancelled') return null

  const where = `${reg.sections?.classes?.name ?? 'this class'}${reg.sections?.week ? `, Week ${reg.sections.week}` : ''}`
  const deadline = changes.deadlines.get(reg.id)
  const holdsSeat = reg.status === 'confirmed' || reg.status === 'pending'
  // A seat can be cancelled online until the deadline; a waitlist place can always be left.
  // eslint-disable-next-line react-hooks/purity -- a render-time clock read is fine for a deadline label
  const open = !holdsSeat || !deadline || Date.now() < new Date(deadline).getTime()
  const lastDay = deadline
    ? new Date(new Date(deadline).getTime() - 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Denver' })
    : null

  async function run(fn: () => Promise<void>, after: () => void) {
    setBusy(true); setErr(null)
    try { await fn(); after() } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  // A waitlist offer: claim it (confirms at once) or decline it (passes it on). Spec 10.
  if (reg.status === 'offered') {
    const until = reg.offer_expires_at
      ? new Date(reg.offer_expires_at).toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : null
    return (
      <div className="mt-1.5 ml-1 rounded-[10px] border border-brand/40 bg-brand-soft/40 px-3 py-2">
        <p className="text-sm font-sans text-ink">
          <span className="font-semibold">A spot opened up for {camper}!</span>{until ? ` Claim it by ${until} (Denver time), or it goes to the next family.` : ''}
        </p>
        {mode === 'confirm' ? (
          <div className="mt-2 rounded-[10px] overflow-hidden border border-border">
            <InlineConfirm
              message={`Decline the spot in ${where}? It goes to the next family, and ${camper} leaves this waitlist.`}
              confirmLabel="Decline spot"
              cancelLabel="Keep the offer"
              busy={busy}
              onConfirm={() => { void run(() => changes.declineOffer(reg.id), () => setMode('idle')) }}
              onCancel={() => { setMode('idle'); setErr(null) }}
            />
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => { void run(() => changes.acceptOffer(reg.id), () => setMode('idle')) }}
              className="ui-btn ui-btn--primary">
              {busy ? 'Claiming…' : 'Claim the spot'}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode('confirm')}
              className="h-10 px-4 rounded-[8px] border border-border-strong bg-surface text-ink font-sans font-semibold text-sm hover:bg-surface-sunken transition">
              Decline
            </button>
          </div>
        )}
        {err && <p role="alert" className="mt-1 text-xs font-sans text-danger">{err}</p>}
      </div>
    )
  }

  if (sent || changes.openRequests.has(reg.id)) {
    return <p role="status" className="mt-1 ml-1 text-xs font-sans text-ink-muted">Change request sent. The camp will email you.</p>
  }

  return (
    <div className="mt-1.5 ml-1">
      {mode === 'idle' && (
        <div ref={idleRef} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {open && holdsSeat && (
            <button type="button" onClick={() => setMode('switch')} className="min-h-6 text-xs font-sans font-semibold text-ink-muted hover:text-ink underline-offset-2 hover:underline">
              Switch class
            </button>
          )}
          {open ? (
            <button type="button" onClick={() => setMode('confirm')} className="min-h-6 text-xs font-sans font-semibold text-ink-muted hover:text-danger underline-offset-2 hover:underline">
              {holdsSeat ? 'Cancel this spot' : 'Leave the waitlist'}
            </button>
          ) : (
            <button type="button" onClick={() => setMode('request')} className="min-h-6 text-xs font-sans font-semibold text-ink-muted hover:text-ink underline-offset-2 hover:underline">
              Request a change
            </button>
          )}
          {holdsSeat && lastDay && (
            <span className="text-xs font-sans text-ink-faint">
              {open ? `You can switch or cancel online until ${lastDay}.` : `Online changes closed after ${lastDay}.`}
            </span>
          )}
        </div>
      )}
      {mode === 'confirm' && (
        <div className="mt-1 rounded-[10px] overflow-hidden border border-border">
          <InlineConfirm
            message={holdsSeat
              ? `Cancel ${camper}'s spot in ${where}? The seat goes to the next family on the waitlist. You can sign up again later if spots are left.`
              : `Take ${camper} off the waitlist for ${where}?`}
            confirmLabel={holdsSeat ? 'Cancel spot' : 'Leave waitlist'}
            cancelLabel={holdsSeat ? 'Keep spot' : 'Stay on it'}
            busy={busy}
            onConfirm={() => { void run(() => changes.cancelSpot(reg.id), () => setMode('idle')) }}
            onCancel={() => { setMode('idle'); setErr(null) }}
          />
        </div>
      )}
      {mode === 'switch' && (
        <SwitchClass reg={reg} camper={camper} changes={changes} onDone={() => setMode('idle')} />
      )}
      {mode === 'request' && (
        <form
          onSubmit={e => { e.preventDefault(); void run(() => changes.requestChange(reg.id, message), () => { setSent(true); setMode('idle') }) }}
          className="mt-1 space-y-2"
        >
          <label htmlFor={`req-${reg.id}`} className="block text-xs font-sans font-semibold text-ink-muted">What would you like to change about {where}?</label>
          <textarea id={`req-${reg.id}`} rows={2} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} autoFocus
            className="ui-input" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setMode('idle')} className="h-9 px-3 rounded-[8px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition">Cancel</button>
            <button type="submit" disabled={busy || !message.trim()} className="ui-btn ui-btn--primary">{busy ? 'Sending…' : 'Send to the camp'}</button>
          </div>
        </form>
      )}
      {err && <p role="alert" className="mt-1 text-xs font-sans text-danger">{err}</p>}
    </div>
  )
}

// Switch a held seat to another class the same week (spec 12). Only classes with a free seat
// can be picked: a camper holding a seat can't join another waitlist that week (Q-W4).
function SwitchClass({ reg, camper, changes, onDone }: {
  reg: RegistrationWithSection; camper: string; changes: NonNullable<Props['changes']>; onDone: () => void
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

  const name = (o: SwapOption) => `${o.class_name} ${o.label}`
  return (
    <div className="mt-1 rounded-[10px] border border-border bg-surface px-3 py-2.5">
      <p ref={focusOnMount} tabIndex={-1} className="text-xs font-sans font-semibold text-ink-muted mb-2 focus:outline-none">Switch {camper} from {current} to another class{reg.sections?.week ? ` in Week ${reg.sections.week}` : ''}:</p>
      {loadErr && <p role="alert" className="text-xs font-sans text-danger">{loadErr}</p>}
      {!options && !loadErr && <div className="h-10 bg-surface-sunken rounded-[8px] animate-pulse" />}
      {options && options.length === 0 && (
        <p className="text-sm font-sans text-ink-muted">No other class that week fits {camper}'s age and grade.</p>
      )}
      {options && options.length > 0 && !picked && (
        <ul ref={listRef} className="space-y-1.5">
          {options.map(o => {
            const when = [o.days, formatTimeRange(o.start_time, o.end_time), o.room].filter(Boolean).join(' · ')
            return (
              <li key={o.section_id}>
                {o.spots_left > 0 ? (
                  <button type="button" data-section={o.section_id} onClick={() => { setPicked(o); setErr(null) }}
                    className="w-full text-left rounded-[8px] border border-border-strong px-3 py-2 hover:bg-surface-sunken transition">
                    <span className="block text-sm font-sans font-semibold text-ink">{name(o)}</span>
                    <span className="block text-xs font-sans text-ink-muted">{when}{when ? ' · ' : ''}{o.spots_left} {o.spots_left === 1 ? 'spot' : 'spots'} left</span>
                  </button>
                ) : (
                  <div className="rounded-[8px] border border-border px-3 py-2 bg-surface-sunken">
                    <span className="block text-sm font-sans font-semibold text-ink-muted">{name(o)} · Full</span>
                    <span className="block text-xs font-sans text-ink-faint">To join its waitlist you'd need to cancel {camper}'s spot in {current} first.</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {picked && (
        <div className="rounded-[10px] overflow-hidden border border-border">
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
      {err && <p role="alert" className="mt-1 text-xs font-sans text-danger">{err}</p>}
      {!picked && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={onDone} className="h-9 px-3 rounded-[8px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition">Keep {current}</button>
        </div>
      )}
    </div>
  )
}

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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) { setErr("Your camper's first and last name are required"); return }
    if (!form.emergency_contact_name.trim() || !form.emergency_contact_phone.trim()) { setErr('An emergency contact name and phone are required'); return }
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

  const input = 'ui-input'
  const label = 'block font-sans text-xs font-semibold text-ink-muted mb-1'
  const id = (k: string) => `camper-${student.id}-${k}`

  return (
    <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onDone() }} className="px-5 py-4 bg-surface-sunken border-t border-border space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor={id('first')} className={label}>First name</label><input id={id('first')} autoFocus className={input} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
        <div><label htmlFor={id('last')} className={label}>Last name</label><input id={id('last')} className={input} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
        <div>
          <label htmlFor={id('grade')} className={label}>Grade (entering fall)</label>
          <select id={id('grade')} className={input} value={form.grade} onChange={e => set('grade', e.target.value)}>
            <option value="">Select…</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={id('allergies')} className={label}>Allergies / dietary restrictions</label><input id={id('allergies')} className={input} placeholder="None" value={form.allergies} onChange={e => set('allergies', e.target.value)} /></div>
        <div><label htmlFor={id('medical')} className={label}>Medical conditions</label><input id={id('medical')} className={input} placeholder="None" value={form.medical_conditions} onChange={e => set('medical_conditions', e.target.value)} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor={id('ec-name')} className={label}>Emergency contact</label><input id={id('ec-name')} className={input} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
        <div><label htmlFor={id('ec-phone')} className={label}>Their phone</label><input id={id('ec-phone')} type="tel" className={input} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
        <div><label htmlFor={id('ec-rel')} className={label}>Relationship</label><input id={id('ec-rel')} className={input} value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} /></div>
      </div>
      {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-10 px-4 rounded-[8px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition">Cancel</button>
        <button type="submit" disabled={saving} className="ui-btn ui-btn--primary">
          <Check size={15} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

export default function StudentCard({ student, registrations, onSave, changes }: Props) {
  const [editing, setEditing] = useState(false)
  const medicalNote = [
    realNote(student.allergies) && `Allergies: ${realNote(student.allergies)}`,
    (realNote(student.medical_conditions) ?? realNote(student.medical_info)) && `Medical: ${realNote(student.medical_conditions) ?? realNote(student.medical_info)}`,
  ].filter(Boolean).join(' · ')
  const initials = student.full_name
    .split(/\s+/)
    .map(n => n.match(/\p{L}/u)?.[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  const rollup = rollupStatus(registrations)
  const RollupIcon = rollup.Icon

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-role-parent-soft flex items-center justify-center shrink-0">
            <span className="font-sans font-semibold text-sm text-role-parent">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h3 className="font-sans font-semibold text-base text-ink truncate">{student.full_name}</h3>
                <span className="text-xs font-sans text-ink-muted shrink-0">Age {student.age}</span>
                {medicalNote && <MedicalFlag info={medicalNote} />}
              </div>
              {/* Rollup status badge: confirmed → All set, waitlisted → On waitlist, none → Not enrolled */}
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${rollup.className}`}
              >
                {RollupIcon && <RollupIcon size={13} />}
                {rollup.label}
              </span>
            </div>

            {registrations.length === 0 ? (
              <p className="text-sm font-sans text-ink-muted mt-1">Not enrolled in any class yet</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {registrations.map(reg => {
                  // A class the camp cancelled reads differently from one the family dropped.
                  const byCamp = reg.status === 'cancelled' && reg.cancel_reason === 'section_cancelled'
                  const cfg = byCamp ? { ...STATUS_CONFIG.cancelled, label: 'Cancelled by camp' } : STATUS_CONFIG[reg.status]
                  const Icon = cfg.Icon
                  const week = reg.sections?.week
                  return (
                    <li key={reg.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
                        >
                          <Icon size={13} />
                          {cfg.label}
                        </span>
                        <span className="text-sm font-sans text-ink-muted truncate">
                          {reg.sections?.classes?.name ?? '—'}
                          {reg.sections?.label ? ` · ${reg.sections.label}` : ''}
                          {week ? ` · Week ${week}` : ''}
                        </span>
                      </div>
                      {(reg.sections?.start_time || reg.sections?.room) && (
                        <p className="mt-0.5 ml-1 text-xs font-sans text-ink-muted">
                          {[reg.sections.start_time && `${reg.sections.days} · ${formatTimeRange(reg.sections.start_time, reg.sections.end_time)}`, reg.sections.room]
                            .filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {cfg.note && (
                        <p className="mt-0.5 ml-1 text-xs font-sans text-ink-faint">{cfg.note}</p>
                      )}
                      {changes && <RegistrationActions reg={reg} camper={student.first_name ?? student.full_name.split(' ')[0]} changes={changes} />}
                      {byCamp && (
                        <p className="mt-0.5 ml-1 text-xs font-sans text-ink-muted">
                          Sorry, this class was cancelled.{' '}
                          <Link to={`/parent/classes?camper=${student.id}`} className="font-semibold text-ink hover:underline">
                            Pick another class
                          </Link>{' '}
                          (you're first in line for that week's waitlists).
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Footer: per-camper actions (DS §7.1). Ghost Edit + secondary Register; the single gold
          primary (Add camper) lives in the dashboard header. */}
      {editing && <CamperEditor student={student} onSave={onSave} onDone={() => setEditing(false)} />}

      <div className="bg-surface-sunken border-t border-border px-4 sm:px-5 py-3 flex flex-wrap items-center justify-end gap-2">
        {onSave && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-expanded={editing}
            className="h-10 px-3 text-sm font-sans font-semibold text-ink-muted rounded-[8px] hover:bg-surface hover:text-ink flex items-center gap-1.5 transition"
          >
            <Pencil size={14} /> Edit camper
          </button>
        )}
        <Link
          to={`/parent/classes?camper=${student.id}`}
          className="h-10 px-3.5 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[8px] hover:bg-surface-sunken flex items-center gap-1.5 transition shadow-sm"
        >
          <GraduationCap size={14} /> {registrations.some(r => r.status !== 'cancelled') ? 'Register for another class' : 'Register for a class'}
        </Link>
      </div>
    </div>
  )
}
