import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'

interface ConfirmOptions {
  title: string
  body: string
  confirmLabel?: string
}

// Promise-based confirm for destructive actions:
//   const { confirm, dialog } = useConfirm()
//   if (await confirm({ title, body })) await deleteThing()
//   …render {dialog} once in the page.
export function useConfirm() {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  function confirm(opts: ConfirmOptions) {
    return new Promise<boolean>(resolve => setPending({ ...opts, resolve }))
  }

  function close(ok: boolean) {
    pending?.resolve(ok)
    setPending(null)
  }

  const dialog = pending && (
    <div className="fixed inset-0 z-[60] bg-ink-950/50 flex items-center justify-center p-4" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm bg-surface-raised rounded-[18px] shadow-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center mb-3">
          <TriangleAlert size={18} className="text-danger" />
        </div>
        <h2 id="confirm-title" className="font-sans font-bold text-lg text-ink mb-1">{pending.title}</h2>
        <p className="font-sans text-sm text-ink-muted mb-6">{pending.body}</p>
        <div className="flex justify-end gap-2">
          <button
            autoFocus
            onClick={() => close(false)}
            className="h-10 px-4 rounded-[10px] border border-border-strong bg-surface text-ink font-sans font-semibold text-sm hover:bg-surface-sunken transition"
          >
            Cancel
          </button>
          <button
            onClick={() => close(true)}
            className="h-10 px-4 rounded-[10px] bg-danger text-white font-sans font-semibold text-sm hover:opacity-90 transition"
          >
            {pending.confirmLabel ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )

  return { confirm, dialog }
}

// Small dismissible error banner for failed admin actions.
export function ActionError({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-[10px] border border-danger bg-danger-soft px-4 py-3">
      <p className="font-sans text-sm text-danger">{message}</p>
      <button onClick={onDismiss} className="font-sans text-xs font-semibold text-danger hover:underline shrink-0">Dismiss</button>
    </div>
  )
}
