import { useState } from 'react'
import { CircleAlert, CircleCheck, Send } from 'lucide-react'
import type { UpdateAudience } from '../types/database'
import { fetchRecipientEmails } from '../hooks/useUpdates'
import { openMailOrCopy } from '../lib/mailto'

export interface SectionOption { id: string; label: string }

interface Props {
  // Admins pick any audience; a lead posts to one fixed section.
  mode: { kind: 'admin'; sections: SectionOption[] } | { kind: 'lead'; section: SectionOption }
  onPost: (input: { audience: UpdateAudience; section_id: string | null; body: string }) => Promise<void>
  onCancel?: () => void
  autoFocus?: boolean
}

const MAX = 2000
const NEAR = 1800

// Inline composer (no modal), set on the page: 16px fields, a 52px "Also email" choice row, and a
// 48px Post with Cancel as a text action. "Also email" opens the mail client with the audience in BCC after the
// post is saved; long lists are copied to the clipboard instead. Nothing is sent by the server.
export default function UpdateComposer({ mode, onPost, onCancel, autoFocus = true }: Props) {
  const [audience, setAudience] = useState<UpdateAudience>(mode.kind === 'lead' ? 'section' : 'everyone')
  const [pickedSectionId, setSectionId] = useState('')
  // Derived, not initialised once: admin sections usually arrive after mount, and the select shows
  // the first one, so state must agree with what's on screen.
  const sectionId = mode.kind === 'lead'
    ? mode.section.id
    : mode.sections.some(s => s.id === pickedSectionId) ? pickedSectionId : (mode.sections[0]?.id ?? '')
  const [body, setBody] = useState('')
  const [alsoEmail, setAlsoEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Addresses to copy by hand when neither the mail link nor the clipboard could carry them.
  const [manualEmails, setManualEmails] = useState<string[] | null>(null)

  const sectionLabel = mode.kind === 'lead' ? mode.section.label : mode.sections.find(s => s.id === sectionId)?.label
  const audienceCopy: Record<UpdateAudience, string> = {
    everyone: "This season's parents and every volunteer",
    parents: "This season's parents",
    volunteers: 'All volunteers',
    section: sectionLabel ? `Families in ${sectionLabel}` : 'One section',
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) { setErr('Write the update first'); return }
    if (audience === 'section' && !sectionId) { setErr('Pick a section'); return }
    setBusy(true)
    setErr(null)
    setNote(null)
    setManualEmails(null)
    try {
      await onPost({ audience, section_id: audience === 'section' ? sectionId : null, body: text })
    } catch {
      setErr("Couldn't post it. Check your connection and try again.")
      setBusy(false)
      return
    }
    // The post is saved: clear the composer even if emailing fails, so nobody posts it twice.
    setBody('')
    setAlsoEmail(false)
    if (alsoEmail) {
      try {
        const emails = await fetchRecipientEmails(audience, sectionId)
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
            <select id="update-audience" className={input} value={audience} onChange={e => setAudience(e.target.value as UpdateAudience)}>
              <option value="everyone">Everyone this season (parents + volunteers)</option>
              <option value="parents">This season's parents</option>
              <option value="volunteers">All volunteers</option>
              <option value="section">One section's families</option>
            </select>
          </div>
          {audience === 'section' && (
            <div>
              <label className={label} htmlFor="update-section">Section</label>
              <select id="update-section" className={input} value={sectionId} onChange={e => setSectionId(e.target.value)}>
                {mode.sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      <div>
        <label className={label} htmlFor="update-body">
          Message
          {mode.kind === 'admin' && <span className="font-normal text-ink-muted"> to {audienceCopy[audience].charAt(0).toLowerCase() + audienceCopy[audience].slice(1)}</span>}
        </label>
        <textarea
          id="update-body"
          autoFocus={autoFocus}
          rows={4}
          maxLength={MAX}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={mode.kind === 'lead' ? 'What we did today, what to bring tomorrow…' : 'Pickup reminders, schedule changes, thank-yous…'}
          className="ui-input"
        />
        {/* The limit only matters near it. */}
        {body.length > NEAR && <p className="mt-1 text-right text-sm font-bold text-ink-muted">{body.length} of {MAX} characters</p>}
      </div>
      <label className="flex items-center gap-3 min-h-[52px] px-4 py-2 bg-surface border-2 border-border has-[:checked]:border-ink rounded cursor-pointer text-ink">
        <input type="checkbox" className="w-[22px] h-[22px] shrink-0" checked={alsoEmail} onChange={e => setAlsoEmail(e.target.checked)} />
        <span><b className="font-bold">Also email them</b> <span className="text-ink-muted">(opens your mail app)</span></span>
      </label>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="submit" disabled={busy || !body.trim()} className="ui-btn ui-btn--primary w-full sm:w-auto">
          {busy ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Send size={18} strokeWidth={2.25} aria-hidden="true" />}
          {busy ? 'Posting…' : 'Post update'}
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
