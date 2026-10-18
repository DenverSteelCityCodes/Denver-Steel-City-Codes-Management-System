import { useEffect, useId, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { buttonClass } from '../lib/ui'
import { ErrorLine, hintCls, labelCls } from '../pages/parent/parts'

// "Request an exception" (spec 31): when a class's own rules (grade, prerequisite) refuse a
// camper, the family can ask the camp instead. It opens in place under the class (no modal): one
// question, then the request lands in the admins' change-request queue and the family hears back
// by email. `sent` shows the request already waiting.
export default function ExceptionRequest({ camper, className, sent, onSend, idPrefix }: {
  camper: string
  className: string
  sent: boolean
  onSend: (message: string) => Promise<void>
  idPrefix: string
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const uid = useId()
  const fieldId = `${idPrefix}-${uid}`
  // Closing the question puts focus back on the button that opened it.
  const openerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (!open && wasOpen.current) openerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  if (sent) {
    return (
      <p role="status" className="mt-1 flex items-center gap-1.5 text-sm font-bold text-success">
        <Check size={16} strokeWidth={2.5} aria-hidden="true" /> Exception requested. The camp will email you.
      </p>
    )
  }

  if (!open) {
    return (
      <button ref={openerRef} type="button" onClick={() => setOpen(true)} className={buttonClass('text')}>
        Request an exception
      </button>
    )
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try { await onSend(message.trim()) }
    catch (x) { setErr(x instanceof Error ? x.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={e => { void send(e) }} className="mt-2 space-y-2">
      <label htmlFor={fieldId} className={labelCls}>Why is {camper} ready for {className}?</label>
      <p id={`${fieldId}-hint`} className={hintCls}>For example, a class they took at school. The camp reads every request and emails you.</p>
      <textarea id={fieldId} rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} autoFocus
        aria-describedby={`${fieldId}-hint`} className="ui-input" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setOpen(false); setErr(null) }} className={buttonClass('secondary')}>Cancel</button>
        <button type="submit" disabled={busy || !message.trim()} className={buttonClass('ink')}>{busy ? 'Sending…' : 'Send to the camp'}</button>
      </div>
      {err && <ErrorLine>{err}</ErrorLine>}
    </form>
  )
}
