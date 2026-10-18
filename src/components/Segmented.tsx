import { useRef } from 'react'
import type { ReactNode } from 'react'

// Segmented control (DESIGN.md › Inputs: one component for weeks, roll calls, filters): a 2px ink
// frame with 2px dividers and 44px items; the selected item is an ink fill with white text (bone
// with dark text at night). Never gold.
//
//  mode 'pressed' — filters: a group of toggle buttons (aria-pressed), each a plain Tab stop.
//  mode 'radio'   — one choice in a form: a radiogroup, arrow keys move the choice.
//  mode 'tabs'    — switches panels: a tablist, arrow keys move between tabs. Give `idBase`; the
//                   panels use `${idBase}-panel-${value}` and are labelled by `${idBase}-tab-${value}`.
export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

export default function Segmented<T extends string>({
  label, labelledBy, options, value, onChange, mode = 'pressed', idBase, block = false, className,
}: {
  label?: string
  labelledBy?: string
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  mode?: 'pressed' | 'radio' | 'tabs'
  idBase?: string
  // Items share the full width (phone week tabs).
  block?: boolean
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const roving = mode !== 'pressed'

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (!roving) return
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : step ? (i + step + options.length) % options.length : -1
    if (to < 0) return
    e.preventDefault()
    onChange(options[to].value)
    refs.current[to]?.focus()
  }

  return (
    <div
      role={mode === 'tabs' ? 'tablist' : mode === 'radio' ? 'radiogroup' : 'group'}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={`${block ? 'flex' : 'inline-flex'} max-w-full overflow-x-auto [scrollbar-width:none] rounded border-2 border-ink ${className ?? ''}`}
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
            aria-controls={mode === 'tabs' && idBase ? `${idBase}-panel-${o.value}` : undefined}
            tabIndex={roving && !on ? -1 : undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={`${block ? 'flex-1 justify-center' : ''} inline-flex items-center gap-1.5 min-h-11 px-4 whitespace-nowrap font-bold transition-colors focus-visible:-outline-offset-4 ${
              i > 0 ? 'border-l-2 border-ink' : ''} ${on
                ? 'bg-shell text-on-shell dark:bg-ink dark:text-bg focus-visible:outline-on-shell dark:focus-visible:outline-bg'
                : 'text-ink hover:bg-ink/5'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
