interface Props {
  registered: number
  capacity: number
}

// Seat meter (DESIGN.md › The Meaningful Red Rule): a 4px bar, ink when the section is full, muted
// ink while seats are left. Never red and never gold: a full class is good news, not an error. The
// count beside it is the caller's words, so the bar is hidden from screen readers.
export default function CapacityMeter({ registered, capacity }: Props) {
  const share = capacity > 0 ? Math.min(registered / capacity, 1) : 0
  const full = capacity > 0 && registered >= capacity
  return (
    <span aria-hidden="true" className="block h-1 mt-1.5 rounded-[2px] bg-border overflow-hidden">
      <span className={`block h-full ${full ? 'bg-ink' : 'bg-ink-muted'}`} style={{ width: `${share * 100}%` }} />
    </span>
  )
}
