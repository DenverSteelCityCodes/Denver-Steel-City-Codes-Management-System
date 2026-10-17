import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCircle2 } from 'lucide-react'
import { useAdminAttention } from '../hooks/useAdminAttention'

// Top-bar bell: a dropdown of the same "Needs attention" queue as the dashboard. The dot only
// shows when something is actually waiting. Remounted on navigation (keyed by path) so it's fresh.
export default function AttentionBell() {
  const { items, loading } = useAdminAttention()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = loading ? 0 : items.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={count > 0 ? `Needs attention: ${count} item${count === 1 ? '' : 's'}` : 'Notifications'}
        aria-expanded={open}
        className="relative text-white/70 hover:text-white p-2 rounded-[10px] hover:bg-white/10 transition"
      >
        <Bell size={18} />
        {count > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand ring-2 ring-ink-950" />}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-surface-raised border border-border rounded-[12px] shadow-lg z-50 overflow-hidden">
          <p className="px-4 pt-3 pb-2 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Needs attention</p>
          {loading ? (
            <div className="px-4 pb-4 space-y-2">
              {[1, 2].map(i => <div key={i} className="h-10 bg-surface-sunken rounded-[8px] animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 pb-4 flex items-center gap-2 font-sans text-sm text-ink-muted">
              <CheckCircle2 size={16} className="text-success" /> You're all caught up.
            </div>
          ) : (
            <ul className="pb-1.5">
              {items.map(item => {
                const Icon = item.icon
                return (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-sunken transition"
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.iconWrap}`}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-sans font-semibold text-sm text-ink">{item.title}</span>
                        <span className="block font-sans text-xs text-ink-muted">{item.detail}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
