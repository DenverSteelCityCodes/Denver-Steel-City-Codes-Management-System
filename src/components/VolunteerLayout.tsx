import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CircleHelp, LogOut, Moon, UserRound } from 'lucide-react'
import wordmark from '../../assets/sccdenver.png'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useAssignedClass } from '../hooks/useAssignedClass'
import { useSessions } from '../hooks/useSessions'
import type { VolunteerHome } from '../hooks/useVolunteerHome'
import VolunteerApplicant from '../pages/volunteer/VolunteerApplicant'
import { buttonClass } from '../lib/ui'

const TABS = [
  { to: '/volunteer', label: 'Today', end: true },
  { to: '/volunteer/classes', label: 'Classes', end: false },
  { to: '/volunteer/duties', label: 'Duties', end: false },
  { to: '/volunteer/updates', label: 'Updates', end: false },
]

// Idle tabs are muted, the current one white with a 4px gold marker (DESIGN.md › Navigation).
const tabCls = (active: boolean) => `flex items-center justify-center px-3 font-bold transition-colors ${
  active ? 'text-on-shell shadow-[inset_0_-4px_0_var(--brand)]' : 'text-on-shell-muted hover:text-on-shell'}`
const itemCls = 'w-full flex items-center gap-3 min-h-11 px-4 text-left text-ink font-bold hover:bg-bg transition-colors'

// Volunteer shell (issue #160). Ink bar with the wordmark and the avatar; phones get the four tabs as
// a strip that sticks to the top of the page, because in iOS Safari the bottom edge belongs to the
// browser's own toolbar. From 768px the tabs move inline into the bar. Personal settings live under
// the avatar (profile, help, dark mode) in a disclosure panel framed by a 2px ink rule. Applicants
// see their application tracker and no tabs; Help is the one other page they can open.
export default function VolunteerLayout() {
  const { pathname, hash } = useLocation()
  const { profile, user, signOut } = useAuth()
  const assigned = useAssignedClass()
  const { sessions } = useSessions()
  const crew = assigned.isAccepted

  const [menuOpen, setMenuOpen] = useState(false)
  const { dark, toggle: toggleTheme } = useTheme()
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // A new tab starts at the top, like a new page would (unless the link points into the page).
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  const name = profile?.display_name ?? 'Volunteer'
  const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'V'
  const context: VolunteerHome = { assigned, sessions }
  const close = () => setMenuOpen(false)

  // Camp day on a phone (under 768px): the roll call must stay in view, so the bar and tab strip
  // scroll away and only the roll-call band sticks (DESIGN.md › Layout). The band marks itself with
  // data-rollcall-band; `group-has` keys the shell off it so the two can never disagree.
  const campDayStatic = 'max-md:group-has-[[data-rollcall-band]]/shell:static!'

  return (
    <div className="group/shell min-h-dvh bg-bg">
      <header className={`md:sticky md:top-0 ${campDayStatic} z-40 h-14 md:h-16 bg-shell text-on-shell flex items-stretch gap-3 pl-4 pr-2 md:px-8 dark:shadow-[inset_0_-1px_0_var(--border)]`}>
        <img src={wordmark} alt="Steel City Codes // Denver" className="self-center h-7 md:h-8 w-auto" />

        {crew && (
          <nav aria-label="Volunteer" className="hidden md:flex ml-6">
            {TABS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} onClick={close} className={({ isActive }) => tabCls(isActive)}>
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="relative ml-auto self-center" ref={menuRef}
          onKeyDown={e => { if (e.key === 'Escape' && menuOpen) { close(); avatarRef.current?.focus() } }}>
          <button ref={avatarRef} type="button" onClick={() => setMenuOpen(o => !o)} aria-label={`${name}, account menu`}
            aria-expanded={menuOpen} aria-controls="account-menu"
            className="w-11 h-11 grid place-items-center rounded-full border-2 border-on-shell-muted hover:border-brand text-sm font-bold text-on-shell transition-colors">
            {initials}
          </button>

          {menuOpen && (
            <div id="account-menu" className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-2rem))] bg-surface text-ink border-2 border-ink rounded py-2 z-50">
              <div className="px-4 pt-1 pb-3 mb-1 border-b border-border">
                <p className="font-bold break-words">{name}</p>
                <p className="text-sm text-ink-muted break-all">{user?.email}</p>
              </div>
              {crew && (
                <Link to="/volunteer/profile" onClick={close} className={itemCls}>
                  <UserRound size={20} strokeWidth={2.25} aria-hidden="true" /> My profile and availability
                </Link>
              )}
              <Link to="/volunteer/help" onClick={close} className={itemCls}>
                <CircleHelp size={20} strokeWidth={2.25} aria-hidden="true" /> Help
              </Link>
              <label className={`${itemCls} cursor-pointer`}>
                <Moon size={20} strokeWidth={2.25} aria-hidden="true" />
                <span className="flex-1">Dark mode</span>
                <input type="checkbox" role="switch" className="ui-switch" checked={dark} onChange={toggleTheme} />
              </label>
              <button type="button" onClick={signOut} className={itemCls}>
                <LogOut size={20} strokeWidth={2.25} aria-hidden="true" /> Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {crew && (
        <nav aria-label="Volunteer" className={`md:hidden sticky top-0 ${campDayStatic} z-30 h-12 bg-shell grid grid-cols-4 dark:shadow-[inset_0_-1px_0_var(--border)]`}>
          {TABS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={close} className={({ isActive }) => tabCls(isActive)}>
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="min-w-0 max-w-[1080px] mx-auto px-4 sm:px-8 pt-5 sm:pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        {assigned.loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-4 w-40 bg-surface-sunken rounded animate-pulse" />
            <div className="h-8 w-64 bg-surface-sunken rounded animate-pulse" />
            <div className="h-40 bg-surface-sunken rounded animate-pulse mt-6" />
          </div>
        ) : assigned.error ? (
          <div role="alert" className="py-10">
            <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-ink mb-2">Couldn't load your classes</h1>
            <p className="text-ink-muted mb-6">{assigned.error}</p>
            <button type="button" onClick={() => { void assigned.refetch() }} className={buttonClass('primary')}>
              Try again
            </button>
          </div>
        ) : !crew && pathname !== '/volunteer/help' ? (
          <VolunteerApplicant status={assigned.applicationStatus} appliedAt={assigned.appliedAt} />
        ) : (
          <Outlet context={context} />
        )}
      </main>
    </div>
  )
}
