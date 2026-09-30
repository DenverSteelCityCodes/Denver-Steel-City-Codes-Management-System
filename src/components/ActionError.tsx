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
