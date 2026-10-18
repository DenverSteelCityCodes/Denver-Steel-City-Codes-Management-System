// Small building blocks shared by the volunteer tabs. Hierarchy comes from type and spacing:
// sections sit on the page, and only tap lists get a white surface.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import UpdatesFeed from '../../components/UpdatesFeed'
import { useUpdates } from '../../hooks/useUpdates'
import { formatTime, formatTimeRange } from '../../lib/campDay'
import { currentItem, toMinutes, whereWhen } from '../../lib/volunteerHome'
import type { ScheduleItem } from '../../types/database'
import type { AssignedSection } from '../../hooks/useAssignedClass'

export const listCls = 'bg-surface border border-border rounded-[14px] overflow-hidden'
export const btnCls = 'h-11 px-4 rounded-[10px] border border-border-strong bg-surface text-ink font-sans font-semibold text-[15px] inline-flex items-center justify-center gap-1.5 hover:bg-surface-sunken transition disabled:opacity-50'
export const primaryCls = 'ui-btn ui-btn--primary'
export const linkCls = 'min-h-11 inline-flex items-center font-sans font-semibold text-[15px] text-ink underline decoration-brand-hover decoration-2 underline-offset-4'
// 16px so iOS Safari doesn't zoom the page when the field is focused.
export const inputCls = 'ui-input'
export const labelCls = 'block font-sans text-sm font-semibold text-ink-muted mb-1'

export function PageHead({ dateline, title, children }: { dateline?: string; title: string; children?: ReactNode }) {
  return (
    <div>
      {dateline && <p className="font-sans text-sm font-semibold text-ink-muted">{dateline}</p>}
      <h1 className="font-display font-bold text-[28px] sm:text-[34px] leading-[1.15] tracking-[-0.01em] text-ink">{title}</h1>
      {children && <p className="font-sans text-[16.5px] leading-normal text-ink mt-2 max-w-[34em]">{children}</p>}
    </div>
  )
}

export function Sect({ title, action, id, children, className = '' }: { title: string; action?: ReactNode; id?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`mt-7 ${className}`}>
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <h2 id={id} className="font-sans font-bold text-lg text-ink">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

// The daily schedule. On a camp day it folds to "Right now" with the full day one tap away.
export function ScheduleBlock({ items, live }: { items: ScheduleItem[]; live: boolean }) {
  if (items.length === 0) return null
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const cur = live ? currentItem(items, minutes) : null
  const list = (
    <ol className="mt-1">
      {items.map(item => {
        const on = cur?.id === item.id
        const past = live && !on && toMinutes(item.end_time ?? item.start_time) <= minutes
        return (
          <li key={item.id} className={`grid grid-cols-[9.5rem_1fr] gap-2.5 py-2 border-b border-border last:border-0 ${on ? 'shadow-[inset_3px_0_0_var(--brand)] pl-2.5' : ''}`}>
            <span className={`font-sans text-[13.5px] whitespace-nowrap tabular-nums pt-px ${on ? 'text-ink font-bold' : past ? 'text-ink-faint' : 'text-ink-muted'}`}>
              {formatTimeRange(item.start_time, item.end_time)}
            </span>
            <span className="min-w-0">
              <span className={`block font-sans text-[15px] font-semibold leading-snug ${past ? 'text-ink-faint' : 'text-ink'}`}>{item.title}</span>
              {item.location && <span className="block font-sans text-sm text-ink-muted">{item.location}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
  if (!live) return <Sect title="The daily schedule">{list}</Sect>
  return (
    <section className="mt-7">
      <details className="group" open={typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches}>
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-11 flex items-center justify-between gap-3">
          <span>
            <span className="block font-sans text-sm font-semibold text-ink-muted">
              {cur ? `Right now${cur.end_time ? `, until ${formatTime(cur.end_time)}` : ''}` : "Today's schedule"}
            </span>
            {cur && <span className="font-sans text-[17px] font-bold text-ink">{cur.title}{cur.location && <span className="font-medium text-ink-muted text-[15px]">, {cur.location.toLowerCase()}</span>}</span>}
          </span>
          <span className="flex items-center gap-1 font-sans text-sm font-semibold text-ink-muted shrink-0">
            Full day <ChevronDown size={15} className="transition group-open:rotate-180" aria-hidden="true" />
          </span>
        </summary>
        {list}
      </details>
    </section>
  )
}

export function LatestUpdate() {
  const { updates, loading } = useUpdates(1)
  return (
    <Sect title="Latest from the camp" action={<Link to="/volunteer/updates" className={linkCls}>All updates</Link>}>
      <div className={`${listCls} px-4`}>
        <UpdatesFeed updates={updates} loading={loading} compact emptyText="Nothing posted yet." />
      </div>
    </Sect>
  )
}

// "Week 1" date chip + class + where/when, one row per section.
export function ClassList({ sections }: { sections: AssignedSection[] }) {
  return (
    <div className={listCls}>
      {sections.map(s => (
        <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
          {s.week && (
            <span className="w-11 text-center shrink-0 leading-tight">
              <span className="block font-sans text-[12.5px] font-semibold text-ink-muted">Week</span>
              <span className="block font-sans text-xl font-bold text-ink">{s.week}</span>
            </span>
          )}
          <span className="flex-1 min-w-0">
            <span className="block font-sans text-base font-semibold text-ink leading-snug">{s.class_name}, {s.label}</span>
            <span className="block font-sans text-sm text-ink-muted">{whereWhen(s)}</span>
          </span>
          <span className="shrink-0 rounded-full px-2.5 py-0.5 font-sans text-[12.5px] font-semibold bg-role-volunteer-soft text-role-volunteer">
            {s.is_lead ? 'Lead' : 'Support'}
          </span>
        </div>
      ))}
    </div>
  )
}
