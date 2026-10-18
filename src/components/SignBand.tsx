import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

// The junction sign (DESIGN.md › Sign Band): the one next decision on a view, in gold. A line of
// context, the figure at display scale, the message, one supporting line, and either an ink arrow
// square locked to the right edge (the whole sign is one link) or controls on the sign (claim /
// decline an offer). One per view, for every role. With no figure (a status that couldn't be
// read, or a decision with no number), the message leads.
//
// When the sign is a link, `label` is its accessible name, so it has to say everything the sign
// shows. With an `id`, the message is that sign's h2 (focusable, so a link or the bell can land on
// it). The figure flips (split-flap) when its value changes after the first render.
interface Props {
  id?: string
  context: ReactNode
  figure?: string | number | null
  unit?: string
  message: ReactNode
  sub?: ReactNode
  to?: string
  label?: string
  // Controls that sit on the sign instead of a link.
  children?: ReactNode
}

export default function SignBand({ id, context, figure, unit, message, sub, to, label, children }: Props) {
  const hasFigure = figure !== undefined && figure !== null && figure !== ''
  const value = hasFigure ? String(figure) : ''
  const [first] = useState(value)
  const headingId = id ? `${id}-h` : undefined

  const messageCls = 'col-start-1 text-[1.375rem] font-extrabold leading-[1.15] text-balance'
  // The spaces between the parts keep their words apart in the text a link's name is checked
  // against (WCAG 2.5.3); a grid doesn't lay out whitespace, so nothing moves.
  const body = (
    <>
      <span className="col-span-full text-sm font-bold text-brand-on-muted">{context}</span>{' '}
      {hasFigure && (
        <span className="font-extrabold text-[3.5rem] leading-[0.92] tracking-[-0.03em] [font-variant-numeric:tabular-nums_lining-nums] break-words min-w-0">
          <span key={value} className={value !== first ? 'ui-flap' : undefined}>{value}</span>
          {unit && <small className="ml-[0.15em] text-[0.42em] tracking-normal font-extrabold">{unit}</small>}
        </span>
      )}{' '}
      {to && (
        <span aria-hidden="true" className="row-start-2 row-span-2 col-start-2 self-center w-12 h-12 grid place-items-center rounded bg-shell text-brand">
          <ArrowRight size={26} strokeWidth={2.5} />
        </span>
      )}
      {headingId && !to
        ? <h2 id={headingId} tabIndex={-1} className={`${messageCls} focus:outline-none`}>{message}</h2>
        : <span className={messageCls}>{message}</span>}{' '}
      {sub && <span className="col-span-full mt-1 text-base text-brand-on-muted text-pretty">{sub}</span>}
      {children && <div className="col-span-full">{children}</div>}
    </>
  )

  const cls = 'grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-1 rounded p-4 bg-brand text-brand-on scroll-mt-32 md:scroll-mt-24 [&_:focus-visible]:outline-brand-on'
  if (to) return <Link id={id} to={to} aria-label={label} className={`${cls} no-underline transition-colors hover:bg-brand-hover`}>{body}</Link>
  if (headingId) return <section id={id} aria-labelledby={headingId} className={cls}>{body}</section>
  return <div id={id} className={cls}>{body}</div>
}
