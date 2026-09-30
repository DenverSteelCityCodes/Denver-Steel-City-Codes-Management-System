import { TriangleAlert } from 'lucide-react'

// In-place confirmation strip for destructive actions — shown directly under the row it acts on
// instead of a modal. Cancel is focused first so Enter never deletes by accident.
export default function InlineConfirm({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      role="alert"
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3 bg-danger-soft border-t border-danger/30"
    >
      <p className="flex-1 flex items-start gap-2 font-sans text-sm text-danger">
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
          className="h-9 px-3.5 rounded-[8px] bg-danger text-white font-sans font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
        >
          {busy && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
