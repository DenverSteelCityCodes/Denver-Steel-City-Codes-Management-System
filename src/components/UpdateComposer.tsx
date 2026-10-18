import { useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Send, TriangleAlert } from 'lucide-react'
import type { UpdateAudience } from '../types/database'
import { fetchRecipientEmails, type PostInput } from '../hooks/useUpdates'
import { openMailOrCopy } from '../lib/mailto'
import { URGENT_PRESETS } from '../lib/urgent'
import InlineConfirm from './InlineConfirm'
import Button from './Button'

export interface SectionOption { id: string; label: string }

interface Props {
  // Admins pick any audience (and may send an urgent notice); a lead posts to one fixed section.
  // `weeks` are this season's sessions, for the week audiences (spec 34).
  mode: { kind: 'admin'; sections: SectionOption[]; weeks?: SectionOption[] } | { kind: 'lead'; section: SectionOption }
  onPost: (input: PostInput) => Promise<void>
  onCancel?: () => void
  autoFocus?: boolean
}

const MAX = 2000
const NEAR = 1800

// Inline composer (no modal), set on the page: 16px fields, a 52px "Also email" choice row, and a
// 48px Post with Cancel as a text action. "Also email" opens the mail client with the audience in BCC after the
// post is saved; long lists are copied to the clipboard instead. An admin's urgent notice (spec 34) is
// different: the database emails the whole audience at once and the dashboards show it until the end
// of the day, so it asks once, inline, before it goes.
export default function UpdateComposer({ mode, onPost, onCancel, autoFocus = true }: Props) {
  const [audience, setAudience] = useState<UpdateAudience>(mode.kind === 'lead' ? 'section' : 'everyone')
  const [pickedSectionId, setSectionId] = useState('')
  // Derived, not initialised once: admin sections usually arrive after mount, and the select shows
  // the first one, so state must agree with what's on screen.
  const sectionId = mode.kind === 'lead'
    ? mode.section.id
    : mode.sections.some(s => s.id === pickedSectionId) ? pickedSectionId : (mode.sections[0]?.id ?? '')
  const weeks = mode.kind === 'admin' ? mode.weeks ?? [] : []
  const [pickedWeekId, setWeekId] = useState('')
  const weekId = weeks.some(w => w.id === pickedWeekId) ? pickedWeekId : (weeks[0]?.id ?? '')
  const isWeek = audience === 'week_families' || audience === 'week_crew'
  const [body, setBody] = useState('')
  const [alsoEmail, setAlsoEmail] = useState(false)
  const [urgent, setUrgent] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Addresses to copy by hand when neither the mail link nor the clipboard could carry them.
  const [manualEmails, setManualEmails] = useState<string[] | null>(null)

  const sectionLabel = mode.kind === 'lead' ? mode.section.label : mode.sections.find(s => s.id === sectionId)?.label
  const weekLabel = weeks.find(w => w.id === weekId)?.label
  const audienceCopy: Record<UpdateAudience, string> = {
    everyone: "This season's parents and every volunteer",
    parents: "This season's parents",
    volunteers: 'All volunteers',
    section: sectionLabel ? `Families in ${sectionLabel}` : 'One section',
    week_families: weekLabel ? `Families in ${weekLabel}` : "One week's families",
    week_crew: weekLabel ? `Crew in ${weekLabel}` : "One week's crew",
  }
  const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

  // A prewritten start fills an empty message; it never replaces words already typed.
  function applyPreset(text: string) {
    const current = body.trim()
    const isPreset = URGENT_PRESETS.some(p => p.body === current)
    setBody(!current || isPreset ? text : `${current}\n\n${text}`)
    setConfirming(false)
    bodyRef.current?.focus()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) { setErr('Write the update first'); return }
    if (audience === 'section' && !sectionId) { setErr('Pick a section'); return }
    if (isWeek && !weekId) { setErr('Pick a week'); return }
    // An urgent notice emails the whole audience at once: say so, once, before it goes.
    if (urgent && !confirming) { setErr(null); setConfirming(true); return }
    await post(text)
  }

  async function post(text: string) {
    setBusy(true)
    setErr(null)
    setNote(null)
    setManualEmails(null)
    const wasUrgent = urgent
    try {
      await onPost({
        audience, body: text, urgent: wasUrgent,
        section_id: audience === 'section' ? sectionId : null,
        session_id: isWeek ? weekId : null,
      })
    } catch {
      setErr("Couldn't post it. Check your connection and try again.")
      setBusy(false)
      setConfirming(false)
      return
    }
    // The post is saved: clear the composer even if emailing fails, so nobody posts it twice.
    setBody('')
    setAlsoEmail(false)
    setUrgent(false)
    setConfirming(false)
    if (wasUrgent) {
      setNote('Sent. Everyone in this audience gets the email within two minutes, and it shows at the top of their home page until the end of today.')
    } else if (alsoEmail) {
      try {
        const emails = await fetchRecipientEmails(audience, sectionId, weekId)
        const result = await openMailOrCopy(emails, 'Steel City Codes: camp update', text)
        if (result.kind === 'draft_without_recipients') setManualEmails(result.emails)
        setNote(result.kind === 'opened'
          ? `Posted. Your mail app opened with ${emails.length} ${emails.length === 1 ? 'address' : 'addresses'} in BCC.`
          : result.kind === 'copied'
            ? `Posted. ${result.count} addresses copied: paste them into BCC in your mail app.`
            : result.kind === 'draft_without_recipients'
              ? `Posted. Your mail app opened without recipients, so copy these ${result.emails.length} addresses into BCC.`
              : 'Posted. No email addresses found for this audience.')
      } catch {
        setErr("Posted. The email addresses couldn't be fetched, so no email was opened.")
      }
    } else {
      setNote('Posted.')
    }
    setBusy(false)
  }

  const input = 'ui-input'
  const label = 'block font-bold text-ink mb-1.5'

  return (
    <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onCancel?.() }} className="space-y-4">
      {mode.kind === 'admin' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="update-audience">Send to</label>
            <select id="update-audience" className={input} value={audience} onChange={e => { setAudience(e.target.value as UpdateAudience); setConfirming(false) }}>
              <option value="everyone">Everyone this season (parents + volunteers)</option>
              <option value="parents">This season's parents</option>
              <option value="volunteers">All volunteers</option>
              {weeks.length > 0 && <option value="week_families">One week's families</option>}
              {weeks.length > 0 && <option value="week_crew">One week's crew</option>}
              <option value="section">One section's families</option>
            </select>
          </div>
          {isWeek && (
            <div>
              <label className={label} htmlFor="update-week">Week</label>
              <select id="update-week" className={input} value={weekId} onChange={e => { setWeekId(e.target.value); setConfirming(false) }}>
                {weeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </div>
          )}
          {audience === 'section' && (
            <div>
              <label className={label} htmlFor="update-section">Section</label>
              <select id="update-section" className={input} value={sectionId} onChange={e => { setSectionId(e.target.value); setConfirming(false) }}>
                {mode.sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      {mode.kind === 'admin' && (
        <label className={`flex items-start gap-3 min-h-[52px] px-4 py-3 bg-surface border-2 rounded cursor-pointer text-ink ${urgent ? 'border-danger' : 'border-border'}`}>
          <input type="checkbox" className="w-[22px] h-[22px] shrink-0 mt-px" checked={urgent}
            onChange={e => { setUrgent(e.target.checked); setConfirming(false) }} />
          <span>
            <b className={`font-bold inline-flex items-center gap-1.5 ${urgent ? 'text-danger' : ''}`}>
              {urgent && <TriangleAlert size={16} strokeWidth={2.5} aria-hidden="true" />}Urgent safety notice
            </b>
            <span className="block text-ink-muted text-pretty">Emails everyone in this audience right away, even people who turned off announcements, and shows at the top of their home page until the end of today.</span>
          </span>
        </label>
      )}
      {urgent && (
        <div role="group" aria-labelledby="urgent-presets">
          <p id="urgent-presets" className="font-bold text-ink mb-1.5">Start from</p>
          <div className="flex flex-wrap gap-2">
            {URGENT_PRESETS.map(p => (
              <Button key={p.key} onClick={() => applyPreset(p.body)}>{p.label}</Button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className={label} htmlFor="update-body">
          Message
          {mode.kind === 'admin' && <span className="font-normal text-ink-muted"> to {lowerFirst(audienceCopy[audience])}</span>}
        </label>
        <textarea
          id="update-body"
          ref={bodyRef}
          autoFocus={autoFocus}
          rows={4}
          maxLength={MAX}
          value={body}
          onChange={e => { setBody(e.target.value); setConfirming(false) }}
          placeholder={mode.kind === 'lead' ? 'What we did today, what to bring tomorrow…' : 'Pickup reminders, schedule changes, thank-yous…'}
          className="ui-input"
        />
        {/* The limit only matters near it. */}
        {body.length > NEAR && <p className="mt-1 text-right text-sm font-bold text-ink-muted">{body.length} of {MAX} characters</p>}
      </div>
      {!urgent && (
        <label className="flex items-center gap-3 min-h-[52px] px-4 py-2 bg-surface border-2 border-border has-[:checked]:border-ink rounded cursor-pointer text-ink">
          <input type="checkbox" className="w-[22px] h-[22px] shrink-0" checked={alsoEmail} onChange={e => setAlsoEmail(e.target.checked)} />
          <span><b className="font-bold">Also email them</b> <span className="text-ink-muted">(opens your mail app)</span></span>
        </label>
      )}
      {confirming && (
        <InlineConfirm
          message={`Email this urgent notice to ${lowerFirst(audienceCopy[audience])} now? It can't be unsent.`}
          confirmLabel="Send now"
          cancelLabel="Not yet"
          busy={busy}
          onConfirm={() => void post(body.trim())}
          onCancel={() => setConfirming(false)}
        />
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="submit" disabled={busy || !body.trim() || confirming} className="ui-btn ui-btn--primary w-full sm:w-auto">
          {busy ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Send size={18} strokeWidth={2.25} aria-hidden="true" />}
          {busy ? (urgent ? 'Sending…' : 'Posting…') : urgent ? 'Send urgent notice' : 'Post update'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="ui-btn ui-btn--text text-ink-muted">Cancel</button>
        )}
      </div>
      {err && <p role="alert" className="flex items-start gap-1.5 text-sm font-bold text-danger"><CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{err}</p>}
      {note && <p role="status" className="flex items-start gap-1.5 font-bold text-success"><CircleCheck size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />{note}</p>}
      {manualEmails && (
        <textarea
          readOnly
          aria-label="Recipient email addresses"
          rows={3}
          value={manualEmails.join(', ')}
          onFocus={e => e.currentTarget.select()}
          className="ui-input bg-surface-sunken"
        />
      )}
    </form>
  )
}
