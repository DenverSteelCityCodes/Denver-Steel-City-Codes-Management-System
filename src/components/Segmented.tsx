import type { ReactNode } from 'react'

// The segmented control (DESIGN.md › Inputs): one component for weeks, filters, forms and answers.
// A 2px ink frame with ink dividers and 44px items; the selected item is an ink fill with floor-
// coloured text, which inverts to a bone fill at night through the same tokens. Buttons with
// aria-pressed inside a labelled group, so each option reads as its own on/off state.
export interface SegmentOption<T extends string> { value: T; label: ReactNode; count?: number; srLabel?: string }

export default function Segmented<T extends string>({
  label, options, value, onChange, disabled = false, compact = false, className = '',
}: {
  label: string
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  // 40px items for dense tables (the Forms answer column); 44px otherwise.
  compact?: boolean
  className?: string
}) {
  return (
    <div role="group" aria-label={label}
      className={`inline-flex max-w-full overflow-x-auto rounded border-2 border-ink divide-x-2 divide-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => { if (!on) onChange(o.value) }}
            className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-offset-[-4px] ${
              compact ? 'min-h-10' : 'min-h-11'
            } ${on ? 'bg-ink text-bg' : 'bg-transparent text-ink hover:bg-ink/[0.06]'}`}
          >
            {o.label}
            {o.count !== undefined && <span className={`font-semibold tabular-nums ${on ? '' : 'text-ink-muted'}`}>{o.count}</span>}
            {o.srLabel && <span className="sr-only">{o.srLabel}</span>}
          </button>
        )
      })}
    </div>
  )
}
