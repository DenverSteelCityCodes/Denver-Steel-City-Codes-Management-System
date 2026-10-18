import { useEffect, useId, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CallLink from './CallLink'
import Button from './Button'
import InlineConfirm from './InlineConfirm'
import { Input } from './Field'
import { callLines } from '../lib/campers'
import { firstName, formatTime } from '../lib/campDay'
import { closeAndFocus } from '../lib/focus'
import { leaveChip, releaseLine } from '../lib/pickups'
import type { AssignedStudent } from '../hooks/useAssignedClass'
import type { ReleaseMode, RollCallMark } from '../types/database'

interface Props {
  student: AssignedStudent
  // The camper's dismissal mark (present).
  mark: RollCallMark
  sectionId: string
  day: string
  // Reads the marks again once a release is saved.
  onSaved: () => PromiseLike<void>
}

type Ask = null | { kind: 'alone' } | { kind: 'someone' }

const chipCls = 'min-h-11 px-3 py-1.5 rounded border-2 border-ink text-left leading-tight hover:bg-ink/[0.06] transition-colors aria-disabled:opacity-55 aria-disabled:cursor-progress'

// Dismissal (spec 36): who collected a camper who was present, in one tap. The parent, each adult on
// today's pickup list, and "walking home" when the parent consented for today are one tap each.
// Anyone else, or leaving alone without today's consent, asks the volunteer to check with an admin
// first and is recorded as "admin OK". The database checks the same rules (a trigger on
// roll_call_marks), so a stale screen can't record a release the parent didn't allow.
export default function DismissalRelease({ student, mark, sectionId, day, onSaved }: Props) {
  const { user } = useAuth()
  const first = firstName(student.full_name) || 'this camper'
  const adults = student.pickup_adults ?? []
  const [ask, setAsk] = useState<Ask>(null)
  const [name, setName] = useState('')
  // The admin who said OK (admin_ok releases record it), and the undo being asked about.
  const [okBy, setOkBy] = useState('')
  const [undoing, setUndoing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const labelId = useId()
  const nameId = useId()
  const okId = useId()
  // Openers, for focus to return to when Keep it / Back closes what they opened.
  const undoId = useId()
  const aloneId = useId()
  const someoneId = useId()
  // After a save or an undo, focus lands on what replaced the tapped control.
  const focusNext = useRef(false)
  const lineRef = useRef<HTMLParagraphElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const released = mark.released_mode ?? null
  useEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    if (released) lineRef.current?.focus()
    else groupRef.current?.querySelector('button')?.focus()
  }, [released])

  async function save(mode: ReleaseMode | null, to: string | null, key: string, admin: string | null = null) {
    if (busy || !user) return
    setBusy(key); setErr(null)
    const { error } = await supabase.from('roll_call_marks').upsert({
      section_id: sectionId, student_id: student.id, day, roll_call: 'dismissal', present: true,
      marked_by: user.id, marked_at: new Date().toISOString(), released_mode: mode, released_to: to, released_ok_by: admin,
    }, { onConflict: 'section_id,student_id,day,roll_call' })
    if (error) {
      setBusy(null)
      // P0001 is the database's own reason (not on today's list, no consent for today).
      setErr(error.code === 'P0001' ? error.message : "Couldn't save. Check your connection and try again.")
      return
    }
    focusNext.current = true
    await Promise.resolve(onSaved()).catch(() => {})
    setBusy(null); setAsk(null); setName(''); setOkBy(''); setUndoing(false)
  }

  // "An admin said OK": who is collecting (for "Someone else") and which admin said so, both named.
  function adminOk(e: React.FormEvent) {
    e.preventDefault()
    const typed = name.replace(/\s+/g, ' ').trim()
    const admin = okBy.replace(/\s+/g, ' ').trim()
    if (ask?.kind === 'someone' && !typed) { setErr(`Type the name of the adult collecting ${first}.`); document.getElementById(nameId)?.focus(); return }
    const listed = ask?.kind === 'someone' ? adults.find(a => a.name.toLowerCase() === typed.toLowerCase()) : undefined
    if (listed) { void save('listed_adult', listed.name, 'someone'); return }
    if (!admin) { setErr('Type the name of the admin who said OK.'); document.getElementById(okId)?.focus(); return }
    void save('admin_ok', ask?.kind === 'someone' ? typed : 'On their own', 'admin-ok', admin)
  }

  if (released) {
    const at = mark.marked_at ? formatTime(new Date(mark.marked_at).toTimeString().slice(0, 5)) : ''
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-4">
        <p ref={lineRef} tabIndex={-1} className="flex items-start gap-1.5 font-bold text-success focus:outline-none">
          <CircleCheck size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />
          <span>{releaseLine(released, mark.released_to, mark.released_ok_by)}{at ? ` · ${at}` : ''}</span>
        </p>
        {undoing ? (
          <div className="basis-full mt-2">
            <InlineConfirm tone="neutral"
              message={`Undo? ${first} will show as not collected yet. Only undo a release tapped by mistake.`}
              confirmLabel={busy === 'undo' ? 'Undoing…' : 'Undo release'} cancelLabel="Keep it" busy={busy === 'undo'}
              onConfirm={() => void save(null, null, 'undo')} onCancel={() => closeAndFocus(() => { setUndoing(false); setErr(null) }, undoId)} />
          </div>
        ) : (
          <button type="button" id={undoId} onClick={() => { setUndoing(true); setErr(null) }}
            className="ui-btn ui-btn--text text-ink-muted font-semibold">
            Undo<span className="sr-only">, {first} not collected yet</span>
          </button>
        )}
        {err && <ErrorText>{err}</ErrorText>}
      </div>
    )
  }

  const spin = (key: string) => busy === key && <LoaderCircle size={16} strokeWidth={2.5} className="inline animate-spin mr-1.5 align-[-3px]" aria-hidden="true" />
  const leadPhones = adults.filter(a => a.phone)
  const parent = student.parent_name?.trim() || 'Parent'

  return (
    <div className="mt-1">
      <p id={labelId} className="text-sm font-bold text-ink-muted">Who's collecting {first}?</p>
      <div ref={groupRef} role="group" aria-labelledby={labelId} className="mt-1.5 flex flex-wrap gap-2">
        <button type="button" className={chipCls} aria-disabled={!!busy || undefined} onClick={() => void save('parent', null, 'parent')}>
          {spin('parent')}<span className="font-bold">{parent}</span> <span className="text-sm text-ink-muted">parent</span>
        </button>
        {adults.map((a, i) => (
          <button key={`${a.name}-${i}`} type="button" className={chipCls} aria-disabled={!!busy || undefined}
            onClick={() => void save('listed_adult', a.name, `adult:${a.name}`)}>
            {spin(`adult:${a.name}`)}<span className="font-bold">{a.name}</span>{' '}
            <span className="text-sm text-ink-muted">{a.relation.toLowerCase()}{a.days ? ', today only' : ''}</span>
          </button>
        ))}
        {student.may_leave_alone_today ? (
          <button type="button" className={chipCls} aria-disabled={!!busy || undefined} onClick={() => void save('alone', null, 'alone')}>
            {spin('alone')}<span className="font-bold">{leaveChip(student.leave_alone_mode)}</span>{' '}
            <span className="text-sm text-ink-muted">parent said yes</span>
          </button>
        ) : (
          <button type="button" id={aloneId} className={chipCls} aria-expanded={ask?.kind === 'alone'} aria-disabled={!!busy || undefined}
            onClick={() => { setAsk(a => (a?.kind === 'alone' ? null : { kind: 'alone' })); setErr(null) }}>
            <span className="font-bold">On their own</span>
          </button>
        )}
        <button type="button" id={someoneId} className={chipCls} aria-expanded={ask?.kind === 'someone'} aria-disabled={!!busy || undefined}
          onClick={() => { setAsk(a => (a?.kind === 'someone' ? null : { kind: 'someone' })); setErr(null) }}>
          <span className="font-bold">Someone else</span>
        </button>
      </div>
      {student.may_leave_alone_today && student.leave_alone_note && (
        <p className="mt-1 text-sm text-ink-muted text-pretty">Parent's note: {student.leave_alone_note}</p>
      )}
      {leadPhones.length > 0 && !ask && (
        <div className="flex flex-col items-start">
          {leadPhones.map((a, i) => <CallLink key={`${a.name}-${i}`} call={{ who: `${a.name} (${a.relation.toLowerCase()})`, number: a.phone! }} />)}
        </div>
      )}

      {ask && (
        <form onSubmit={adminOk} noValidate
          className="mt-2 rounded border-2 border-ink p-3">
          {ask.kind === 'someone' && (
            <>
              <label htmlFor={nameId} className="block font-bold mb-1.5">Who's collecting {first}?</label>
              <Input id={nameId} type="text" autoComplete="off" maxLength={100} value={name} autoFocus
                onChange={e => { setName(e.target.value); setErr(null) }} />
            </>
          )}
          <p className="mt-2 flex items-start gap-1.5 font-bold text-pretty">
            <CircleAlert size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />
            <span>
              {ask.kind === 'someone'
                ? `${adults.length ? `${first}'s list today is ${parent} and the adults above.` : `Only ${parent} is on ${first}'s list today.`} Check with an admin first.`
                : `${first}'s parent hasn't said ${first} may leave on their own today. Check with an admin first.`}
            </span>
          </p>
          {callLines(student).map(c => <CallLink key={c.number} call={c} verb />)}
          <label htmlFor={okId} className="block font-bold mt-2 mb-1.5">Which admin said OK?</label>
          <Input id={okId} type="text" autoComplete="off" maxLength={60} value={okBy}
            onChange={e => { setOkBy(e.target.value); setErr(null) }} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => closeAndFocus(() => { setAsk(null); setErr(null); setName(''); setOkBy('') }, ask.kind === 'alone' ? aloneId : someoneId)}>Back</Button>
            <Button type="submit" variant="ink" aria-disabled={!!busy || undefined} aria-busy={!!busy}>
              {busy && <LoaderCircle size={16} strokeWidth={2.5} className="animate-spin" aria-hidden="true" />}
              An admin said OK
            </Button>
          </div>
        </form>
      )}
      {err && <ErrorText>{err}</ErrorText>}
    </div>
  )
}

function ErrorText({ children }: { children: string }) {
  return (
    <p role="alert" className="basis-full mt-1 flex items-start gap-1.5 text-sm font-bold text-danger text-pretty">
      <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{children}
    </p>
  )
}
