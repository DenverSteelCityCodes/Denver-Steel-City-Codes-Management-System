import { useRef } from 'react'
import type { ReactNode } from 'react'

// The segmented control (DESIGN.md › Inputs): one component for weeks, filters, forms, answers and
// panel tabs. A 2px ink frame with ink dividers and 44px items (40px when `compact`); the selected
// item is an ink fill with floor-coloured text, which inverts to a bone fill at night through the
// same tokens. Never gold. Clicking the item that's already selected does nothing.
//
//  mode 'pressed' — filters and answers (the default): toggle buttons (aria-pressed) in a labelled
//                   group, each its own Tab stop.
//  mode 'radio'   — one choice in a form: a radiogroup; arrow keys move the choice.
//  mode 'tabs'    — switches panels: a tablist; arrow keys move between tabs. Give `idBase`; the
//                   shown panel is `${idBase}-panel-${value}`, labelled by `${idBase}-tab-${value}`.
export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  // A figure after the label (muted unless selected), e.g. a filter's count.
  count?: number
  // Words for screen readers only, after the label.
  srLabel?: string
}

export default function Segmented<T extends string>({
  label, labelledBy, options, value, onChange, mode = 'pressed', idBase, block = false, compact = false,
  disabled = false, className = '',
}: {
  label?: string
  labelledBy?: string
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  mode?: 'pressed' | 'radio' | 'tabs'
  idBase?: string
  // Items share the full width.
  block?: boolean
  // 40px items for dense tables; 44px otherwise.
  compact?: boolean
  disabled?: boolean
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const roving = mode !== 'pressed'
  // With a roving tab stop, one item must stay reachable even if `value` isn't one of the options.
  const stop = Math.max(0, options.findIndex(o => o.value === value))

  function pick(v: T) {
    if (v !== value && !disabled) onChange(v)
  }

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (!roving || disabled) return
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : step ? (i + step + options.length) % options.length : -1
    if (to < 0) return
    e.preventDefault()
    pick(options[to].value)
    refs.current[to]?.focus()
  }

  return (
    <div
      role={mode === 'tabs' ? 'tablist' : mode === 'radio' ? 'radiogroup' : 'group'}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={`relative ${block ? 'flex' : 'inline-flex'} max-w-full overflow-x-auto rounded border-2 border-ink divide-x-2 divide-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={el => { refs.current[i] = el }}
            type="button"
            id={mode === 'tabs' && idBase ? `${idBase}-tab-${o.value}` : undefined}
            role={mode === 'tabs' ? 'tab' : mode === 'radio' ? 'radio' : undefined}
            aria-pressed={mode === 'pressed' ? on : undefined}
            aria-checked={mode === 'radio' ? on : undefined}
            aria-selected={mode === 'tabs' ? on : undefined}
            // Only the shown panel exists, so only the selected tab points at one.
            aria-controls={mode === 'tabs' && idBase && on ? `${idBase}-panel-${o.value}` : undefined}
            tabIndex={roving && i !== stop ? -1 : undefined}
            disabled={disabled}
            onClick={() => pick(o.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={`${block ? 'flex-1' : 'shrink-0'} inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-offset-[-4px] ${
              compact ? 'min-h-10' : 'min-h-11'
            } ${on
              ? 'bg-ink text-bg focus-visible:outline-bg'
              : 'bg-transparent text-ink hover:bg-ink/[0.06]'}`}
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
