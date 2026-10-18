// Small building blocks shared by the volunteer tabs (and a few parent pages). Hierarchy comes from
// type and rule weight (DESIGN.md): content sits on the floor, a dataset is framed by 2px ink rules
// with 1px hairlines between its rows, and nothing is a card.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { useUpdates } from '../../hooks/useUpdates'
import { formatTime, timeAgo } from '../../lib/campDay'
import { segCls, segItemCls } from '../../lib/segmented'
import { audienceText } from '../../lib/updateMeta'
import { currentItem, toMinutes, whereWhen } from '../../lib/volunteerHome'
import type { ScheduleItem } from '../../types/database'
import type { AssignedSection } from '../../hooks/useAssignedClass'

// Rows of one dataset: 2px ink rules top and bottom; rows inside divide with `border-t border-border`.
export const listCls = 'border-y-2 border-ink'
export const rowCls = 'py-3 border-t border-border first:border-t-0'
// The shared button recipes (lib/ui.ts buttonClass), as literals so this module stays fast-refreshable.
export const btnCls = 'ui-btn ui-btn--secondary'
export const primaryCls = 'ui-btn ui-btn--primary'
export const inkCls = 'ui-btn ui-btn--ink'
export const linkCls = 'ui-btn ui-btn--text'
export const inputCls = 'ui-input'
export const labelCls = 'block font-bold text-ink mb-1.5'
export const h2Cls = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-ink'

export function PageHead({ dateline, title, children }: { dateline?: string; title: string; children?: ReactNode }) {
  return (
    <div>
      {dateline && <p className="text-sm font-bold text-ink-muted">{dateline}</p>}
      <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance text-ink">{title}</h1>
      {children && <p className="mt-2 max-w-[65ch] text-ink text-pretty">{children}</p>}
    </div>
  )
}

export function Sect({ title, action, id, children, className = '' }: { title: string; action?: ReactNode; id?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`mt-10 ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 mb-2">
        <h2 id={id} className={h2Cls}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

// The segmented control (DESIGN.md › Inputs) for a set of options; see lib/segmented.ts.
export function Segmented({ label, options, value, onChange, className = '' }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={`${segCls} ${className}`}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)} className={`${segItemCls(o.value === value)} min-h-11 px-3`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const chevron = <ChevronDown size={16} strokeWidth={2.5} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
const summaryCls = 'list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-11 flex items-center justify-between gap-3'

// The daily schedule as a timetable: start times in a fixed column, each block as tall as it lasts
// (DESIGN.md › Layout › Schedules). The current block is marked "Now" with weight and a 2px ink
// rule. On a camp day it folds to "Right now" with the full day one tap away; with `fold`, the rest
// of the time it folds to its first and last items (drop-off and pickup).
export function ScheduleBlock({ items, live, fold = false }: { items: ScheduleItem[]; live: boolean; fold?: boolean }) {
  if (items.length === 0) return null
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const cur = live ? currentItem(sorted, minutes) : null
  const list = (
    <ol className="mt-2 border-b border-border">
      {sorted.map((item, i) => {
        const on = cur?.id === item.id
        const end = item.end_time ?? sorted[i + 1]?.start_time
        const past = live && !on && toMinutes(end ?? item.start_time) <= minutes
        const length = end ? Math.max(15, toMinutes(end) - toMinutes(item.start_time)) : 30
        return (
          <li key={item.id} aria-current={on ? 'time' : undefined} style={{ minHeight: `${Math.round(length * 1.1)}px` }}
            className={`grid grid-cols-[5.5rem_1fr] gap-3 py-1.5 ${on ? 'border-t-2 border-ink' : 'border-t border-border'} ${past ? 'text-ink-muted' : 'text-ink'}`}>
            <span className="text-sm font-bold whitespace-nowrap pt-0.5">
              {formatTime(item.start_time)}
              {on && <span className="block font-extrabold text-ink">Now</span>}
            </span>
            <span className="min-w-0">
              <span className={`block leading-snug ${on ? 'font-extrabold' : 'font-bold'}`}>{item.title}</span>
              {item.location && <span className="block text-sm text-ink-muted">{item.location}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
  const fullDay = <span className="flex items-center gap-1 text-sm font-bold text-ink-muted shrink-0">Full day {chevron}</span>
  if (!live && !fold) return <Sect title="The daily schedule">{list}</Sect>
  if (!live) {
    const ends = [sorted[0], sorted[sorted.length - 1]]
    return (
      <section className="mt-10">
        <details className="group">
          <summary className={summaryCls}>
            <span>
              <span className="block text-lg font-bold text-ink">A day at camp</span>
              <span className="block text-ink-muted">
                {ends.map((i, n) => `${n ? i.title.toLowerCase() : i.title} ${formatTime(i.start_time)}`).join(', ')}
              </span>
            </span>
            {fullDay}
          </summary>
          {list}
        </details>
      </section>
    )
  }
  return (
    <section className="mt-10">
      <details className="group" open={typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches}>
        <summary className={summaryCls}>
          <span>
            <span className="block text-sm font-bold text-ink-muted">
              {cur ? `Right now${cur.end_time ? `, until ${formatTime(cur.end_time)}` : ''}` : "Today's schedule"}
            </span>
            {cur && <span className="text-lg font-bold text-ink">{cur.title}{cur.location && <span className="font-normal text-ink-muted text-base">, {cur.location.toLowerCase()}</span>}</span>}
          </span>
          {fullDay}
        </summary>
        {list}
      </details>
    </section>
  )
}

// The latest post as a one-line pointer to the Updates tab (no card, no megaphone).
export function LatestUpdate({ to = '/volunteer/updates' }: { to?: string }) {
  const { updates, loading } = useUpdates(1)
  const u = updates[0]
  return (
    <section aria-labelledby="latest-h" className="mt-10">
      <h2 id="latest-h" className="sr-only">Latest from the camp</h2>
      {loading ? (
        <div className="h-24 border-y-2 border-ink animate-pulse" aria-busy="true" />
      ) : !u ? (
        <p className="py-3 border-y-2 border-ink text-ink-muted">Nothing posted from the camp yet.</p>
      ) : (
        <Link to={to} className="group/latest grid gap-1 py-3 border-y-2 border-ink text-ink no-underline">
          <span className="text-sm text-ink-muted">Latest from <b className="font-bold text-ink">{u.author_name}</b> to {audienceText(u)}, {timeAgo(u.created_at)}</span>
          <span className="line-clamp-2 text-pretty">{u.body}</span>
          <span className="inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px] group-hover/latest:decoration-2">
            All updates <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </Link>
      )}
    </section>
  )
}

// One row per section: class and section, then week, where and when; your role in plain muted text.
export function ClassList({ sections }: { sections: AssignedSection[] }) {
  return (
    <ul className={listCls}>
      {sections.map(s => (
        <li key={s.id} className={`${rowCls} flex items-baseline gap-4`}>
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold leading-[1.3] text-ink">{s.class_name}, {s.label}</span>
            <span className="block text-ink-muted text-pretty">{s.week ? `Week ${s.week}: ` : ''}{whereWhen(s)}</span>
          </span>
          <span className="shrink-0 text-sm font-bold text-ink-muted">{s.is_lead ? 'Lead' : 'Support'}</span>
        </li>
      ))}
    </ul>
  )
}
