import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useAdminAttention } from '../hooks/useAdminAttention'

// §2 — the "Needs attention" work queue. Renders only items with a real count > 0; a clean
// board shows the friendly all-caught-up empty state. Loading shows skeleton rows, not a spinner.
export default function AdminNeedsAttention() {
  const { items, loading } = useAdminAttention()

  return (
    <section>
      <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">
        Needs attention
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="bg-surface border border-border rounded-xl shadow-sm p-5 h-[104px] animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-warning" />
          </div>
          <div>
            <p className="font-sans font-semibold text-sm text-ink">You're all caught up ✨</p>
            <p className="font-sans text-xs text-ink-muted">No classes, applications, or interviews need action right now.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map(item => {
            const Icon = item.icon
            return (
              <div
                key={item.key}
                className={`bg-surface border border-border rounded-xl shadow-sm p-5 flex items-start gap-4 ${item.cardCls} ${
                  item.wide ? 'sm:col-span-2' : ''
                }`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${item.iconWrap}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h3 className="font-sans font-semibold text-sm text-ink">{item.title}</h3>
                    {item.badge && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${item.badgeCls}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="font-sans text-xs text-ink-muted">{item.detail}</p>
                </div>
                <Link
                  to={item.to}
                  className="shrink-0 self-center inline-flex items-center gap-1.5 h-9 px-3 bg-surface border border-border-strong text-ink font-sans font-semibold text-xs rounded-[8px] hover:bg-surface-sunken transition shadow-sm"
                >
                  {item.ctaLabel} <ArrowRight size={13} />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
