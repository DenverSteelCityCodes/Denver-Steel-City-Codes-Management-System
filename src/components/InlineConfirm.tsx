import { useId } from 'react'
import Button from './Button'

// In-place confirmation (DESIGN.md › Inline Confirm), shown directly under the thing it changes
// instead of a modal: a 2px frame (red when it destroys or takes something away, ink for a
// consequential change), a bold sentence and its 48px buttons. The safe choice comes first and is
// focused, so Enter never deletes by accident; Esc cancels. The group is labelled by its sentence
// (role="group", not an alert: the person asked for this, so it shouldn't interrupt a screen reader).
//
// Callers own where focus goes after Cancel (Season's registration switch hands it back to the
// switch). `frame` is kept so older callers compile; every confirm is framed now.
export default function InlineConfirm({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
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
  const danger = tone === 'danger'
  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }

  return (
    <div role="group" aria-labelledby={id} onKeyDown={onKeyDown}
      className={`p-4 rounded border-2 bg-surface text-ink text-left ${danger ? 'border-danger' : 'border-ink'}`}>
      <p id={id} aria-live="polite" className="font-bold text-pretty max-w-[68ch]">{message}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button autoFocus variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        {/* aria-disabled while busy: a disabled button would drop keyboard focus to the page. */}
        <Button variant={danger ? 'danger' : 'ink'} onClick={() => { if (!busy) onConfirm() }}
          aria-disabled={busy || undefined} aria-busy={busy}>
          {busy && <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
