import type { OpenSlot } from '../hooks/useOpenInterviewSlots'
import { campDateKey, formatCampTime } from '../lib/denverTime'

// Interview times as one row per day, the day in a fixed column and its times as real radios in
// 44px choice chips (selected: a 2px ink frame). With `currentId`, that slot is the applicant's own
// time and says so ("Your time"). Used on /apply and in the applicant's waiting room.
export default function InterviewSlotPicker({
  slots,
  value,
  onChange,
  labelledBy,
  currentId,
}: {
  slots: OpenSlot[]
  value: string
  onChange: (slotId: string) => void
  labelledBy?: string
  currentId?: string
}) {
  const byDay = slots.reduce<Record<string, OpenSlot[]>>((acc, s) => {
    // Grouped by the Denver date, so a slot never lands under the wrong day on a device elsewhere.
    ;(acc[campDateKey(s.slot_datetime)] ??= []).push(s)
    return acc
  }, {})

  if (slots.length === 0) {
    return (
      <p className="text-ink-muted text-pretty">
        No interview times are open right now. You can still apply. New times show up on your volunteer page, so check back there to book one.
      </p>
    )
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy}>
      <p className="text-sm text-ink-muted">All times are Denver time.</p>
      <div className="mt-2 border-y-2 border-ink">
        {Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, daySlots]) => (
          <div key={day} className="grid grid-cols-[6rem_1fr] gap-3 items-center py-2 border-t border-border first:border-t-0">
            <span className="font-bold text-ink">
              {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <div className="flex flex-wrap gap-2">
              {[...daySlots].sort((a, b) => a.slot_datetime.localeCompare(b.slot_datetime)).map(s => (
                <label key={s.id} className="inline-flex items-center gap-1.5 min-h-11 px-2.5 bg-surface border-2 border-border has-checked:border-ink rounded font-bold text-ink cursor-pointer">
                  <input type="radio" name={`slot-${labelledBy ?? 'pick'}`} value={s.id} checked={value === s.id} onChange={() => onChange(s.id)}
                    className="w-[18px] h-[18px] m-0 shrink-0 cursor-pointer" />
                  <span>
                    {formatCampTime(s.slot_datetime)}
                    {s.id === currentId && <span className="font-extrabold"> · Your time</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
