import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Sun, Backpack, LayoutGrid, HandHelping, Megaphone, Settings, CircleQuestionMark,
  Moon, LogOut, Search, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useAdminAttention } from '../hooks/useAdminAttention'
import { useUpdates } from '../hooks/useUpdates'
import { supabase } from '../lib/supabase'
import AttentionBell from './AttentionBell'
import AdminSearch from './AdminSearch'
import wordmark from '../../assets/sccdenver.png'

// Admin shell (DESIGN.md › Navigation, A-admin §9): an ink bar with search, the bell and the
// avatar; from 1024px a 232px ink rail of five jobs plus Setup, each job's other pages listed
// under it; below 1024px the same six as an ink tab strip, with the current job's pages as
// sub-tabs on the floor. Every admin page has a permanent link here: the shell owns navigation
// between pages; tabs within one page (Volunteers' ?tab=) stay in that page. Identity, dark mode,
// help and sign-out live in one place: the avatar menu.

interface Page {
  to: string
  label: string
  // Other names the search answers to (old page names, what's on the page).
  keywords?: string[]
}

interface Job extends Page {
  icon: LucideIcon
  // What the job's own page is called among its sub-tabs (Setup opens on Season); else its label.
  home?: string
  // The job's other pages: listed under it in the rail, as sub-tabs on a phone.
  more?: Page[]
}

const JOBS: Job[] = [
  { to: '/admin', label: 'Today', icon: Sun, home: 'Today', keywords: ['Dashboard', 'Home', 'To do', 'Seats'],
    more: [{ to: '/admin/attendance', label: 'Attendance', keywords: ['Roll call', 'Unaccounted', 'Attendance CSV', 'Week export'] }] },
  { to: '/admin/students', label: 'Campers', icon: Backpack, keywords: ['Students', 'Change requests', 'Registrations'] },
  { to: '/admin/classes', label: 'Classes', icon: LayoutGrid, keywords: ['Sections', 'Timetable', 'Rosters', 'Leads'] },
  { to: '/admin/volunteers', label: 'Volunteers', icon: HandHelping, keywords: ['Applications'],
    more: [
      { to: '/admin/interviews', label: 'Interviews', keywords: ['Interview slots', 'Bookings'] },
      { to: '/admin/duties', label: 'Duties', keywords: ['Duty schedule', 'duty', 'Duty slots'] },
    ] },
  { to: '/admin/updates', label: 'Updates', icon: Megaphone, keywords: ['Announcements', 'Posts'] },
]
const SETUP: Job = {
  to: '/admin/sessions', label: 'Setup', icon: Settings, home: 'Season', keywords: ['Sessions', 'Season', 'Weeks', 'Registration', 'Schedule'],
  more: [
    { to: '/admin/forms', label: 'Forms', keywords: ['Form editor', 'Questions'] },
    { to: '/admin/users', label: 'Users & roles', keywords: ['Users and roles', 'Roles', 'Accounts', 'Admins'] },
  ],
}
const HELP: Job = { to: '/admin/help', label: 'Help', icon: CircleQuestionMark, keywords: ['Guide', 'How to', 'Playbook'] }

// Every page the search can jump to, by the name the admin knows it by and its old names.
const SEARCH_PAGES = [...JOBS, SETUP, HELP].flatMap(j => [
  { to: j.to, label: j.label, icon: j.icon, keywords: j.keywords },
  ...(j.more ?? []).map(p => ({ to: p.to, label: p.label, icon: j.icon, keywords: p.keywords })),
  // Views inside a page (?tab=) that people search for by name.
  ...(j.to === '/admin/updates' ? [{ to: '/admin/updates?tab=emails', label: 'Sent emails', icon: j.icon, keywords: ['Emails', 'Email log'] }] : []),
  ...(j.to === '/admin/volunteers' ? [{ to: '/admin/volunteers?tab=crew', label: 'Crew', icon: j.icon, keywords: ['Volunteer roster', 'Fill open spots'] }] : []),
  ...(j.to === '/admin/volunteers' ? [{ to: '/admin/volunteers?tab=onboarding', label: 'Onboarding', icon: j.icon, keywords: ['Checklist', 'Overdue', 'Remove from the season'] }] : []),
])

