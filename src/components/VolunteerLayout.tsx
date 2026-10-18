import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Sun, Moon, LogOut, ChevronDown, UserRound, CalendarCheck, GraduationCap, ClipboardList, Megaphone } from 'lucide-react'
import wordmark from '../../assets/sccdenver.png'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useAssignedClass } from '../hooks/useAssignedClass'
import { useSessions } from '../hooks/useSessions'
import type { VolunteerHome } from '../hooks/useVolunteerHome'
import VolunteerApplicant from '../pages/volunteer/VolunteerApplicant'

const TABS = [
  { to: '/volunteer', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/volunteer/classes', label: 'Classes', icon: GraduationCap, end: false },
  { to: '/volunteer/duties', label: 'Duties', icon: ClipboardList, end: false },
  { to: '/volunteer/updates', label: 'Updates', icon: Megaphone, end: false },
]

// Volunteer shell (issue #160). Same ink bar and avatar menu as the parent/admin shells. Phones get
// the four tabs as a strip that sticks to the top of the page: in iOS Safari the bottom edge belongs
// to the browser's own toolbar, so a bottom tab bar would often take two taps. Personal settings
// live under the avatar (My profile). Applicants see their application tracker and no tabs.
export default function VolunteerLayout() {
  const { pathname, hash } = useLocation()
  const { profile, user, signOut } = useAuth()
  const assigned = useAssignedClass()
  const { sessions } = useSessions()
  const crew = assigned.isAccepted

  const [menuOpen, setMenuOpen] = useState(false)
  const { dark, toggle: toggleTheme } = useTheme()
  const menuRef = useRef<HTMLDivElement>(null)

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

  // Camp day on a phone (under 768px): the roll call must stay in view, so the bar and tab strip
  // scroll away and only the roll-call band sticks (DESIGN.md › Layout). The band marks itself with
  // data-rollcall-band; `group-has` keys the shell off it so the two can never disagree.
  const campDayStatic = 'max-md:group-has-[[data-rollcall-band]]/shell:static'

  return (
    <div className="group/shell min-h-dvh bg-bg">
      <header className={`sm:sticky sm:top-0 ${campDayStatic} z-40 h-14 sm:h-16 bg-ink-950 flex items-center gap-3 pl-4 pr-2 sm:px-6`}>
        <img src={wordmark} alt="Steel City Codes // Denver" className="h-7 sm:h-8 w-auto" />

        {crew && (
          <nav aria-label="Volunteer" className="hidden sm:flex ml-4 items-center gap-1">
            {TABS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[10px] font-sans text-[15px] font-semibold transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                <Icon size={16} aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-11 h-11 grid place-items-center text-white/75 hover:text-white rounded-[10px] hover:bg-white/10 transition">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Account menu" aria-haspopup="menu" aria-expanded={menuOpen}
              className="h-11 flex items-center gap-1.5 px-1.5 rounded-full hover:bg-white/10 transition">
              <span className="w-8 h-8 rounded-full bg-role-volunteer-soft text-role-volunteer ring-2 ring-on-shell-muted flex items-center justify-center font-sans font-bold text-xs">
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
                {crew && (
                  <Link role="menuitem" to="/volunteer/profile" onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 h-11 rounded-[10px] font-sans text-[15px] font-semibold text-ink hover:bg-surface-sunken transition">
                    <UserRound size={16} /> My profile and availability
                  </Link>
                )}
                <button role="menuitem" onClick={signOut}
                  className="w-full flex items-center gap-2.5 px-3 h-11 rounded-[10px] font-sans text-[15px] font-semibold text-ink hover:bg-surface-sunken transition">
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {crew && (
        <nav aria-label="Volunteer" className={`sm:hidden sticky top-0 ${campDayStatic} z-30 h-12 bg-ink-950 grid grid-cols-4 border-t border-white/10`}>
          {TABS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `relative flex items-center justify-center font-sans text-[15px] font-semibold transition ${
                isActive ? 'text-white after:absolute after:left-3.5 after:right-3.5 after:bottom-0 after:h-[3px] after:rounded-t-[3px] after:bg-brand' : 'text-white/70'}`}>
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
            <div className="h-40 bg-surface-sunken rounded-[14px] animate-pulse mt-6" />
          </div>
        ) : assigned.error ? (
          <div role="alert" className="py-10">
            <h1 className="font-display font-bold text-2xl text-ink mb-2">Couldn't load your classes</h1>
            <p className="font-sans text-ink-muted mb-6">{assigned.error}</p>
            <button onClick={() => { void assigned.refetch() }}
              className="ui-btn ui-btn--primary">
              Try again
            </button>
          </div>
        ) : !crew ? (
          <VolunteerApplicant status={assigned.applicationStatus} appliedAt={assigned.appliedAt} />
        ) : (
          <Outlet context={context} />
        )}
      </main>
    </div>
  )
}
