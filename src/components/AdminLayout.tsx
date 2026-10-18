import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Sun, Backpack, LayoutGrid, HandHelping, Megaphone, Settings, CircleQuestionMark,
  Moon, LogOut, Search, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useAdminAttention } from '../hooks/useAdminAttention'
import { supabase } from '../lib/supabase'
import AttentionBell from './AttentionBell'
import AdminSearch from './AdminSearch'
import wordmark from '../../assets/sccdenver.png'

// Admin shell (DESIGN.md › Navigation, A-admin §9): an ink bar with search, the bell and the
// avatar; from 1024px a 232px ink rail of five jobs plus Setup, below it an ink tab strip with the
// same six. Identity, dark mode, help and sign-out live in one place: the avatar menu.

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  // Routes that belong to this job (the rail links the page that opens it).
  match: string[]
}

const JOBS: NavItem[] = [
  { to: '/admin', label: 'Today', icon: Sun, match: ['/admin', '/admin/attendance'] },
  { to: '/admin/students', label: 'Campers', icon: Backpack, match: ['/admin/students'] },
  { to: '/admin/classes', label: 'Classes', icon: LayoutGrid, match: ['/admin/classes'] },
  { to: '/admin/volunteers', label: 'Volunteers', icon: HandHelping, match: ['/admin/volunteers', '/admin/interviews', '/admin/duties'] },
  { to: '/admin/updates', label: 'Updates', icon: Megaphone, match: ['/admin/updates'] },
]
const SETUP: NavItem = { to: '/admin/sessions', label: 'Setup', icon: Settings, match: ['/admin/sessions', '/admin/forms', '/admin/users'] }
const HELP: NavItem = { to: '/admin/help', label: 'Help', icon: CircleQuestionMark, match: ['/admin/help'] }

// Every page the search can jump to, by the name the admin knows it by.
const SEARCH_PAGES = [
  ...JOBS, SETUP,
  { to: '/admin/attendance', label: 'Attendance', icon: Sun },
  { to: '/admin/interviews', label: 'Interviews', icon: HandHelping },
  { to: '/admin/duties', label: 'Duties', icon: HandHelping },
  { to: '/admin/users', label: 'Users and roles', icon: Settings },
  { to: '/admin/forms', label: 'Forms', icon: Settings },
  HELP,
]

// 'page' on the item's own page, 'true' on a page inside its job, else nothing.
function currentOf(item: NavItem, pathname: string): 'page' | 'true' | undefined {
  if (pathname === item.to) return 'page'
  return item.match.some(m => m !== '/admin' && (pathname === m || pathname.startsWith(`${m}/`))) ? 'true' : undefined
}

export default function AdminLayout() {
  const { profile, user, signOut } = useAuth()
  const { pathname } = useLocation()
  const { dark, toggle: toggleTheme } = useTheme()

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)

  // One copy of the To do queue for the rail's Today count and the bell; it reloads quietly on
  // every navigation so the counts reflect what was just done.
  const attention = useAdminAttention()
  const refetchAttention = useRef(attention.refetch)
  useEffect(() => { refetchAttention.current = attention.refetch })
  // Volunteers count: applications waiting for a decision.
  const [pending, setPending] = useState(0)
  const firstPath = useRef(true)
  useEffect(() => {
    let alive = true
    supabase.from('volunteer_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count, error }) => { if (alive && !error) setPending(count ?? 0) })
    if (firstPath.current) firstPath.current = false
    else void refetchAttention.current()
    return () => { alive = false }
  }, [pathname])

  // Navigating closes the menu and the phone search.
  const [shownPath, setShownPath] = useState(pathname)
  if (shownPath !== pathname) {
    setShownPath(pathname)
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

  // The phone search opens with its field focused.
  useEffect(() => {
    if (searchOpen) document.getElementById('admin-search')?.focus()
  }, [searchOpen])

  const name = profile?.display_name ?? 'Admin'
  const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'A'
  const urgent = attention.loading ? 0 : attention.items.filter(i => i.tone !== 'info').length
  const counts: Record<string, { n: number; said: string }> = {
    '/admin': { n: urgent, said: urgent === 1 ? 'item needs you' : 'items need you' },
    '/admin/volunteers': { n: pending, said: pending === 1 ? 'application pending' : 'applications pending' },
  }

  const railItem = (item: NavItem) => {
    const current = currentOf(item, pathname)
    const count = counts[item.to]
    const Icon = item.icon
    return (
      <Link key={item.to} to={item.to} aria-current={current}
        className={`flex items-center gap-3 min-h-12 px-2 rounded font-bold no-underline transition-colors ${
          current ? 'bg-shell-raised text-on-shell' : 'text-on-shell-muted hover:bg-shell-raised hover:text-on-shell'}`}>
        <span aria-hidden="true" className={`w-10 h-10 grid place-items-center rounded shrink-0 ${current ? 'bg-brand text-brand-on' : 'bg-shell-raised'}`}>
          <Icon size={22} strokeWidth={2.25} />
        </span>
        {item.label}
        {count && count.n > 0 && (
          <span className="ml-auto px-2 rounded-full border border-on-shell-muted bg-shell-raised text-sm leading-[22px] text-on-shell tabular-nums">
            <span className="sr-only">, </span>{count.n}<span className="sr-only"> {count.said}</span>
          </span>
        )}
      </Link>
    )
  }

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
            <AdminSearch pages={SEARCH_PAGES} onEscape={() => setSearchOpen(false)} />
          </div>
          {searchOpen && (
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search"
              className="ui-iconbtn md:hidden text-on-shell">
              <X size={20} strokeWidth={2.25} />
            </button>
          )}

          <span className={`${searchOpen ? 'max-md:hidden' : ''} flex-1`} />
          <div className={`${searchOpen ? 'max-md:hidden' : ''} flex items-center gap-1`}>
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search campers, classes and people"
              className="ui-iconbtn md:hidden text-on-shell-muted hover:text-on-shell">
              <Search size={20} strokeWidth={2.25} />
            </button>
            <AttentionBell items={attention.items} loading={attention.loading} />

            <div className="relative" ref={menuRef}>
              <button ref={avatarRef} type="button" onClick={() => setMenuOpen(o => !o)}
                aria-label={`${name}, account menu`} aria-expanded={menuOpen} aria-controls="account-menu"
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
            const current = currentOf(item, pathname)
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}