const on = (pathname: string, to: string) => pathname === to || (to !== '/admin' && pathname.startsWith(`${to}/`))

// 'page' on the job's own page, 'true' on one of its other pages, else nothing.
function jobCurrent(job: Job, pathname: string): 'page' | 'true' | undefined {
  if (pathname === job.to) return 'page'
  return (job.more ?? []).some(p => on(pathname, p.to)) || on(pathname, job.to) ? 'true' : undefined
}

export default function AdminLayout() {
  const { profile, user, signOut } = useAuth()
  const { pathname, key: locationKey } = useLocation()
  const { dark, toggle: toggleTheme } = useTheme()

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)

  // One copy of the To do queue (the rail's Today count and the bell) and of the newest updates
  // (the bell). Both reload quietly on every navigation so they reflect what was just done.
  const attention = useAdminAttention()
  const { updates, refetch: refetchUpdates } = useUpdates(3)
  const reload = useRef([attention.refetch, refetchUpdates] as const)
  useEffect(() => { reload.current = [attention.refetch, refetchUpdates] })
  // Volunteers: applications waiting for a decision. Interviews: those with no interview booked.
  const [pending, setPending] = useState(0)
  const [unbooked, setUnbooked] = useState(0)
  const firstPath = useRef(true)
  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('volunteer_applications').select('id, status'),
      supabase.from('interview_bookings').select('application_id'),
    ]).then(([apps, bookings]) => {
      if (!alive || apps.error) return
      const booked = new Set((bookings.data ?? []).map(b => b.application_id as string))
      const waiting = (apps.data ?? []).filter(a => a.status === 'pending')
      setPending(waiting.length)
      if (!bookings.error) setUnbooked(waiting.filter(a => !booked.has(a.id)).length)
    }, () => { /* keep the last counts */ })
    if (firstPath.current) firstPath.current = false
    else {
      const [again, againUpdates] = reload.current
      again().catch(() => { /* the queue keeps what it showed */ })
      void againUpdates()
    }
    return () => { alive = false }
  }, [pathname])

  // Navigating (a search result can stay on the same page) closes the menu and the phone search.
  const [shownKey, setShownKey] = useState(locationKey)
  if (shownKey !== locationKey) {
    setShownKey(locationKey)
    setMenuOpen(false)
    setSearchOpen(false)
  }

  // Avatar menu: outside click closes it; Esc closes it and hands focus back to the avatar.
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
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // The phone search: the field is focused inside the tap itself, so iOS opens the keyboard;
  // closing it (Esc or ×) hands focus back to the search button.
  function openSearch() {
    flushSync(() => setSearchOpen(true))
    document.getElementById('admin-search')?.focus()
  }
  function closeSearch() {
    flushSync(() => setSearchOpen(false))
    searchBtnRef.current?.focus()
  }

  const name = profile?.display_name ?? 'Admin'
  const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'A'
  const urgent = attention.loading ? 0 : attention.items.filter(i => i.tone !== 'info').length
  const counts: Record<string, { n: number; said: string }> = {
    '/admin': { n: urgent, said: urgent === 1 ? 'item needs you' : 'items need you' },
    '/admin/volunteers': { n: pending, said: pending === 1 ? 'application pending' : 'applications pending' },
    '/admin/interviews': { n: unbooked, said: unbooked === 1 ? 'applicant has no interview' : 'applicants have no interview' },
  }
  const badge = (to: string, cls: string) => {
    const c = counts[to]
    return c && c.n > 0 ? (
      <span className={`ml-auto px-2 rounded-full border text-sm leading-[22px] tabular-nums ${cls}`}>
        <span className="sr-only">, </span>{c.n}<span className="sr-only"> {c.said}</span>
      </span>
    ) : null
  }

  const railItem = (job: Job) => {
    const current = jobCurrent(job, pathname)
    const Icon = job.icon
    return (
      <div key={job.to} className="grid gap-0.5">
        <Link to={job.to} aria-current={current}
          className={`flex items-center gap-3 min-h-12 px-2 rounded font-bold no-underline transition-colors ${
            current ? 'bg-shell-raised text-on-shell' : 'text-on-shell-muted hover:bg-shell-raised hover:text-on-shell'}`}>
          <span aria-hidden="true" className={`w-10 h-10 grid place-items-center rounded shrink-0 ${current ? 'bg-brand text-brand-on' : 'bg-shell-raised'}`}>
            <Icon size={22} strokeWidth={2.25} />
          </span>
          {job.label}
          {badge(job.to, 'border-on-shell-muted bg-shell-raised text-on-shell')}
        </Link>
        {(job.more ?? []).map(p => {
          const here = on(pathname, p.to)
          return (
            <Link key={p.to} to={p.to} aria-current={here ? 'page' : undefined}
              className={`flex items-center gap-2 min-h-11 pl-[60px] pr-2 rounded no-underline transition-colors ${
                here ? 'bg-shell-raised text-on-shell font-bold' : 'text-on-shell-muted font-semibold hover:bg-shell-raised hover:text-on-shell'}`}>
              {p.label}
              {badge(p.to, 'border-on-shell-muted/60 text-on-shell')}
            </Link>
          )
        })}
      </div>
    )
  }

  // Below 1024px, the current job's pages as sub-tabs on the floor (ink underline; gold stays in
  // the shell), so Attendance, Interviews, Duties, Forms and Users are a tap away too.
  const job = [...JOBS, SETUP].find(j => jobCurrent(j, pathname))
  const subPages = job?.more?.length ? [{ to: job.to, label: job.home ?? job.label }, ...job.more] : []

  const menuItem = 'flex items-center gap-3 w-full min-h-11 px-4 text-left no-underline hover:bg-bg transition-colors'

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:px-4 focus:py-3 focus:rounded focus:bg-brand focus:text-brand-on focus:font-extrabold">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 bg-shell text-on-shell pt-[env(safe-area-inset-top)] [&_:focus-visible]:outline-brand dark:shadow-[inset_0_-1px_0_var(--shell-raised)]">
        <div className="relative h-14 flex items-center gap-2 md:gap-4 px-2 md:px-8">
          <Link to="/admin" aria-label="Steel City Codes // Denver, admin home"
            className={`${searchOpen ? 'max-md:hidden' : ''} inline-flex items-center min-h-11 px-2 md:px-0 shrink-0`}>
            <img src={wordmark} alt="" className="h-7 w-auto" />
          </Link>

          <div className={`${searchOpen ? 'flex' : 'hidden'} md:flex flex-1 md:flex-initial md:basis-[400px] min-w-0`}>
            <AdminSearch pages={SEARCH_PAGES} onEscape={closeSearch} />
          </div>
          {searchOpen && (
            <button type="button" onClick={closeSearch} aria-label="Close search"
              className="ui-iconbtn md:hidden text-on-shell">
              <X size={20} strokeWidth={2.25} />
            </button>
          )}

          <span className={`${searchOpen ? 'max-md:hidden' : ''} flex-1`} />
          <div className={`${searchOpen ? 'max-md:hidden' : ''} flex items-center gap-1`}>
            <button ref={searchBtnRef} type="button" onClick={openSearch} aria-label="Search campers, classes and people"
              className="ui-iconbtn md:hidden text-on-shell-muted hover:text-on-shell">
              <Search size={20} strokeWidth={2.25} />
            </button>
            <AttentionBell items={attention.items} loading={attention.loading} updates={updates} />

            <div className="relative" ref={menuRef}>
              <button ref={avatarRef} type="button" onClick={() => setMenuOpen(o => !o)}
                aria-label={`${initials}: ${name}, account menu`} aria-expanded={menuOpen} aria-controls="account-menu"
                className="w-11 h-11 grid place-items-center rounded-full border-2 border-on-shell-muted text-sm font-bold text-on-shell hover:border-brand transition-colors">
                {initials}
              </button>
              {menuOpen && (
                <div id="account-menu"
                  className="absolute right-0 top-[calc(100%+6px)] w-[min(320px,calc(100vw-2rem))] py-2 rounded border-2 border-ink bg-surface text-ink z-50 [&_:focus-visible]:outline-focus">
                  <div className="px-4 py-3 border-b border-border">
                    <b className="block truncate">{name}</b>
                    <span className="block text-sm text-ink-muted truncate">Admin{user?.email ? ` · ${user.email}` : ''}</span>
                  </div>
                  <label className={`${menuItem} cursor-pointer`}>
                    <Moon size={20} strokeWidth={2.25} aria-hidden="true" />
                    <span className="flex-1">Dark mode</span>
                    <input type="checkbox" role="switch" className="ui-switch" checked={dark} onChange={toggleTheme} />
                  </label>
                  {/* From 1024px Help sits at the foot of the rail instead. */}
                  <Link to={HELP.to} onClick={() => setMenuOpen(false)} className={`${menuItem} lg:hidden`}>
                    <CircleQuestionMark size={20} strokeWidth={2.25} aria-hidden="true" /> Help
                  </Link>
                  <button type="button" onClick={() => { void signOut() }} className={menuItem}>
                    <LogOut size={20} strokeWidth={2.25} aria-hidden="true" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Below 1024px: the rail's six as an ink tab strip (scrolls sideways if it has to). */}
        <nav aria-label="Admin" className="lg:hidden flex overflow-x-auto [scrollbar-width:none] px-1 md:px-5">
          {[...JOBS, SETUP].map(item => {
            const current = jobCurrent(item, pathname)
            return (
              <Link key={item.to} to={item.to} aria-current={current}
                className={`flex-[1_0_auto] grid place-items-center min-h-12 px-1.5 min-[480px]:px-3 whitespace-nowrap text-sm min-[480px]:text-base font-bold no-underline transition-colors [&:focus-visible]:-outline-offset-[3px] ${
                  current ? 'text-on-shell shadow-[inset_0_-4px_0_var(--brand)]' : 'text-on-shell-muted hover:text-on-shell'}`}>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <div className="flex">
        {/* From 1024px: the rail. The column stays ink for the page's full height; the rail sticks. */}
        <div className="hidden lg:block w-[232px] shrink-0 bg-shell">
          <nav aria-label="Admin" className="sticky top-14 h-[calc(100dvh-3.5rem)] flex flex-col gap-0.5 px-2 py-3 overflow-y-auto [&_:focus-visible]:outline-brand">
            {JOBS.map(railItem)}
            <span role="separator" className="h-px mx-2 my-2 bg-white/15" />
            {railItem(SETUP)}
            <div className="mt-auto pt-2">{railItem(HELP)}</div>
          </nav>
        </div>

        <main id="main" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
          {subPages.length > 0 && (
            <nav aria-label={`${job?.label} pages`} className="lg:hidden px-4 sm:px-6 border-b border-border">
              <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {subPages.map(p => {
                  const here = pathname === p.to
                  return (
                    <li key={p.to} className="shrink-0">
                      <Link to={p.to} aria-current={here ? 'page' : undefined}
                        className={`inline-flex items-center gap-1.5 min-h-12 px-2 sm:px-3 font-bold whitespace-nowrap no-underline focus-visible:-outline-offset-[3px] ${
                          here ? 'text-ink shadow-[inset_0_-4px_0_var(--ink)]' : 'text-ink-muted hover:text-ink'}`}>
                        {p.label}
                        {counts[p.to] && counts[p.to].n > 0 && (
                          <span className="font-semibold tabular-nums">{counts[p.to].n}<span className="sr-only"> {counts[p.to].said}</span></span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
