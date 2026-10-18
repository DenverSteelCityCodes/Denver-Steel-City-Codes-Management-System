import type { ReactNode } from 'react'

// The frame of an admin page: the Josefin page title, an optional one-line description and the
// page's own actions. The shell (AdminLayout) owns navigation between pages; views of one page on
// the same route (Volunteers' Applications and Crew) are a Segmented control in "tabs" mode under
// this head.

export const pageClass = 'max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8'
export const h2Class = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-balance'

export default function AdminPageHead({ title, lede, actions, tabs = false }: {
  title: string
  lede?: ReactNode
  actions?: ReactNode
  // In-page tabs follow right under the head; without them the content gets the full gap.
  tabs?: boolean
}) {
  return (
    <div className={`flex flex-wrap items-end gap-x-6 gap-y-3 ${tabs ? 'mb-4' : 'mb-6'}`}>
      <div className="flex-1 min-w-[min(100%,16rem)]">
        <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">{title}</h1>
        {lede && <p className="mt-1 text-ink-muted text-pretty max-w-[65ch]">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
