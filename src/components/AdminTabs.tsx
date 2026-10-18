import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// The frame of an admin page that holds several jobs (DESIGN.md › Navigation): the Josefin page
// title, an optional one-line description and the page's own actions, then sub-tabs on the floor.
// Sub-tabs are links (each tab is its own route or ?tab=), so they are a <nav> with aria-current,
// not an ARIA tablist: ink text, a 4px ink underline on the current one, gold stays in the shell.

export const pageClass = 'max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8'
export const h2Class = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-balance'

export function AdminPageHead({ title, lede, actions }: { title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-3">
      <div className="flex-1 min-w-[min(100%,16rem)]">
        <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">{title}</h1>
        {lede && <p className="mt-1 text-ink-muted text-pretty max-w-[65ch]">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export interface AdminTab { to: string; label: string; count?: number | null; current: boolean }

export default function AdminTabs({ label, tabs }: { label: string; tabs: AdminTab[] }) {
  return (
    <nav aria-label={label} className="mb-6 border-b border-border">
      <ul className="flex gap-1 sm:gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(t => (
          <li key={t.to} className="shrink-0">
            <Link
              to={t.to}
              aria-current={t.current ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 min-h-12 px-2 sm:px-3 font-bold whitespace-nowrap no-underline focus-visible:outline-offset-[-3px] ${
                t.current ? 'text-ink shadow-[inset_0_-4px_0_var(--ink)]' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
              {t.count ? <span className="font-semibold tabular-nums">{t.count}<span className="sr-only"> pending</span></span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export type VolunteersTab = 'applications' | 'interviews' | 'crew' | 'duties'

// Applications → Interviews → Crew → Duties: one pipeline under Volunteers, on the existing routes.
// The Applications tab carries the pending count; pages that already load applications pass it,
// the others let the strip count them with one head-only read.
export function VolunteersTabs({ current, pending }: { current: VolunteersTab; pending?: number }) {
  const [counted, setCounted] = useState<number | null>(null)
  useEffect(() => {
    if (pending !== undefined) return
    let alive = true
    supabase.from('volunteer_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count, error }) => { if (alive && !error) setCounted(count ?? 0) })
    return () => { alive = false }
  }, [pending])
  const count = pending ?? counted
  return (
    <AdminTabs label="Volunteers" tabs={[
      { to: '/admin/volunteers?tab=applications', label: 'Applications', count, current: current === 'applications' },
      { to: '/admin/interviews', label: 'Interviews', current: current === 'interviews' },
      { to: '/admin/volunteers?tab=crew', label: 'Crew', current: current === 'crew' },
      { to: '/admin/duties', label: 'Duties', current: current === 'duties' },
    ]} />
  )
}

export type SetupTab = 'season' | 'forms' | 'users'

// Set once a season, out of the daily path: Season · Forms · Users & roles.
export function SetupTabs({ current }: { current: SetupTab }) {
  return (
    <AdminTabs label="Setup" tabs={[
      { to: '/admin/sessions', label: 'Season', current: current === 'season' },
      { to: '/admin/forms', label: 'Forms', current: current === 'forms' },
      { to: '/admin/users', label: 'Users & roles', current: current === 'users' },
    ]} />
  )
}
