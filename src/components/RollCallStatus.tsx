import { Check, X, Minus } from 'lucide-react'
import { ROLL_CALLS, formatTime } from '../lib/campDay'
import type { RollCallMark } from '../types/database'

// A camper's day in three chips: Arrival ✓ 9:05 · After lunch — · Dismissal —
export default function RollCallStatus({ marks }: { marks: RollCallMark[] }) {
  if (marks.length === 0) {
    return <p className="mt-1.5 font-sans text-xs text-ink-faint">Today's roll calls will show here once the room takes them.</p>
  }
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Today's roll calls">
      {ROLL_CALLS.map(r => {
        const m = marks.find(x => x.roll_call === r.key)
        const cls = !m ? 'bg-surface-sunken text-ink-muted' : m.present ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        const Icon = !m ? Minus : m.present ? Check : X
        const time = m ? formatTime(new Date(m.marked_at).toTimeString().slice(0, 5)) : ''
        return (
          <li key={r.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
            <Icon size={12} aria-hidden />
            {r.label}{m ? `: ${m.present ? 'present' : 'absent'} ${time}` : ''}
          </li>
        )
      })}
    </ul>
  )
}
