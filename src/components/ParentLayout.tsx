import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CircleHelp, LogOut, Moon, UserPlus, UsersRound } from 'lucide-react'
import wordmark from '../../assets/sccdenver.png'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useUpdates } from '../hooks/useUpdates'

const TABS = [
  { to: '/parent', label: 'Home', end: true },
  { to: '/parent/classes', label: 'Classes', end: false },
  { to: '/parent/updates', label: 'Updates', end: false },
]

// Per user (suffixed with the user id) so parents sharing a device don't mark each other's posts read.
const SEEN_KEY = 'scc-updates-seen'
// Posts fetched for the count; a full page reads as "5+".
const POST_LIMIT = 5

// Parent shell (issue #167), the same shape as the volunteer one: Home / Classes / Updates tabs that
// stick to the top on phones (iOS Safari's toolbar owns the bottom edge), and the once-a-year details
// under the avatar (Family details). The Updates tab carries the unread count the bell used to.
// Registration is a focused flow, so it hides the tabs.
//
// Terminal Yellow (DESIGN.md › Navigation): an ink bar with the wordmark and the avatar, then an ink
// strip of equal top tabs on phones; from 768px the tabs move inline into a 64px bar. The current
// tab is white with a 4px gold underline, the only gold in the shell. The avatar opens an inline
// popover framed by a 2px ink rule (never a modal) with the family pages, help and dark mode.
export default function ParentLayout() {
  const { pathname, hash } = useLocation()
  const { profile, user, signOut } = useAuth()
  const registering = pathname.startsWith('/parent/register')

  const [menuOpen, setMenuOpen] = useState(false)
  const { dark, toggle: toggleTheme } = useTheme()
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    // Escape closes the menu and puts focus back on the avatar it came from.
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && menuRef.current?.contains(document.activeElement)) buttonRef.current?.focus()
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  // A new tab starts at the top, like a new page would (unless the link points into the page).
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  // Unread posts: anything newer than the last visit to the Updates tab (per user, per device).
  const { updates: posts } = useUpdates(POST_LIMIT)
  const seenKey = `${SEEN_KEY}:${user?.id ?? ''}`
  const readSeen = () => { try { return localStorage.getItem(seenKey) ?? '' } catch { return '' } }
  const [seen, setSeen] = useState(() => ({ key: seenKey, at: readSeen() }))
  if (seen.key !== seenKey) setSeen({ key: seenKey, at: readSeen() })
  const onUpdates = pathname === '/parent/updates'
  const latest = posts[0]?.created_at
  useEffect(() => {
    if (!onUpdates || !latest) return
    try { localStorage.setItem(seenKey, latest) } catch { /* private mode */ }
  }, [onUpdates, latest, seenKey])
  if (onUpdates && latest && seen.at < latest) setSeen({ key: seenKey, at: latest })
  const unread = posts.filter(p => p.created_at > seen.at).length
  const unreadLabel = unread === POST_LIMIT ? `${unread}+` : String(unread)

  const name = profile?.display_name ?? 'Parent'
  const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'P'
  // The count is a pill on ink, not gold: gold in the shell marks only the current tab.
  const count = unread > 0 && (
    <span className="ml-2 min-w-[22px] px-2 rounded-full border border-on-shell-muted bg-shell-raised text-on-shell text-sm font-bold leading-[20px] text-center">
      <span aria-hidden="true">{unreadLabel}</span><span className="sr-only">, {unreadLabel} new</span>
    </span>
  )
  // Focus on ink is gold (the shared ink ring would vanish on the bar). `!` because the global
  // :focus-visible rule in index.css sits outside Tailwind's layers.
  const onInk = 'focus-visible:outline-brand!'
  const tabCls = (isActive: boolean) => `flex items-center justify-center font-bold transition-colors ${onInk} ${
    isActive ? 'text-on-shell shadow-[inset_0_-4px_0_var(--brand)]' : 'text-on-shell-muted hover:text-on-shell'}`
  const itemCls = 'w-full flex items-center gap-3 min-h-11 px-4 text-left text-ink hover:bg-bg transition-colors'
  const close = () => setMenuOpen(false)

  return (
    <div className="min-h-dvh bg-bg">
      <header className="md:sticky md:top-0 z-40 bg-shell text-on-shell pt-[env(safe-area-inset-top)] dark:shadow-[inset_0_-1px_0_var(--border)]">
        <div className="relative max-w-[1280px] mx-auto h-14 md:h-16 flex items-center gap-4 px-4 md:px-8">
          <Link to="/parent" aria-label="Steel City Codes // Denver, Home" className={`min-h-11 flex items-center shrink-0 ${onInk}`}>
            <img src={wordmark} alt="" className="h-7 md:h-8 w-auto" />
          </Link>

          {!registering && (
            <nav aria-label="Parent" className="hidden md:flex self-stretch gap-1">
              {TABS.map(({ to, label, end }) => (
                <NavLink key={to} to={to} end={end} onClick={close} className={({ isActive }) => `${tabCls(isActive)} px-4`}>
                  {label}{to === '/parent/updates' && count}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto" ref={menuRef}>
            <button ref={buttonRef} type="button" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-controls="parent-menu"
              aria-label={`${name}, account menu`}
              className={`w-11 h-11 grid place-items-center rounded-full border-2 border-on-shell-muted hover:border-brand text-on-shell text-sm font-bold transition-colors ${onInk}`}>
              {initials}
            </button>

            {menuOpen && (
              <div id="parent-menu" className="absolute right-4 md:right-8 top-[calc(100%-4px)] w-[min(320px,calc(100vw-2rem))] py-2 rounded border-2 border-ink bg-surface text-ink z-50">
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-bold truncate">{name}</p>
                  <p className="text-sm text-ink-muted truncate">{user?.email}</p>
                </div>
                <Link to="/parent/family" onClick={close} className={itemCls}>
                  <UsersRound size={20} strokeWidth={2.25} aria-hidden="true" /> Family details
                </Link>
                <Link to="/parent/register" onClick={close} className={itemCls}>
                  <UserPlus size={20} strokeWidth={2.25} aria-hidden="true" /> Register a new camper
                </Link>
                <Link to="/parent/help" onClick={close} className={itemCls}>
                  <CircleHelp size={20} strokeWidth={2.25} aria-hidden="true" /> Help
                </Link>
                <label className={`${itemCls} cursor-pointer`}>
                  <Moon size={20} strokeWidth={2.25} aria-hidden="true" />
                  <span className="flex-1">Dark mode</span>
                  <input type="checkbox" role="switch" className="ui-switch" checked={dark} onChange={toggleTheme} />
                </label>
                <button type="button" onClick={signOut} className={`${itemCls} mt-2 pt-2 border-t border-border`}>
                  <LogOut size={20} strokeWidth={2.25} aria-hidden="true" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!registering && (
        <nav aria-label="Parent" className="md:hidden sticky top-0 z-30 bg-shell grid grid-cols-3 px-2 border-t border-shell-raised dark:shadow-[inset_0_-1px_0_var(--border)]">
          {TABS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={close} className={({ isActive }) => `${tabCls(isActive)} h-12 px-2`}>
              {label}{to === '/parent/updates' && count}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="min-w-0 max-w-[1280px] mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
        {/* Every parent page shows how to reach the camp (spec 11). */}
        <p className="mt-12 text-sm text-ink-muted">
          Questions or changes? Email the camp at{' '}
          <a href="mailto:denver@steelcitycodes.org" className="inline-flex items-center min-h-11 font-bold text-ink underline underline-offset-[3px]">denver@steelcitycodes.org</a>.
        </p>
      </main>
    </div>
  )
}
