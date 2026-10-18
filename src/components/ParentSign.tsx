import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  id?: string
  // Context line, the figure (with an optional unit), the message and one supporting line.
  ctx: ReactNode
  fig?: { value: string; unit?: string } | null
  msg: ReactNode
  sub?: ReactNode
  // A linked sign is one tap: the whole band goes there and carries the ink arrow square.
  to?: string
  // Controls that sit on the sign instead of a link (claim / decline an offer).
  children?: ReactNode
}

// The junction sign (DESIGN.md › Sign Band): the one next decision on a parent page, in the only
// gold on the view. Ink text on gold in both themes; controls on it keep an ink focus ring.
export default function ParentSign({ id, ctx, fig, msg, sub, to, children }: Props) {
  const headingId = id ? `${id}-h` : undefined
  const body = (
    <>
      <p className="text-sm font-bold text-brand-on/80">{ctx}</p>
      <div className="mt-1 grid grid-cols-[1fr_auto] items-end gap-x-4">
        <div className="min-w-0">
          {fig && (
            <p className="font-extrabold text-[3.5rem] md:text-[4.5rem] leading-[0.92] tracking-[-0.03em] [font-variant-numeric:tabular-nums_lining-nums] break-words">
              {fig.value}
              {fig.unit && <small className="ml-[0.15em] text-[0.42em] font-extrabold tracking-normal">{fig.unit}</small>}
            </p>
          )}
          <h2 id={headingId} tabIndex={id ? -1 : undefined} className={`${fig ? 'mt-1.5' : ''} text-[1.375rem] leading-[1.15] font-extrabold text-balance focus:outline-none`}>
            {msg}
          </h2>
        </div>
        {to && (
          <span aria-hidden="true" className="self-center w-12 h-12 grid place-items-center rounded bg-shell text-brand">
            <ArrowRight size={26} strokeWidth={2.5} />
          </span>
        )}
      </div>
      {sub && <p className="mt-2 text-brand-on/80 text-pretty">{sub}</p>}
      {children}
    </>
  )
  const cls = 'block rounded bg-brand text-brand-on p-4 scroll-mt-32 md:scroll-mt-24 [&_:focus-visible]:outline-brand-on'
  return to
    ? <Link id={id} to={to} className={`${cls} no-underline hover:bg-brand-hover transition-colors`}>{body}</Link>
    : <section id={id} aria-labelledby={headingId} className={cls}>{body}</section>
}
