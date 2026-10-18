import { useId, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, ClipboardPen, MailCheck } from 'lucide-react'
import { useMyIncidents } from '../hooks/useIncidents'
import { INCIDENT_KINDS, INCIDENT_LEVELS, kindLabel, levelLabel } from '../lib/incidents'
import { campInputToISO, formatCampSlot, isoToCampInput } from '../lib/denverTime'
import type { IncidentKind, IncidentLevel } from '../types/database'
import { Input, Select, Textarea } from './Field'
import Button from './Button'
import StatusWord from './StatusWord'

interface Props {
  sectionId: string
  sectionName: string
  // The section's roster (from section_roster()), to name a camper.
  students: { id: string; full_name: string }[]
}

const label = 'block font-bold text-ink mb-1.5'

// A section's incident log for its crew (spec 34): log what happened, inline (no modal), and see
// the entries you logged. Admins see every entry and decide whether to tell the family.
export default function IncidentLog({ sectionId, sectionName, students }: Props) {
  const { incidents, loading, error: loadError, logIncident } = useMyIncidents(sectionId)
  const [open, setOpen] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [kind, setKind] = useState<IncidentKind>('behavior')
  const [level, setLevel] = useState<IncidentLevel>('note')
  const [when, setWhen] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const errRef = useRef<HTMLParagraphElement>(null)
  const id = useId()
  const nameOf = (sid: string | null) => (sid ? students.find(s => s.id === sid)?.full_name ?? 'A camper no longer in this class' : null)

  function start() {
    setOpen(true)
    setSaved(false)
    setError(null)
    setWhen(isoToCampInput(new Date().toISOString()))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const at = campInputToISO(when)
    const fail = (msg: string) => { setError(msg); requestAnimationFrame(() => errRef.current?.focus()) }
    if (!description.trim()) return fail('Describe what happened first.')
    if (!at) return fail('Say when it happened.')
    if (new Date(at).getTime() > Date.now() + 5 * 60_000) return fail("That time hasn't happened yet.")
    setBusy(true)
    setError(null)
    try {
      await logIncident({ student_id: studentId || null, kind, level, occurred_at: at, description })
      setOpen(false)
      setSaved(true)
      setStudentId(''); setKind('behavior'); setLevel('note'); setDescription('')
    } catch {
      fail("Couldn't save it. Check your connection and try again. If it keeps failing, tell an admin in person.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="mt-8">
      <h2 id={`${id}-h`} className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-ink">Incidents</h2>
      <p className="mt-1 max-w-[65ch] text-ink-muted text-pretty">
        An injury, a behavior problem or anything unsafe in {sectionName}. Admins see what you log and decide whether to tell the family. You see only your own entries.
      </p>

      {!open && (
        <Button className="mt-3" onClick={start}><ClipboardPen size={18} strokeWidth={2.25} aria-hidden="true" /> Log an incident</Button>
      )}
      {saved && !open && (
        <p role="status" className="mt-2 flex items-start gap-1.5 font-bold text-success">
          <CircleCheck size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />Saved. An admin can see it now.
        </p>
      )}

      {open && (
        <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape' && !busy) setOpen(false) }} className="mt-4 grid gap-4 max-w-[640px]">
          <div>
            <label className={label} htmlFor={`${id}-camper`}>Camper</label>
            <Select id={`${id}-camper`} value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">No one camper (or more than one)</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </Select>
          </div>
          <div className="grid gap-4 min-[480px]:grid-cols-2">
            <div>
              <label className={label} htmlFor={`${id}-kind`}>What happened</label>
              <Select id={`${id}-kind`} value={kind} onChange={e => setKind(e.target.value as IncidentKind)}>
                {INCIDENT_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </Select>
            </div>
            <div>
              <label className={label} htmlFor={`${id}-level`}>What you did</label>
              <Select id={`${id}-level`} value={level} onChange={e => setLevel(e.target.value as IncidentLevel)}>
                {INCIDENT_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label className={label} htmlFor={`${id}-when`}>When</label>
            <Input id={`${id}-when`} type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor={`${id}-desc`}>Describe it</label>
            <Textarea id={`${id}-desc`} rows={4} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}
              aria-describedby={`${id}-desc-hint`} />
            <p id={`${id}-desc-hint`} className="mt-1 text-sm text-ink-muted">Stick to what you saw and what you did.</p>
          </div>
          {error && (
            <p ref={errRef} tabIndex={-1} role="alert" className="flex items-start gap-1.5 text-sm font-bold text-danger focus:outline-none">
              <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Button type="submit" variant="ink" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : 'Save to the log'}</Button>
            <Button variant="text" className="text-ink-muted" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {loadError && <p role="alert" className="mt-3 text-sm font-bold text-danger">Couldn't load your entries. Reload the page to try again.</p>}
      {!loading && incidents.length > 0 && (
        <>
          <h3 className="mt-6 text-lg font-bold leading-[1.3]">Your entries</h3>
          <ul className="mt-2 border-y-2 border-ink">
            {incidents.map(i => (
              <li key={i.id} className="py-3 border-t border-border first:border-t-0">
                <p className="font-bold">{kindLabel(i.kind)} · {levelLabel(i.level)}</p>
                <p className="text-sm text-ink-muted">{formatCampSlot(i.occurred_at)} · {nameOf(i.student_id) ?? 'No camper named'}</p>
                <p className="mt-1 max-w-[65ch] whitespace-pre-line text-pretty break-words">{i.description}</p>
                {i.parent_notified_at && (
                  <StatusWord tone="ok" icon={MailCheck} className="mt-2">Family told {formatCampSlot(i.parent_notified_at)}</StatusWord>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
