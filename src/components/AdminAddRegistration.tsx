import { useEffect, useMemo, useRef, useState } from 'react'
import Button from './Button'
import Segmented from './Segmented'
import { Input, Select } from './Field'
import { supabase } from '../lib/supabase'
import { GRADES } from '../lib/campers'

// Campers › Add registration (spec 32): an inline panel, never a modal. Late, walk-in, phone and
// lost-form sign-ups go through admin_register(), which runs the parents' rules. Each rule the
// admin skips is ticked here and named with a reason; both land in History. A full class puts the
// camper on the waitlist unless the admin confirms over capacity.

export interface AddSection {
  id: string
  label: string
  class_name: string
  week: number | null
}

interface Family {
  id: string
  display_name: string
  role: string
  email: string
  campers: { id: string; full_name: string; age: number; grade: string | null; school_name: string | null }[]
}
interface Failure { rule: string; message: string }
interface Match { id: string; full_name: string; age: number; grade: string | null; school_name: string | null; parent_id: string; parent_name: string | null; why: string }
type Source = 'late' | 'walk_in' | 'phone' | 'recovery'

const SOURCES: { value: Source; label: string }[] = [
  { value: 'late', label: 'Late' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'recovery', label: 'Lost form' },
]
const NEW = 'new'
const blankCamper = { first: '', last: '', age: '', grade: '', school: '' }

