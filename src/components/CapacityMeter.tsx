interface Props {
  registered: number
  capacity: number
}

// Seat meter (DESIGN.md › The Meaningful Red Rule): a full section is ink, partly full is muted ink.
// Never red and never gold — a full class is good news, not an error.
export default function CapacityMeter({ registered, capacity }: Props) {
  const pct = capacity === 0 ? 0 : Math.min(registered / capacity, 1)
  const isFull = registered >= capacity
  const isWarning = pct >= 0.9

  return (
    <div className="space-y-1">
      <div aria-hidden="true" className="h-1 rounded-[2px] bg-border overflow-hidden">
        <div
          className={`h-full transition-all ${isFull ? 'bg-ink' : 'bg-ink-muted'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="text-sm font-sans font-medium text-ink-muted tabular-nums">
        {registered} / {capacity}
        {isFull && (
          <span className="ml-2 text-ink font-extrabold">Full</span>
        )}
        {isWarning && !isFull && (
          <span className="ml-2 text-ink font-bold">Almost full</span>
        )}
      </p>
    </div>
  )
}
