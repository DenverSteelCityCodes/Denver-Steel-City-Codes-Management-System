import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

// The junction sign (DESIGN.md › Sign Band): the one next decision on a view, in gold. A line of
// context, the figure at display scale, the message, one supporting line, and, when the whole
// sign is a link, an ink arrow square locked to its right edge. One per view.
//
// When the sign is a link, `label` is its accessible name, so it has to say everything the sign
// shows. The figure flips (split-flap) when its value changes after the first render.
interface Props {
  context: ReactNode
  figure: string | number
  unit?: string
  message: ReactNode
  sub?: ReactNode
  to?: string
  label?: string
}

export default function SignBand({ context, figure, unit, message, sub, to, label }: Props) {
  const value = String(figure)
  const [first] = useState(value)

  const body = (
    <>
      <span className="col-span-full text-sm font-bold text-brand-on-muted">{context}</span>
      <span className="font-extrabold text-[3.5rem] leading-[0.92] tracking-[-0.03em] [font-variant-numeric:tabular-nums_lining-nums]">
        <span key={value} className={value !== first ? 'ui-flap' : undefined}>{value}</span>
        {unit && <small className="ml-[0.15em] text-[0.42em] tracking-normal font-extrabold">{unit}</small>}
      </span>
      {to && (
        <span aria-hidden="true" className="row-start-2 row-span-2 col-start-2 self-center w-12 h-12 grid place-items-center rounded bg-shell text-brand">
          <ArrowRight size={26} strokeWidth={2.5} />
        </span>
      )}
      <span className="col-start-1 text-[1.375rem] font-extrabold leading-[1.15] text-balance">{message}</span>
      {sub && <span className="col-span-full mt-1 text-base text-brand-on-muted text-pretty">{sub}</span>}
    </>
  )

  const cls = 'grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-1 rounded p-4 bg-brand text-brand-on'
  return to
    ? <Link to={to} aria-label={label} className={`${cls} no-underline transition-colors hover:bg-brand-hover`}>{body}</Link>
    : <div className={cls}>{body}</div>
}
