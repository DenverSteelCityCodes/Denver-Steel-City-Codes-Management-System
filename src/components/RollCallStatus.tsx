import { Check, X, Minus } from 'lucide-react'
import { ROLL_CALLS, formatTime } from '../lib/campDay'
import type { RollCallMark } from '../types/database'

// A camper's camp day in three status words: Arrival: present 9:05 · After lunch · Dismissal.
// Green is present, red is absent, muted is not taken yet. Shown on camp days only.
export default function RollCallStatus({ marks }: { marks: RollCallMark[] }) {
  if (marks.length === 0) {
    return <p className="mt-1 text-sm text-ink-muted">Today's roll calls show here once the room takes them.</p>
  }
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Today's roll calls">
      {ROLL_CALLS.map(r => {
        const m = marks.find(x => x.roll_call === r.key)
        const cls = !m ? 'text-ink-muted' : m.present ? 'bg-success-soft text-success px-2' : 'bg-danger-soft text-danger px-2'
        const Icon = !m ? Minus : m.present ? Check : X
        const time = m ? formatTime(new Date(m.marked_at).toTimeString().slice(0, 5)) : ''
        return (
          <li key={r.key} className={`inline-flex items-center gap-1.5 rounded py-1.5 text-sm font-bold leading-none ${cls}`}>
            <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
            {r.label}{m ? `: ${m.present ? 'present' : 'absent'} ${time}` : ': not yet'}
          </li>
        )
      })}
    </ul>
  )
}