export default function AdminAddRegistration({ id, sections, onClose, onDone }: {
  id: string
  sections: AddSection[]
  onClose: () => void
  // A registration was added: the page reloads its campers and seat counts.
  onDone: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const noteRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => { heading.current?.focus() }, [])

  const [email, setEmail] = useState('')
  const [family, setFamily] = useState<Family | null>(null)
  const [noAccount, setNoAccount] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [camperId, setCamperId] = useState<string>('')
  const [camper, setCamper] = useState(blankCamper)
  const [sectionId, setSectionId] = useState('')
  const [source, setSource] = useState<Source>('late')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  // The note sits above the form, out of view after Register on a phone: take focus to it.
  useEffect(() => { if (note) noteRef.current?.focus() }, [note])

  const fail = (text: string) => { setError(text); setBusy(null) }

  async function findFamily(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setNote(null); setFamily(null); setNoAccount(false); setCamperId(''); setCamper(blankCamper)
    if (!email.trim()) return fail('Enter the family’s email address.')
    await loadFamily()
  }

  // Looks the family up again, keeping any message (after an invite or a new camper). Only the
  // latest lookup for the email in the box counts: editing the email drops an answer in flight,
  // so a camper can never be attached to the family of an email that's no longer there.
  const lookup = useRef(0)
  async function loadFamily() {
    const n = ++lookup.current
    setBusy('find')
    const { data, error } = await supabase.rpc('admin_find_parent', { p_email: email.trim() })
    if (n !== lookup.current) return
    if (error) return fail(error.message)
    const found = (data as Family[] | null)?.[0] ?? null
    setFamily(found)
    setNoAccount(!found)
    setCamperId(found && found.campers.length > 0 ? '' : NEW)
    setBusy(null)
  }

  async function invite() {
    setError(null); setBusy('invite')
    const { data, error } = await supabase.functions.invoke('admin-invite-parent', {
      body: { email: email.trim(), display_name: inviteName.trim(), phone: invitePhone.trim() },
    })
    if (error) {
      const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
      return fail(body?.error ?? 'Couldn’t create the account. Try again.')
    }
    setNote(data?.invited
      ? `Invite sent to ${email.trim()}. They set a password from the email.`
      : `Account created for ${email.trim()}. The invite email couldn’t be sent, so tell them to use “Forgot password”.`)
    await loadFamily()
  }

  // Possible duplicates before a new camper is created (spec 14b), as the name is typed. Results
  // are kept with the inputs they answer, so stale ones are never shown, and a new camper can't
  // be registered until the check for the name in the boxes has come back.
  const isNew = camperId === NEW
  const [matchTry, setMatchTry] = useState(0)
  const matchKey = isNew && camper.last.trim().length >= 2 ? [camper.first, camper.last, camper.grade, camper.school, matchTry].join('|') : null
  const [found, setFound] = useState<{ key: string; rows: Match[]; failed: boolean }>({ key: '', rows: [], failed: false })
  const matchesIn = found.key === matchKey
  const matches = matchesIn ? found.rows : []
  const matchFailed = matchesIn && found.failed
  useEffect(() => {
    if (!matchKey) return
    const t = setTimeout(() => {
      void supabase.rpc('admin_camper_matches', {
        p_first: camper.first, p_last: camper.last, p_grade: camper.grade || null, p_school: camper.school || null,
      }).then(({ data, error }) => setFound({ key: matchKey, rows: (data as Match[] | null) ?? [], failed: !!error }))
    }, 300)
    return () => clearTimeout(t)
  }, [matchKey, camper.first, camper.last, camper.grade, camper.school])
  const duplicatesChecked = !isNew || (matchesIn && !found.failed)

  // Which rules this sign-up breaks, for the camper and class picked now. Ticks reset with them.
  const age = Number(camper.age)
  const ready = !!sectionId && (camperId ? (!isNew || age > 0) : false)
  // Bumped when Register is refused for a rule: the rules changed since the preview (registration
  // closed, the class filled), so the preview runs again and shows the new ones to tick.
  const [recheck, setRecheck] = useState(0)
  const checkKey = ready ? [sectionId, camperId, isNew ? age : '', isNew ? camper.grade : '', recheck].join('|') : null
  const [checked, setChecked] = useState<{ key: string; failures: Failure[] }>({ key: '', failures: [] })
  const failures = checked.key === checkKey ? checked.failures : null
  const [ticks, setTicks] = useState<{ key: string | null; rules: Set<string> }>({ key: null, rules: new Set() })
  const skipped = ticks.key === checkKey ? ticks.rules : new Set<string>()
  const tick = (rule: string, on: boolean) => {
    const next = new Set(skipped)
    if (on) next.add(rule); else next.delete(rule)
    setTicks({ key: checkKey, rules: next })
  }
  useEffect(() => {
    if (!checkKey) return
    let live = true
    void supabase.rpc('admin_registration_check', isNew
      ? { p_section_id: sectionId, p_age: age, p_grade: camper.grade || null }
      : { p_section_id: sectionId, p_student_id: camperId },
    ).then(({ data, error }) => {
      if (!live) return
      if (error) { setError(error.message); return }
      setChecked({ key: checkKey, failures: (data as Failure[] | null) ?? [] })
    })
    return () => { live = false }
  }, [checkKey, isNew, sectionId, camperId, age, camper.grade])

  const unnamed = (failures ?? []).filter(f => f.rule !== 'capacity' && !skipped.has(f.rule))
  const full = failures?.some(f => f.rule === 'capacity') ?? false
  const canRegister = ready && failures !== null && unnamed.length === 0 && duplicatesChecked && reason.trim().length >= 3 && !busy

  async function register(e: React.FormEvent) {
    e.preventDefault()
    if (!family) return
    setError(null); setNote(null); setBusy('register')
    const { data, error } = await supabase.rpc('admin_register', {
      p_parent_email: family.email,
      p_student_id: isNew ? null : camperId,
      p_student: isNew ? { first_name: camper.first, last_name: camper.last, age, grade: camper.grade || null, school_name: camper.school || null } : null,
      p_section_id: sectionId,
      p_source: source,
      p_reason: reason.trim(),
      p_overrides: [...skipped],
    })
    if (error) {
      if (error.hint?.startsWith('rules:')) setRecheck(n => n + 1)
      return fail(error.hint?.startsWith('rules:') ? `${error.message}. The rules changed since the check: tick the ones listed below again.` : error.message)
    }
    const row = (data as { status: string; student_id: string }[])[0]
    const who = isNew ? `${camper.first.trim()} ${camper.last.trim()}` : family.campers.find(c => c.id === camperId)?.full_name
    const where = sections.find(s => s.id === sectionId)
    setNote(`${who} is ${row.status === 'waitlisted' ? 'on the waitlist for' : 'signed up for'} ${where?.class_name} · ${where?.label}${where?.week ? ` (Week ${where.week})` : ''}. The family’s email is queued.`)
    setBusy(null)
    setSectionId(''); setReason('')
    // The new camper now has an id: refresh the family so the next sign-up can pick them.
    if (isNew) { setCamper(blankCamper); await loadFamily() }
    onDone()
  }

  const byWeek = useMemo(() => {
    const weeks = new Map<string, AddSection[]>()
    for (const s of [...sections].sort((a, b) => (a.week ?? 9) - (b.week ?? 9) || a.class_name.localeCompare(b.class_name))) {
      const k = s.week ? `Week ${s.week}` : 'No week'
      weeks.set(k, [...(weeks.get(k) ?? []), s])
    }
    return [...weeks]
  }, [sections])

  const label = 'block font-bold mb-1.5'
  return (
    <section id={id} aria-labelledby={`${id}-h`} onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      className="mb-8 p-4 sm:p-5 rounded border-2 border-ink bg-surface">
      <h2 id={`${id}-h`} ref={heading} tabIndex={-1} className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] focus:outline-none">
        Add a registration
      </h2>
      <p className="mt-1 text-ink-muted text-pretty max-w-[60ch]">
        For late, walk-in, phone and lost-form sign-ups. The parents’ rules still apply: tick each one you’re skipping, and say why.
      </p>

      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 font-bold text-danger text-pretty focus:outline-none">{error}</p>}
      {note && <p ref={noteRef} tabIndex={-1} role="status" className="mt-4 font-bold text-pretty scroll-mt-32 focus:outline-none">{note}</p>}

      <form onSubmit={findFamily} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-[1_1_260px] min-w-0 max-w-[420px]">
          <label htmlFor={`${id}-email`} className={label}>Family’s email</label>
          <Input id={`${id}-email`} type="email" autoComplete="off" value={email}
            onChange={e => {
              lookup.current++
              setEmail(e.target.value); setFamily(null); setNoAccount(false)
              setBusy(b => (b === 'find' ? null : b))
            }} />
        </div>
        <Button type="submit" variant="ink" disabled={busy === 'find'}>{busy === 'find' ? 'Finding…' : 'Find family'}</Button>
      </form>

      {noAccount && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="font-bold">No account uses this email.</p>
          <p className="text-sm text-ink-muted text-pretty">Create one and send an invite. The sign-up is attached to it.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 max-w-[640px]">
            <div>
              <label htmlFor={`${id}-pname`} className={label}>Parent’s name</label>
              <Input id={`${id}-pname`} value={inviteName} onChange={e => setInviteName(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${id}-pphone`} className={label}>Phone <span className="font-normal text-ink-muted">(optional)</span></label>
              <Input id={`${id}-pphone`} type="tel" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} />
            </div>
          </div>
          <Button className="mt-3" variant="ink" onClick={() => { void invite() }} disabled={busy === 'invite' || !inviteName.trim()}>
            {busy === 'invite' ? 'Creating…' : 'Create account and invite'}
          </Button>
        </div>
      )}

      {family && (
        <form onSubmit={register} className="mt-4 pt-4 border-t border-border">
          <p className="font-bold">
            {family.display_name} <span className="font-normal text-ink-muted">· {family.email}{family.role !== 'parent' ? ` · ${family.role} account` : ''}</span>
          </p>

          <fieldset className="mt-3">
            <legend className="font-bold">Camper</legend>
            <div className="mt-1 grid gap-x-6 sm:grid-cols-2">
              {family.campers.map(c => (
                <label key={c.id} className="flex items-start gap-3 min-h-11 py-1.5 cursor-pointer">
                  <input type="radio" name={`${id}-camper`} className="w-5 h-5 mt-0.5 shrink-0" checked={camperId === c.id} onChange={() => setCamperId(c.id)} />
                  <span>
                    <span className="block font-bold">{c.full_name}</span>
                    <span className="block text-sm text-ink-muted">Age {c.age}{c.grade ? ` · ${c.grade}` : ''}{c.school_name ? ` · ${c.school_name}` : ''}</span>
                  </span>
                </label>
              ))}
              <label className="flex items-start gap-3 min-h-11 py-1.5 cursor-pointer">
                <input type="radio" name={`${id}-camper`} className="w-5 h-5 mt-0.5 shrink-0" checked={isNew} onChange={() => setCamperId(NEW)} />
                <span className="font-bold">A new camper</span>
              </label>
            </div>
          </fieldset>

          {isNew && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div><label htmlFor={`${id}-first`} className={label}>First name</label>
                <Input id={`${id}-first`} required value={camper.first} onChange={e => setCamper(c => ({ ...c, first: e.target.value }))} /></div>
              <div><label htmlFor={`${id}-last`} className={label}>Last name</label>
                <Input id={`${id}-last`} required value={camper.last} onChange={e => setCamper(c => ({ ...c, last: e.target.value }))} /></div>
              <div><label htmlFor={`${id}-age`} className={label}>Age</label>
                <Input id={`${id}-age`} required type="number" inputMode="numeric" min={5} max={17} value={camper.age} onChange={e => setCamper(c => ({ ...c, age: e.target.value }))} /></div>
              <div><label htmlFor={`${id}-grade`} className={label}>Grade this fall</label>
                <Select id={`${id}-grade`} value={camper.grade} onChange={e => setCamper(c => ({ ...c, grade: e.target.value }))}>
                  <option value="">Not given</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </Select></div>
              <div><label htmlFor={`${id}-school`} className={label}>School</label>
                <Input id={`${id}-school`} value={camper.school} onChange={e => setCamper(c => ({ ...c, school: e.target.value }))} /></div>
            </div>
          )}

          {matchFailed && (
            <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-bold text-danger text-pretty">Couldn’t check for campers already on file.</p>
              <Button variant="text" onClick={() => setMatchTry(n => n + 1)}>Check again</Button>
            </div>
          )}
          {isNew && matches.length > 0 && (
            <div role="status" className="mt-3 p-3 rounded border-2 border-ink">
              <p className="font-bold">Already on file? Check before adding a new camper.</p>
              <ul className="mt-1">
                {matches.map(m => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                    <span><strong>{m.full_name}</strong>, age {m.age}{m.grade ? ` · ${m.grade}` : ''}{m.school_name ? ` · ${m.school_name}` : ''}
                      <span className="text-ink-muted"> · {m.parent_id === family.id ? 'this family' : `parent ${m.parent_name ?? 'unknown'}`} · {m.why}</span></span>
                    {m.parent_id === family.id && <Button variant="text" onClick={() => setCamperId(m.id)}>Use this camper</Button>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 max-w-[520px]">
            <label htmlFor={`${id}-section`} className={label}>Class</label>
            <Select id={`${id}-section`} value={sectionId} onChange={e => setSectionId(e.target.value)}>
              <option value="">Pick a class</option>
              {byWeek.map(([week, list]) => (
                <optgroup key={week} label={week}>
                  {list.map(s => <option key={s.id} value={s.id}>{s.class_name} · {s.label}</option>)}
                </optgroup>
              ))}
            </Select>
          </div>

          {failures && failures.length === 0 && <p className="mt-3 text-pretty">No rules stand in the way. They’ll be confirmed.</p>}
          {failures && failures.length > 0 && (
            <fieldset className="mt-3">
              <legend className="font-bold">Rules this sign-up breaks</legend>
              {failures.map(f => (
                <label key={f.rule} className="flex items-start gap-3 min-h-11 py-1.5 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 mt-0.5 shrink-0" checked={skipped.has(f.rule)}
                    onChange={e => tick(f.rule, e.target.checked)} />
                  <span className="text-pretty">
                    <span className="block font-bold">{f.rule === 'capacity' ? 'Confirm over capacity' : 'Skip this rule'}</span>
                    <span className="block text-sm text-ink-muted">{f.message}</span>
                  </span>
                </label>
              ))}
              {full && !skipped.has('capacity') && <p className="text-sm text-ink-muted">They’ll join the waitlist, behind everyone already on it.</p>}
            </fieldset>
          )}

          <div className="mt-4">
            <p id={`${id}-source`} className="font-bold mb-1.5">How it came in</p>
            <Segmented mode="radio" labelledBy={`${id}-source`} value={source} onChange={setSource} options={SOURCES} />
          </div>
          <div className="mt-4 max-w-[640px]">
            <label htmlFor={`${id}-reason`} className={label}>Reason, for History</label>
            <Input id={`${id}-reason`} required minLength={3} maxLength={300} value={reason} onChange={e => setReason(e.target.value)}
              aria-describedby={`${id}-reason-hint`} />
            <p id={`${id}-reason-hint`} className="mt-1 text-sm text-ink-muted">E.g. “Paid at the door on Monday” or “Form lost; mom called”.</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <Button type="submit" variant="primary" disabled={!canRegister}>
              {busy === 'register' ? 'Registering…' : full && !skipped.has('capacity') ? 'Add to waitlist' : 'Register'}
            </Button>
            <Button variant="text" onClick={onClose}>Close</Button>
            {ready && unnamed.length > 0 && <p className="text-sm text-ink-muted">Tick each rule you’re skipping to register.</p>}
            {ready && unnamed.length === 0 && isNew && !duplicatesChecked && !matchFailed && (
              <p className="text-sm text-ink-muted">Checking for campers already on file…</p>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
