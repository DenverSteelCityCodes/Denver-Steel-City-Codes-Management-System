import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CircleAlert, Clock, MailCheck } from 'lucide-react'
import { useAdminIncidents, type AdminIncident } from '../hooks/useIncidents'
import { kindLabel, levelLabel, overdueParentNotice } from '../lib/incidents'
import { formatCampSlot } from '../lib/denverTime'
import { h2Class } from './AdminPageHead'
import { Textarea } from './Field'
import Button from './Button'
import StatusWord from './StatusWord'

// The incident log for admins (spec 34), on the attendance page: every entry the crews logged,
// newest first, and "Tell the family", which emails the camper's parent in the admin's own words
// (never the crew's description) and records when. An entry with a camper and no word to the family
// after a day is also an attention item.
export default function AdminIncidents() {
  const { incidents, loading, error, notifyParent } = useAdminIncidents()
  const untold = incidents.filter(i => i.student_id && !i.parent_notified_at).length
  // The attention item links here (#incidents): land on the heading once the list is in.
  const { hash } = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (hash === '#incidents' && !loading) {
      headingRef.current?.scrollIntoView({ block: 'start' })
      headingRef.current?.focus()
    }
  }, [hash, loading])

  return (
    <section id="incidents" aria-labelledby="incidents-h" className="mt-10 scroll-mt-24">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="incidents-h" ref={headingRef} tabIndex={-1} className={`${h2Class} focus:outline-none`}>Incidents</h2>
        {!loading && incidents.length > 0 && (
          <span className="text-sm text-ink-muted">
            {incidents.length} logged{untold > 0 ? ` · ${untold} ${untold === 1 ? 'family' : 'families'} not told yet` : ''}
          </span>
        )}
      </div>
      <p className="mt-1 max-w-[65ch] text-ink-muted text-pretty">What the crews logged, newest first. Crew see only their own entries.</p>
      {error && <p role="alert" title={error} className="mt-3 font-bold text-danger">Couldn't load the incident log. Reload the page to try again.</p>}
      {loading ? (
        <div className="mt-3 h-24 rounded bg-surface-sunken animate-pulse" aria-busy="true" aria-label="Loading incidents" />
      ) : incidents.length === 0 && !error ? (
        <p className="mt-3 py-3 border-y-2 border-ink text-ink-muted">Nothing logged yet.</p>
      ) : (
        <ul className="mt-3 border-y-2 border-ink">
          {incidents.map(i => <Entry key={i.id} incident={i} onNotify={notifyParent} />)}
        </ul>
      )}
    </section>
  )
}

function Entry({ incident: i, onNotify }: { incident: AdminIncident; onNotify: (id: string, message: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const openRef = useRef<HTMLButtonElement>(null)
  const sec = i.sections
  const where = sec ? `${sec.classes?.name ?? 'Class'} ${sec.label}${sec.week ? `, Week ${sec.week}` : ''}` : 'A section'
  const msgId = `incident-msg-${i.id}`

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await onNotify(i.id, message)
      setOpen(false)
      setMessage('')
    } catch (e) {
      setError(e instanceof Error && /already|no camper|no parent/i.test(e.message) ? e.message : "Couldn't send it. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="py-4 border-t border-border first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-[1.3]">{kindLabel(i.kind)} · {levelLabel(i.level)}</p>
          <p className="text-sm text-ink-muted text-pretty">
            {i.students?.full_name ?? (i.student_id ? 'A camper' : 'No camper named')} · {where} · {formatCampSlot(i.occurred_at)}
            {' '}· logged by {i.reporter?.display_name ?? 'a former volunteer'}
          </p>
        </div>
        {i.parent_notified_at ? (
          <StatusWord tone="ok" icon={MailCheck}>Family told {formatCampSlot(i.parent_notified_at)}</StatusWord>
        ) : i.student_id ? (
          <StatusWord tone={overdueParentNotice(i) ? 'waiting' : 'plain'} icon={Clock}>Family not told yet</StatusWord>
        ) : null}
      </div>
      <p className="mt-2 max-w-[65ch] whitespace-pre-line text-pretty break-words">{i.description}</p>

      {i.student_id && !i.parent_notified_at && !open && (
        <Button ref={openRef} variant="text" className="mt-1" onClick={() => setOpen(true)}>Tell the family</Button>
      )}
      {open && (
        <div role="group" aria-label={`Tell ${i.students?.full_name ?? 'the camper'}'s family`}
          onKeyDown={e => { if (e.key === 'Escape' && !busy) { setOpen(false); requestAnimationFrame(() => openRef.current?.focus()) } }}
          className="mt-3 p-4 rounded border-2 border-ink bg-surface max-w-[640px]">
          <label htmlFor={msgId} className="block font-bold mb-1.5">Message to the family</label>
          <Textarea id={msgId} rows={4} maxLength={1000} autoFocus value={message} onChange={e => setMessage(e.target.value)}
            aria-describedby={`${msgId}-hint`} />
          <p id={`${msgId}-hint`} className="mt-1 text-sm text-ink-muted text-pretty">
            The email says what kind of incident it was, the day and the class, then your message. The crew's description isn't sent.
          </p>
          {error && (
            <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-bold text-danger">
              <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Button variant="ink" disabled={busy} aria-busy={busy} onClick={() => void send()}>{busy ? 'Sending…' : 'Email the family'}</Button>
            <Button variant="text" className="text-ink-muted" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </li>
  )
}
