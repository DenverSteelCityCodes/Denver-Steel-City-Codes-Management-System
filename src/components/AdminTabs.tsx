import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// The frame of an admin page: the Josefin page title, an optional one-line description and the
// page's own actions. The shell (AdminLayout) owns navigation between pages; AdminTabs is only for
// views of one page on the same route (?tab=), such as Volunteers' Applications and Crew. Each view
// keeps its own URL, so the tabs are links in a <nav> with aria-current: ink text and a 4px ink
// underline on the current one, gold stays in the shell.

export const pageClass = 'max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8'
export const h2Class = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-balance'

export function AdminPageHead({ title, lede, actions, tabs = false }: {
  title: string
  lede?: ReactNode
  actions?: ReactNode
  // Tabs follow right under the head; without them the content gets the full gap.
  tabs?: boolean
}) {
  return (
    <div className={`flex flex-wrap items-end gap-x-6 gap-y-3 ${tabs ? 'mb-3' : 'mb-6'}`}>
      <div className="flex-1 min-w-[min(100%,16rem)]">
        <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">{title}</h1>
        {lede && <p className="mt-1 text-ink-muted text-pretty max-w-[65ch]">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export interface AdminTab { to: string; label: string; count?: number | null; countLabel?: string; current: boolean }

export default function AdminTabs({ label, tabs }: { label: string; tabs: AdminTab[] }) {
  return (
    <nav aria-label={label} className="mb-6 border-b border-border">
      <ul className="relative flex gap-1 sm:gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(t => (
          <li key={t.to} className="shrink-0">
            <Link
              to={t.to}
              replace
              aria-current={t.current ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 min-h-12 px-2 sm:px-3 font-bold whitespace-nowrap no-underline focus-visible:outline-offset-[-3px] ${
                t.current ? 'text-ink shadow-[inset_0_-4px_0_var(--ink)]' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
              {t.count ? <span className="font-semibold tabular-nums">{t.count}{t.countLabel && <span className="sr-only"> {t.countLabel}</span>}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
