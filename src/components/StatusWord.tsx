import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// Status words (DESIGN.md › Status Words): 14px 700, 4px corners, each with a drawn icon.
//   ok      — done: green on green wash
//   danger  — safety or failure: red on red wash
//   waiting — needs a person: ink text in a 2px inset ink frame
//   plain   — muted text, no box
export type StatusTone = 'ok' | 'danger' | 'waiting' | 'plain'

const TONE: Record<StatusTone, string> = {
  ok: 'bg-success-soft text-success px-2 py-1.5',
  danger: 'bg-danger-soft text-danger px-2 py-1.5',
  waiting: 'text-ink shadow-[inset_0_0_0_2px_var(--ink)] px-2 py-1.5',
  plain: 'text-ink-muted',
}

export default function StatusWord({ tone, icon: Icon, children, className = '' }: {
  tone: StatusTone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded text-sm font-bold leading-[1.3] whitespace-nowrap ${TONE[tone]} ${className}`}>
      {Icon && <Icon size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />}
      {children}
    </span>
  )
}
