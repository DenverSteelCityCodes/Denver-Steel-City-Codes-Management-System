import { useState } from 'react'
import { Send, Mail } from 'lucide-react'
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

// Inline composer (no modal). "Also email" opens the mail client with the audience in BCC after the
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
    everyone: 'Every parent and volunteer',
    parents: 'All parents',
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't post — try again")
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
            ? `Posted. ${result.count} addresses copied — paste them into BCC in your mail app.`
            : result.kind === 'draft_without_recipients'
              ? `Posted. Your mail app opened without recipients — copy these ${result.emails.length} addresses into BCC.`
              : 'Posted. No email addresses found for this audience.')
      } catch (e) {
        setErr(`Posted. Couldn't fetch email addresses: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    } else {
      setNote('Posted.')
    }
    setBusy(false)
  }

  const input = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition'
  const label = 'block font-sans font-semibold text-sm text-ink mb-1.5'

  return (
    <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onCancel?.() }} className="space-y-3">
      {mode.kind === 'admin' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="update-audience">Send to</label>
            <select id="update-audience" className={input} value={audience} onChange={e => setAudience(e.target.value as UpdateAudience)}>
              <option value="everyone">Everyone (parents + volunteers)</option>
              <option value="parents">All parents</option>
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
          {mode.kind === 'lead' ? `Message to ${mode.section.label} families` : 'Message'}
          {mode.kind === 'admin' && <span className="font-normal text-ink-muted"> · {audienceCopy[audience]}</span>}
        </label>
        <textarea
          id="update-body"
          autoFocus={autoFocus}
          rows={4}
          maxLength={MAX}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={mode.kind === 'lead' ? 'What we did today, what to bring tomorrow…' : 'Pickup reminders, schedule changes, thank-yous…'}
          className="w-full px-3.5 py-2.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand transition resize-y"
        />
        <p className="mt-1 text-right font-sans text-xs text-ink-faint tabular-nums">{body.length}/{MAX}</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <label className="flex items-center gap-2 cursor-pointer font-sans text-sm text-ink">
          <input type="checkbox" className="w-4 h-4 accent-brand" checked={alsoEmail} onChange={e => setAlsoEmail(e.target.checked)} />
          <Mail size={14} className="text-ink-muted" /> Also email
          <span className="text-ink-muted">(opens your mail app)</span>
        </label>
        <div className="flex justify-end gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="h-10 px-4 rounded-[10px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition">
              Cancel
            </button>
          )}
          <button type="submit" disabled={busy || !body.trim()} className="h-10 px-4 rounded-[10px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm flex items-center gap-2 shadow-sm transition disabled:opacity-50">
            {busy ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" /> : <Send size={15} />}
            {busy ? 'Posting…' : 'Post update'}
          </button>
        </div>
      </div>
      {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
      {note && <p role="status" className="font-sans text-sm text-success">{note}</p>}
      {manualEmails && (
        <textarea
          readOnly
          aria-label="Recipient email addresses"
          rows={3}
          value={manualEmails.join(', ')}
          onFocus={e => e.currentTarget.select()}
          className="w-full px-3.5 py-2.5 rounded-[10px] bg-surface-sunken border border-border-strong text-ink font-sans text-xs resize-y"
        />
      )}
    </form>
  )
}
