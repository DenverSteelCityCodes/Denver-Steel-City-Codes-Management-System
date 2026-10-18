import { Hourglass, Clock, Ban, CircleDashed } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import StatusWord from './StatusWord'
import type { StatusTone } from './StatusWord'
import type { RegistrationStatus } from '../types/database'

// A registration's status as a word, only for the exceptions: a confirmed seat is the normal case
// and says nothing. Waiting states (waitlisted, offered) are ink in a 2px ink frame; cancelled and
// pending are plain muted words. None of them is red: a cancelled seat is not a safety problem.
const WORDS: Partial<Record<RegistrationStatus, { label: string; icon: LucideIcon; tone: StatusTone }>> = {
  waitlisted: { label: 'Waitlisted', icon: Hourglass, tone: 'waiting' },
  offered: { label: 'Offered', icon: Clock, tone: 'waiting' },
  cancelled: { label: 'Cancelled', icon: Ban, tone: 'plain' },
  pending: { label: 'Pending', icon: CircleDashed, tone: 'plain' },
}

export default function RegistrationStatusWord({ status }: { status: RegistrationStatus }) {
  const word = WORDS[status]
  if (!word) return null
  return <StatusWord tone={word.tone} icon={word.icon} className="align-middle">{word.label}</StatusWord>
}
