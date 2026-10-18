import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Sun, Moon, LogOut, ChevronDown, Home, GraduationCap, Megaphone, UsersRound, UserPlus } from 'lucide-react'
import wordmark from '../../assets/sccdenver.png'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useUpdates } from '../hooks/useUpdates'

const TABS = [
  { to: '/parent', label: 'Home', icon: Home, end: true },
  { to: '/parent/classes', label: 'Classes', icon: GraduationCap, end: false },
  { to: '/parent/updates', label: 'Updates', icon: Megaphone, end: false },
]

// Per user (suffixed with the user id) so parents sharing a device don't mark each other's posts read.
const SEEN_KEY = 'scc-updates-seen'
// Posts fetched for the count; a full page reads as "5+".
const POST_LIMIT = 5

// Parent shell (issue #167), the same shape as the volunteer one: Home / Classes / Updates tabs that
// stick to the top on phones (iOS Safari's toolbar owns the bottom edge), and the once-a-year details
// under the avatar (Family details). The Updates tab carries the unread count the bell used to.
// Registration is a focused flow, so it hides the tabs.
export default function ParentLayout() {
  const { pathname, hash } = useLocation()
  const { profile, user, signOut } = useAuth()
  const registering = pathname.startsWith('/parent/register')

  const [menuOpen, setMenuOpen] = useState(false)
  const { dark, toggle: toggleTheme } = useTheme()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false) }
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
  const count = unread > 0 && (
    <span aria-label={`${unreadLabel} new`} className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-brand text-brand-on font-sans text-[11px] font-bold leading-[19px] text-center">
      {unreadLabel}
    </span>
  )
  const itemCls = 'w-full flex items-center gap-2.5 px-3 h-11 rounded-[10px] font-sans text-[15px] font-semibold text-ink hover:bg-surface-sunken transition'

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sm:sticky sm:top-0 z-40 h-14 sm:h-16 bg-ink-950 flex items-center gap-3 pl-4 pr-2 sm:px-6">
        <Link to="/parent" aria-label="Home" className="h-11 flex items-center"><img src={wordmark} alt="Steel City Codes // Denver" className="h-7 sm:h-8 w-auto" /></Link>

        {!registering && (
          <nav aria-label="Parent" className="hidden sm:flex ml-4 items-center gap-1">
            {TABS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[10px] font-sans text-[15px] font-semibold transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                <Icon size={16} aria-hidden="true" /> {label}{to === '/parent/updates' && count}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="ui-iconbtn text-on-shell-muted hover:text-on-shell">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Account menu" aria-haspopup="menu" aria-expanded={menuOpen}
              className="h-11 flex items-center gap-1.5 px-1.5 rounded-full hover:bg-white/10 transition">
              <span className="w-8 h-8 rounded-full bg-role-parent-soft text-role-parent ring-2 ring-on-shell-muted flex items-center justify-center font-sans font-bold text-xs">
                {initials}
              </span>
              <ChevronDown size={14} className="text-white/60 hidden sm:block" />
            </button>

            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-64 bg-surface-raised border border-border rounded-[14px] shadow-lg p-1.5 z-50">
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <div className="font-sans font-semibold text-base text-ink truncate">{name}</div>
                  <div className="font-sans text-sm text-ink-muted truncate">{user?.email}</div>
                </div>
                <Link role="menuitem" to="/parent/family" onClick={() => setMenuOpen(false)} className={itemCls}>
                  <UsersRound size={16} /> Family details
                </Link>
                <Link role="menuitem" to="/parent/register" onClick={() => setMenuOpen(false)} className={itemCls}>
                  <UserPlus size={16} /> Register a new camper
                </Link>
                <button role="menuitem" onClick={signOut} className={`${itemCls} border-t border-border mt-1 rounded-t-none`}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!registering && (
        <nav aria-label="Parent" className="sm:hidden sticky top-0 z-30 h-12 bg-ink-950 grid grid-cols-3 border-t border-white/10">
          {TABS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `relative flex items-center justify-center gap-1.5 font-sans text-[15px] font-semibold transition ${
                isActive ? 'text-white after:absolute after:left-3.5 after:right-3.5 after:bottom-0 after:h-[3px] after:rounded-t-[3px] after:bg-brand' : 'text-white/70'}`}>
              {label}{to === '/parent/updates' && count}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="min-w-0 max-w-[1080px] mx-auto px-4 sm:px-8 pt-5 sm:pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
        {/* Every parent page shows how to reach the camp (spec 11). */}
        <p className="mt-10 font-sans text-[15px] text-ink-muted">
          Questions or changes? Email the camp at{' '}
          <a href="mailto:denver@steelcitycodes.org" className="font-semibold text-ink underline decoration-brand-hover decoration-2 underline-offset-4">denver@steelcitycodes.org</a>.
        </p>
      </main>
    </div>
  )
}
