import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ArrowRight } from 'lucide-react'
import type { AttentionItem } from '../hooks/useAdminAttention'
import { useUpdates, audienceLabel } from '../hooks/useUpdates'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../lib/campDay'

// Top-bar bell: the same To do queue as Today, reachable from every page, in an inline popover
// framed by a 2px ink rule (DESIGN.md › One Ply). The dot only shows when something is waiting.
// The shell owns the queue (one copy, reloaded on navigation) and hands it in. Updates posted by
// someone else (a section lead) follow the queue; the admin's own posts are on Updates.
export default function AttentionBell({ items, loading }: { items: AttentionItem[]; loading: boolean }) {
  const { user } = useAuth()
  const { updates } = useUpdates(5)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = loading ? 0 : items.length
  const fromOthers = updates.filter(u => u.author_id !== user?.id).slice(0, 3)
  const row = 'flex items-start gap-3 px-4 py-3 no-underline hover:bg-bg transition-colors'

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={count > 0 ? `Needs attention, ${count} item${count === 1 ? '' : 's'}` : 'Needs attention, nothing waiting'}
        aria-expanded={open}
        aria-controls="attention-list"
        className="ui-iconbtn text-on-shell-muted hover:text-on-shell"
      >
        <Bell size={20} strokeWidth={2.25} />
        {count > 0 && <span aria-hidden="true" className="absolute top-[9px] right-[9px] w-2 h-2 rounded-full bg-on-shell" />}
      </button>

      {open && (
        <div id="attention-list"
          className="fixed left-4 right-4 top-[3.75rem] md:absolute md:left-auto md:right-0 md:top-[calc(100%+6px)] md:w-[24rem] max-h-[calc(100dvh-5rem)] overflow-y-auto py-2 rounded border-2 border-ink bg-surface text-ink z-50 [&_:focus-visible]:outline-focus">
          <p className="px-4 pt-2 pb-1 text-sm font-bold text-ink-muted">Needs attention</p>
          {loading ? (
            <div aria-hidden="true" className="px-4 py-2 space-y-2">
              {[1, 2].map(i => <div key={i} className="h-10 rounded bg-surface-sunken animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 pb-3">Nothing needs you right now.</p>
          ) : (
            <ul>
              {items.map((item, i) => {
                const Icon = item.icon
                return (
                  <li key={item.key} className={i > 0 ? 'border-t border-border' : undefined}>
                    <Link to={item.to} onClick={() => setOpen(false)} className={row}>
                      <span aria-hidden="true" className={`w-8 h-8 grid place-items-center rounded shrink-0 ${item.tone === 'danger' ? 'bg-alarm text-white' : 'bg-shell text-on-shell'}`}>
                        <Icon size={18} strokeWidth={2.25} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block font-bold leading-snug ${item.tone === 'danger' ? 'text-danger' : ''}`}>{item.title}</span>
                        <span className="block text-sm text-ink-muted text-pretty">{item.detail}</span>
                      </span>
                      <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" className="mt-1 shrink-0 text-ink-muted" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {fromOthers.length > 0 && (
            <div className="mt-2 pt-2 border-t-2 border-ink">
              <p className="px-4 pt-2 pb-1 text-sm font-bold text-ink-muted">Posted by others</p>
              <ul>
                {fromOthers.map((u, i) => (
                  <li key={u.id} className={i > 0 ? 'border-t border-border' : undefined}>
                    <Link to="/admin/updates" onClick={() => setOpen(false)} className="block px-4 py-3 no-underline hover:bg-bg transition-colors">
                      <span className="block text-sm text-ink-muted">{u.author_name} to {audienceLabel(u)} · {timeAgo(u.created_at)}</span>
                      <span className="block line-clamp-2">{u.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
