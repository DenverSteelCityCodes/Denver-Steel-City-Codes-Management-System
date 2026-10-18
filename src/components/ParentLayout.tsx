import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Contact, Moon, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useUpdates } from '../hooks/useUpdates'
import type { ParentShell } from '../lib/parentShell'
import wordmark from '../../assets/sccdenver.png'

// Per user (suffixed with the user id) so parents sharing a device don't mark each other's posts read.
const SEEN_KEY = 'scc-updates-seen'

const TABS = [
  { to: '/parent', label: 'Home', match: (p: string) => p === '/parent' },
  { to: '/parent/classes', label: 'Classes', match: (p: string) => p.startsWith('/parent/classes') || p.startsWith('/parent/register') },
  { to: '/parent/updates', label: 'Updates', match: (p: string) => p.startsWith('/parent/updates') },
]

// Parent shell (DESIGN.md › Navigation): an ink bar with the wordmark (a link Home) and the avatar,
// and top tabs at every width. Phones get the tabs as a 48px strip under the bar; from 768px they sit
// inline in the bar. Top tabs, never a bottom bar: iOS Safari's toolbar owns the bottom edge.
// Settings live under the avatar: contact details, Dark mode, Sign out.
export default function ParentLayout() {
  const { pathname, hash } = useLocation()
  const { profile, user, signOut } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const { updates: posts, loading: postsLoading, error: postsError } = useUpdates(20)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)

  // The menu closes on an outside tap, on Escape (focus back on the avatar) and on navigation.
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setMenuOpen(false); avatarRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) { setMenuPath(pathname); setMenuOpen(false) }

  // A new tab starts at the top, like a new page would (unless the link points into the page).
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  // Unread posts: anything newer than the last visit to the Updates tab (per user, per device).
  const seenKey = `${SEEN_KEY}:${user?.id ?? ''}`
  const readSeen = () => { try { return localStorage.getItem(seenKey) ?? '' } catch { return '' } }
  const [seen, setSeen] = useState(() => ({ key: seenKey, at: readSeen() }))
  if (seen.key !== seenKey) setSeen({ key: seenKey, at: readSeen() })
  const onUpdates = pathname.startsWith('/parent/updates')
  const latest = posts[0]?.created_at ?? ''
  if (onUpdates && latest && seen.at < latest) setSeen({ key: seenKey, at: latest })
  useEffect(() => {
    if (!seen.at) return
    try { localStorage.setItem(seen.key, seen.at) } catch { /* private mode */ }
  }, [seen])
  const unread = onUpdates ? 0 : posts.filter(p => p.created_at > seen.at).length

  const name = profile?.display_name ?? 'Parent'
  const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'P'
  const shell: ParentShell = { posts, postsLoading, postsError }

  const tabs = (inline: boolean) => TABS.map(t => {
    const current = t.match(pathname)
    return (
      <Link
        key={t.to}
        to={t.to}
        aria-current={current ? 'page' : undefined}
        className={`${inline ? 'px-4' : 'flex-1 min-h-12 px-2'} flex items-center justify-center font-bold transition-colors ${
          current ? 'text-on-shell shadow-[inset_0_-4px_0_var(--color-brand)]' : 'text-on-shell-muted hover:text-on-shell'}`}
      >
        {t.label}
        {t.label === 'Updates' && unread > 0 && (
          <>
            <span aria-hidden="true" className="ml-1.5 w-2 h-2 rounded-full bg-on-shell" />
            <span className="sr-only">, {unread} new</span>
          </>
        )}
      </Link>
    )
  })

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <header className="sticky top-0 z-40 bg-shell text-on-shell pt-[env(safe-area-inset-top)] dark:shadow-[inset_0_-1px_0_#2E2A25]">
        <div ref={menuRef} className="relative max-w-[1280px] mx-auto h-14 md:h-16 flex items-center gap-4 px-4 md:px-8">
          <Link to="/parent" className="inline-flex items-center min-h-11 shrink-0">
            <img src={wordmark} alt="Steel City Codes // Denver, home" className="h-7 md:h-8 w-auto" />
          </Link>

          <nav aria-label="Main" className="hidden md:flex self-stretch gap-1">{tabs(true)}</nav>

          <button
            ref={avatarRef}
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-controls="parent-menu"
            aria-label={`${name}, account menu`}
            className="ml-auto w-11 h-11 shrink-0 grid place-items-center rounded-full border-2 border-on-shell-muted hover:border-brand text-sm font-bold transition-colors"
          >
            {initials}
          </button>

          {menuOpen && (
            <div id="parent-menu" className="absolute right-4 md:right-8 top-full mt-1 w-[min(320px,calc(100vw-2rem))] bg-surface text-ink border-2 border-ink rounded py-2 z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="font-bold">{name}</p>
                {user?.email && <p className="text-sm text-ink-muted break-all">{user.email}</p>}
              </div>
              <Link to="/parent/contact" className="flex items-center gap-3 min-h-11 px-4 hover:bg-bg">
                <Contact size={20} strokeWidth={2.25} aria-hidden="true" /> Your contact details
              </Link>
              <label className="flex items-center gap-3 min-h-11 px-4 cursor-pointer hover:bg-bg">
                <Moon size={20} strokeWidth={2.25} aria-hidden="true" />
                <span className="flex-1">Dark mode</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={dark}
                  onChange={toggleTheme}
                  className="appearance-none relative w-11 h-6 shrink-0 rounded-full bg-border-strong checked:bg-ink cursor-pointer transition-colors before:content-[''] before:absolute before:top-1 before:left-1 before:w-4 before:h-4 before:rounded-full before:bg-surface before:transition-transform checked:before:translate-x-5"
                />
              </label>
              <button type="button" onClick={signOut} className="w-full flex items-center gap-3 min-h-11 px-4 text-left hover:bg-bg">
                <LogOut size={20} strokeWidth={2.25} aria-hidden="true" /> Sign out
              </button>
            </div>
          )}
        </div>

        <nav aria-label="Main" className="md:hidden flex max-w-[1280px] mx-auto px-2">{tabs(false)}</nav>
      </header>

      <main className="flex-1 min-w-0">
        <Outlet context={shell} />
      </main>

      {/* Every parent page shows how to reach the camp (spec 11). */}
      <footer className="w-full max-w-[1280px] mx-auto px-4 md:px-8 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-sm text-ink-muted">
        Questions or changes?{' '}
        <a href="mailto:denver@steelcitycodes.org" className="inline-flex items-center min-h-11 font-bold text-ink underline underline-offset-[3px]">
          denver@steelcitycodes.org
        </a>
      </footer>
    </div>
  )
}
