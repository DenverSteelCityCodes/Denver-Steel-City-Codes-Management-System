// Building blocks for the parent tabs (DESIGN.md, Terminal Yellow). Content sits straight on the
// floor: a 2px ink rule separates decisions and frames a list, 1px hairlines divide its rows.
// Parent-only on purpose, so the volunteer tabs can change their own parts freely.
import { useId } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, CircleAlert, Clock, Hourglass } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import UpdatesFeed from '../../components/UpdatesFeed'
import { useUpdates } from '../../hooks/useUpdates'
import { formatTime, formatTimeRange } from '../../lib/campDay'
import { currentItem, toMinutes } from '../../lib/volunteerHome'
import type { ScheduleItem } from '../../types/database'

// Section heading (DESIGN.md › Title).
export const h2Cls = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-balance'
// Field labels and legends are 700 at 1rem; hints are muted meta.
export const labelCls = 'block font-bold mb-1.5'
export const hintCls = 'block text-sm text-ink-muted'
// Underlined text actions with a 44px target.
export const textBtn = 'ui-btn ui-btn--text'
export const mutedTextBtn = 'ui-btn ui-btn--text text-ink-muted font-semibold'
// A list on the floor between 2px ink rules; its rows divide with hairlines.
export const framedCls = 'border-y-2 border-ink'
export const rowCls = 'border-t border-border first:border-t-0'

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">{title}</h1>
      {children && <p className="mt-2 text-ink-muted text-pretty max-w-[60ch]">{children}</p>}
    </div>
  )
}

export function Sect({ title, action, id, children, className = '' }: { title: string; action?: ReactNode; id?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`mt-10 ${className}`}>
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id={id} className={h2Cls}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

// Segmented control (DESIGN.md › Inputs): one component for campers, weeks and yes/no. A 2px ink
// frame with 2px dividers and 44px items; the selected item is filled ink (bone at night). More
// than three items wrap as separate framed toggles so a long family never overflows the phone.
export interface SegItem { key: string; label: ReactNode; on: boolean; onClick: () => void }

export function Segmented({ labelledBy, items, invalid = false, describedBy, className = '' }: { labelledBy: string; items: SegItem[]; invalid?: boolean; describedBy?: string; className?: string }) {
  const joined = items.length <= 3
  return (
    <div role="group" aria-labelledby={labelledBy} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      className={joined
        ? `flex rounded border-2 ${invalid ? 'border-danger' : 'border-ink'} ${className}`
        : `flex flex-wrap gap-2 ${className}`}>
      {items.map(it => (
        <button key={it.key} type="button" aria-pressed={it.on} onClick={it.onClick}
          className={`min-h-11 px-4 py-1.5 font-bold leading-tight transition-colors ${joined
            ? 'flex-1 min-w-0 border-l-2 border-ink first:border-l-0 first:rounded-l-[2px] last:rounded-r-[2px]'
            : 'rounded border-2 border-ink'} ${it.on ? 'bg-ink text-bg' : 'text-ink hover:bg-ink/[0.06]'}`}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

// Status words (DESIGN.md › Status Words): done is green on its wash, waiting is ink in a 2px inset
// ink frame, needing attention is the same frame with an alert icon (never red), plain is muted.
export type StatusTone = 'ok' | 'wait' | 'offer' | 'attention' | 'plain'
const STATUS: Record<StatusTone, { cls: string; Icon: LucideIcon | null }> = {
  ok: { cls: 'px-2 bg-success-soft text-success', Icon: Check },
  wait: { cls: 'px-2 text-ink ring-2 ring-inset ring-ink', Icon: Hourglass },
  offer: { cls: 'px-2 text-ink ring-2 ring-inset ring-ink', Icon: Clock },
  attention: { cls: 'px-2 text-ink ring-2 ring-inset ring-ink', Icon: CircleAlert },
  plain: { cls: 'text-ink-muted', Icon: null },
}

export function StatusWord({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const { cls, Icon } = STATUS[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded py-1.5 text-sm font-bold leading-none whitespace-nowrap ${cls}`}>
      {Icon && <Icon size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />}{children}
    </span>
  )
}

// A blocking error under the thing it is about: red 14px 700 with an icon.
export function ErrorLine({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} role="alert" className={`flex items-start gap-1.5 text-sm font-bold text-danger text-pretty ${className}`}>
      <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  )
}

// The day at camp as a timetable: a fixed column with each block's start and end (pickup is a
// window, not a moment), and each block as tall as it is long. It
// folds to drop-off and pickup; on a camp day it folds to what's on right now (open on wide screens).
export function Schedule({ items, live }: { items: ScheduleItem[]; live: boolean }) {
  const titleId = useId()
  if (items.length === 0) return null
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const cur = live ? currentItem(sorted, minutes) : null
  const ends = [sorted[0], sorted[sorted.length - 1]]
  // An item without an end runs until the next one starts (the last, half an hour).
  const length = (i: number) => {
    const it = sorted[i]
    const end = it.end_time ?? sorted[i + 1]?.start_time
    return end ? Math.max(15, toMinutes(end) - toMinutes(it.start_time)) : 30
  }
  return (
    <section aria-labelledby={titleId} className="mt-10">
      <details className="group" open={live && typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches}>
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-11 flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span id={titleId} className={`block ${h2Cls}`}>{live ? "Today's schedule" : 'A day at camp'}</span>
            <span className="block text-ink-muted">
              {cur
                ? <>Now: <b className="font-bold text-ink">{cur.title}</b>{cur.end_time ? `, until ${formatTime(cur.end_time)}` : ''}</>
                : ends.map((i, n) => `${n ? i.title.toLowerCase() : i.title} ${formatTime(i.start_time)}`).join(', ')}
            </span>
          </span>
          <span className="flex items-center gap-1 text-sm font-bold text-ink-muted shrink-0">
            Full day <ChevronDown size={16} strokeWidth={2.5} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <ol className={`mt-3 ${framedCls}`}>
          {sorted.map((item, i) => {
            const on = cur?.id === item.id
            const past = live && !on && toMinutes(item.end_time ?? sorted[i + 1]?.start_time ?? item.start_time) <= minutes
            return (
              <li key={item.id} style={{ minHeight: `${Math.round(length(i) * 1.1)}px` }}
                className={`grid grid-cols-[9.5rem_1fr] gap-3 py-2 ${on ? 'border-t-2 border-ink' : rowCls} ${past ? 'text-ink-faint' : ''}`}>
                <span className={`text-sm font-bold whitespace-nowrap pt-0.5 ${past ? '' : 'text-ink'}`}>
                  {on && <span className="sr-only">Now: </span>}{formatTimeRange(item.start_time, item.end_time)}
                </span>
                <span className="min-w-0">
                  <span className={`block leading-snug ${on ? 'font-extrabold' : 'font-bold'}`}>{item.title}</span>
                  {item.location && <span className={`block text-sm ${past ? '' : 'text-ink-muted'}`}>{item.location}</span>}
                </span>
              </li>
            )
          })}
        </ol>
      </details>
    </section>
  )
}

export function LatestUpdate() {
  const { updates, loading } = useUpdates(1)
  return (
    <Sect title="Latest from the camp" id="latest-h" action={<Link to="/parent/updates" className={textBtn}>All updates</Link>}>
      <div className={`${framedCls} py-1`}>
        <UpdatesFeed updates={updates} loading={loading} compact emptyText="Nothing posted yet." />
      </div>
    </Sect>
  )
}
