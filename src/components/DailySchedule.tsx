import { formatTime, formatTimeRange } from '../lib/campDay'
import { toMinutes } from '../lib/volunteerHome'
import type { ScheduleItem } from '../types/database'

// The day's plan for one session as a timetable (DESIGN.md › Schedules): the start time in a fixed
// left column, and each block as tall as it is long. Read-only; admins edit it on Sessions.
export default function DailySchedule({ items, emptyText = 'No daily schedule posted yet.' }: { items: ScheduleItem[]; emptyText?: string }) {
  if (items.length === 0) {
    return <p className="text-ink-muted">{emptyText}</p>
  }
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time))
  return (
    <ol className="grid grid-cols-[4.5rem_1fr]">
      {sorted.map((item, i) => {
        const end = item.end_time ?? sorted[i + 1]?.start_time
        const minutes = end ? Math.max(15, toMinutes(end) - toMinutes(item.start_time)) : 30
        return (
          <li key={item.id} className="contents">
            <span className="pt-1.5 text-sm font-bold tabular-nums">{formatTime(item.start_time).replace(/ (AM|PM)$/, '')}</span>
            <span className="border-t border-border py-1.5 pl-3" style={{ minHeight: `${Math.round(minutes * 1.1)}px` }}>
              {item.title}
              {item.location && <span className="text-sm text-ink-muted"><span className="px-[0.35em]">·</span>{item.location}</span>}
              <span className="sr-only">, {formatTimeRange(item.start_time, item.end_time)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
