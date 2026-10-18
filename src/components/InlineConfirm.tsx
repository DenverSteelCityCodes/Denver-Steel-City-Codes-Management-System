import { useId } from 'react'
import { TriangleAlert } from 'lucide-react'
import Button from './Button'

// In-place confirmation for destructive actions — shown directly under the thing it acts on
// instead of a modal. Cancel is focused first so Enter never deletes by accident.
//
// `frame` is the DESIGN.md › Inline Confirm: a 2px red (or ink) frame with 48px buttons, labelled
// by its sentence. Without it, the older full-width strip that existing rows and cards are built
// around.
export default function InlineConfirm({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  frame = false,
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  // 'neutral' for consequential-but-not-destructive changes (e.g. a role change).
  tone?: 'danger' | 'neutral'
  busy?: boolean
  frame?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const id = useId()
  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
  const spinner = busy && <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />

  if (frame) {
    return (
      <div role="group" aria-labelledby={id} onKeyDown={onKeyDown}
        className={`p-4 rounded border-2 ${tone === 'danger' ? 'border-danger' : 'border-ink'}`}>
        <p id={id} className="font-bold text-pretty">{message}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button autoFocus variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'ink'} onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {spinner}{confirmLabel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      role="alert"
      onKeyDown={onKeyDown}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3 border-t ${
        tone === 'danger' ? 'bg-danger-soft border-danger/30' : 'bg-brand-soft border-brand/30'
      }`}
    >
      <p className={`flex-1 flex items-start gap-2 font-sans text-sm ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>
        <TriangleAlert size={16} className="shrink-0 mt-0.5" />
        <span>{message}</span>
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          autoFocus
          type="button"
          onClick={onCancel}
          className="h-9 px-3.5 rounded-[8px] border border-border-strong bg-surface text-ink font-sans font-semibold text-sm hover:bg-surface-sunken transition"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`h-9 px-3.5 rounded-[8px] font-sans font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 ${
            tone === 'danger' ? 'bg-danger text-surface' : 'bg-brand text-brand-on'
          }`}
        >
          {spinner}
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
