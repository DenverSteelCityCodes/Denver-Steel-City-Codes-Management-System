import { Hourglass, Clock, Ban, CircleDashed } from 'lucide-react'
import type { RegistrationStatus } from '../types/database'

// A registration's status as a word (DESIGN.md › Status Words), only for the exceptions: a confirmed
// seat is the normal case and says nothing. Waiting states (waitlisted, offered) are ink text in a
// 2px ink frame; cancelled and pending are plain muted words. None of them is red: a cancelled seat
// is not a safety problem.
const WORDS: Partial<Record<RegistrationStatus, { label: string; icon: typeof Clock; wait: boolean }>> = {
  waitlisted: { label: 'Waitlisted', icon: Hourglass, wait: true },
  offered: { label: 'Offered', icon: Clock, wait: true },
  cancelled: { label: 'Cancelled', icon: Ban, wait: false },
  pending: { label: 'Pending', icon: CircleDashed, wait: false },
}

export default function StatusWord({ status }: { status: RegistrationStatus }) {
  const word = WORDS[status]
  if (!word) return null
  const Icon = word.icon
  return (
    <span className={`inline-flex items-center gap-1.5 align-middle rounded text-sm font-bold leading-none whitespace-nowrap ${
      word.wait ? 'px-2 py-1.5 text-ink shadow-[inset_0_0_0_2px_var(--ink)]' : 'py-1.5 text-ink-muted'}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />{word.label}
    </span>
  )
}
