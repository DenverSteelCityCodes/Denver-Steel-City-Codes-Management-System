interface Props {
  registered: number
  capacity: number
}

export default function CapacityMeter({ registered, capacity }: Props) {
  const pct = capacity === 0 ? 0 : Math.min(registered / capacity, 1)
  const isFull = registered >= capacity
  const isWarning = pct >= 0.9

  const fillColor = isFull
    ? 'bg-danger'
    : isWarning
    ? 'bg-warning'
    : 'bg-brand'

  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${fillColor}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="text-xs font-sans font-medium text-ink-muted tabular-nums">
        {registered} / {capacity}
        {isFull && (
          <span className="ml-2 text-danger font-semibold">Full</span>
        )}
        {isWarning && !isFull && (
          <span className="ml-2 text-warning font-semibold">Almost full</span>
        )}
      </p>
    </div>
  )
}
