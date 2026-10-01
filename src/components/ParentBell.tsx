import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CircleCheck, List, ShieldCheck, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations } from '../hooks/useRegistrations'
import { useSessions, activeCampYear } from '../hooks/useSessions'
import { useUpdates, audienceLabel } from '../hooks/useUpdates'
import { timeAgo } from '../lib/campDay'

const SEEN_KEY = 'scc-updates-seen'

interface Update {
  key: string
  icon: LucideIcon
  tone: string
  text: string
  to: string
  needsAction: boolean
}

// Parent top-bar bell: real updates derived from their campers' registrations. The dot only shows
// when something needs the parent. Remounted on navigation (keyed by path) so it stays fresh.
export default function ParentBell() {
  const { students, loading: sLoading } = useStudents()
  const { registrations, loading: rLoading } = useRegistrations()
  const { sessions } = useSessions()
  const { updates: posts } = useUpdates(5)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const campYear = activeCampYear(sessions)

  // Unread posts: anything newer than when the bell was last opened (per device).
  const [seenAt, setSeenAt] = useState<string>(() => { try { return localStorage.getItem(SEEN_KEY) ?? '' } catch { return '' } })
  const unread = posts.filter(p => p.created_at > seenAt).length
  function toggle() {
    setOpen(o => !o)
    if (!open && posts[0]) {
      const latest = posts[0].created_at
      try { localStorage.setItem(SEEN_KEY, latest) } catch { /* private mode */ }
      setSeenAt(latest)
    }
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const nameOf = (id: string) => students.find(s => s.id === id)?.full_name ?? 'Your camper'
  const updates: Update[] = [
    ...students
      .filter(s => s.registration_year !== campYear && sessions.length > 0)
      .map(s => ({
        key: `confirm-${s.id}`, icon: ShieldCheck, tone: 'bg-info-soft text-info',
        text: `Confirm ${s.full_name}'s details for ${campYear} before registering`,
        to: `/parent/classes?camper=${s.id}`, needsAction: true,
      })),
    ...registrations
      .filter(r => r.status === 'waitlisted')
      .map(r => ({
        key: `wait-${r.id}`, icon: List, tone: 'bg-info-soft text-info',
        text: `${nameOf(r.student_id)} is on the waitlist for ${r.sections?.classes?.name ?? 'a class'}`,
        to: '/parent', needsAction: false,
      })),
    ...registrations
      .filter(r => r.status === 'confirmed')
      .map(r => ({
        key: `ok-${r.id}`, icon: CircleCheck, tone: 'bg-success-soft text-success',
        text: `${nameOf(r.student_id)}'s spot in ${r.sections?.classes?.name ?? 'a class'} is confirmed`,
        to: '/parent', needsAction: false,
      })),
  ]
  const loading = sLoading || rLoading
  const actionCount = loading ? 0 : updates.filter(u => u.needsAction).length + unread

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={actionCount > 0 ? `Updates: ${actionCount} new` : 'Updates'}
        className="relative text-white/70 hover:text-white p-2 rounded-[10px] hover:bg-white/10 transition"
      >
        <Bell size={18} />
        {actionCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand ring-2 ring-ink-950" />}
      </button>
      {open && (
        <div className="fixed left-4 right-4 top-[4.25rem] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] bg-surface-raised border border-border rounded-[12px] shadow-lg z-50 overflow-hidden">
          {posts.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">From camp</p>
              <ul className="pb-1.5 border-b border-border">
                {posts.map(p => (
                  <li key={p.id}>
                    <Link to="/parent#updates" onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-surface-sunken transition">
                      <span className="block font-sans text-xs text-ink-muted">{p.author_name} · {audienceLabel(p)} · {timeAgo(p.created_at)}</span>
                      <span className="block font-sans text-sm text-ink line-clamp-2">{p.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="px-4 pt-3 pb-2 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Your campers</p>
          {loading ? (
            <div className="px-4 pb-4"><div className="h-10 bg-surface-sunken rounded-[8px] animate-pulse" /></div>
          ) : updates.length === 0 ? (
            <p className="px-4 pb-4 flex items-center gap-2 font-sans text-sm text-ink-muted">
              <CheckCircle2 size={16} className="text-success" /> Nothing new right now.
            </p>
          ) : (
            <ul className="pb-1.5 max-h-80 overflow-y-auto">
              {updates.map(u => {
                const Icon = u.icon
                return (
                  <li key={u.key}>
                    <Link to={u.to} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-sunken transition">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${u.tone}`}><Icon size={14} /></span>
                      <span className="font-sans text-sm text-ink">{u.text}</span>
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
