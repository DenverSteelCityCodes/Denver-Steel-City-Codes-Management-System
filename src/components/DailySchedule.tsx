import { Clock } from 'lucide-react'
import { formatTimeRange } from '../lib/campDay'
import type { ScheduleItem } from '../types/database'

// The day's plan for one session, as a compact timeline. Read-only; admins edit it on Sessions.
export default function DailySchedule({ items, emptyText = 'No daily schedule posted yet.' }: { items: ScheduleItem[]; emptyText?: string }) {
  if (items.length === 0) {
    return <p className="font-sans text-sm text-ink-muted">{emptyText}</p>
  }
  return (
    <ol className="divide-y divide-border">
      {items.map(item => (
        <li key={item.id} className="flex items-start gap-3 py-2">
          <span className="w-[8.5rem] shrink-0 font-sans text-xs sm:text-sm text-ink-muted tabular-nums pt-0.5">
            {formatTimeRange(item.start_time, item.end_time)}
          </span>
          <span className="min-w-0">
            <span className="block font-sans text-sm font-semibold text-ink">{item.title}</span>
            {item.location && <span className="block font-sans text-xs text-ink-muted">{item.location}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

// Section heading used above the schedule on dashboards.
export function ScheduleHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted flex items-center gap-1.5">
      <Clock size={13} /> {children}
    </h3>
  )
}
