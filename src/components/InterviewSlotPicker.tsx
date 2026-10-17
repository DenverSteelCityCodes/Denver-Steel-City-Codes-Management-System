import { CalendarClock } from 'lucide-react'
import type { OpenSlot } from '../hooks/useOpenInterviewSlots'

// SignUpGenius-style picker: times grouped by day, pick one.
export default function InterviewSlotPicker({
  slots,
  value,
  onChange,
  labelledBy,
}: {
  slots: OpenSlot[]
  value: string
  onChange: (slotId: string) => void
  labelledBy?: string
}) {
  const byDay = slots.reduce<Record<string, OpenSlot[]>>((acc, s) => {
    const d = new Date(s.slot_datetime)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    ;(acc[key] ??= []).push(s)
    return acc
  }, {})

  if (slots.length === 0) {
    return (
      <p className="flex items-start gap-2 font-sans text-sm text-ink-muted bg-surface-sunken border border-border rounded-[10px] px-3 py-2.5">
        <CalendarClock size={16} className="shrink-0 mt-0.5" />
        No interview times are open right now. You can still apply — we'll email you when times are posted, and you can book from your volunteer dashboard.
      </p>
    )
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="space-y-3">
      {Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, daySlots]) => (
        <div key={day}>
          <p className="font-sans text-xs font-semibold text-ink-muted mb-1.5">
            {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <div className="flex flex-wrap gap-2">
            {daySlots.map(s => {
              const selected = value === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(s.id)}
                  className={`h-10 px-3.5 rounded-[10px] border font-sans text-sm font-semibold transition ${
                    selected ? 'bg-brand text-brand-on border-brand' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
                  }`}
                >
                  {new Date(s.slot_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  <span className={`ml-1.5 text-xs font-normal ${selected ? 'text-brand-on/80' : 'text-ink-muted'}`}>{s.duration_minutes} min</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
