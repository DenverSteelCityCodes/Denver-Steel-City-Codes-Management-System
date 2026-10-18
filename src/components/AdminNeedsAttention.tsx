import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAdminAttention } from '../hooks/useAdminAttention'

// The To do list (DESIGN.md › Decision List): one decision per row between 2px ink rules, a
// white-on-ink pictogram (red only for safety and failures), the decision, why, and one text action.
// Already severity-sorted by useAdminAttention.
export default function AdminNeedsAttention() {
  const { items, loading } = useAdminAttention()

  if (loading) {
    return (
      <ul aria-busy="true" aria-label="Loading to do">
        {[0, 1, 2].map(i => (
          <li key={i} className="grid grid-cols-[40px_1fr] gap-x-4 py-4 border-t-2 border-ink last:border-b-2">
            <span className="w-10 h-10 rounded bg-surface-sunken animate-pulse" />
            <span className="h-10 rounded bg-surface-sunken animate-pulse" />
          </li>
        ))}
      </ul>
    )
  }

  if (items.length === 0) {
    return <p className="py-4 border-y-2 border-ink text-lg font-bold">Nothing needs you right now.</p>
  }

  return (
    <ul>
      {items.map(item => {
        const Icon = item.icon
        return (
          <li key={item.key} className="grid grid-cols-[40px_1fr] gap-x-4 gap-y-1 py-4 border-t-2 border-ink last:border-b-2">
            <span aria-hidden="true" className={`w-10 h-10 grid place-items-center rounded text-white ${item.tone === 'danger' ? 'bg-alarm' : 'bg-shell dark:bg-shell-raised'}`}>
              <Icon size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-[1.3] text-pretty">{item.title}</p>
              <p className="mt-1 text-ink-muted text-pretty">{item.detail}</p>
            </div>
            <div className="col-start-2">
              <Link to={item.to} className="inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px]">
                {item.ctaLabel} <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
