import { buttonClass } from '../lib/ui'

// Inline confirm for the parent pages (DESIGN.md › Inline Confirm): it sits directly under the thing
// it changes, framed in 2px, with a bold sentence and two 48px buttons. Keep is focused first so
// Enter never cancels a seat by accident. `sign` is the variant that sits on the gold sign band.
export default function ParentConfirm({
  message, confirmLabel, cancelLabel, tone = 'danger', busy = false, onConfirm, onCancel,
}: {
  message: string
  confirmLabel: string
  cancelLabel: string
  tone?: 'danger' | 'neutral' | 'sign'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const frame = tone === 'danger' ? 'border-danger' : tone === 'sign' ? 'border-brand-on' : 'border-ink'
  const keep = tone === 'sign' ? buttonClass('secondary', 'border-brand-on text-brand-on') : buttonClass('secondary')
  const go = tone === 'sign'
    ? buttonClass('danger', 'bg-[#B3261E] dark:bg-[#A8221B] border-transparent text-white')
    : buttonClass(tone === 'danger' ? 'danger' : 'ink')
  return (
    <div role="alert" onKeyDown={e => { if (e.key === 'Escape') onCancel() }} className={`mt-3 p-4 border-2 rounded ${frame}`}>
      <p className="font-bold text-pretty">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" autoFocus onClick={onCancel} className={keep}>{cancelLabel}</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={go}>{confirmLabel}</button>
      </div>
    </div>
  )
}
