import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, GraduationCap, Users, Shield, LayoutGrid,
  CalendarDays, ListChecks, Mic, Settings2,
  Sun, Moon, Menu, X, LogOut, ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import AttentionBell from './AttentionBell'
import AdminSearch from './AdminSearch'
import wordmark from '../../assets/sccdenver.png'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
}

interface NavGroup {
  heading: string
  items: NavItem[]
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('scc-theme') === 'dark' } catch { return false }
  })
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Live badge counts ──────────────────────────────────────
  // Re-queried on every navigation so they reflect what was just done on the previous page.
  // Volunteers: applications awaiting a decision. Interviews: pending applicants with no booking.
  const [pendingCount, setPendingCount] = useState(0)
  const [unscheduledCount, setUnscheduledCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('volunteer_applications').select('id, status'),
      supabase.from('interview_bookings').select('application_id'),
    ]).then(([apps, bookings]) => {
      if (cancelled) return
      const booked = new Set((bookings.data ?? []).map(b => b.application_id as string))
      const list = apps.data ?? []
      setPendingCount(list.filter(a => a.status === 'pending').length)
      setUnscheduledCount(list.filter(a => a.status === 'pending' && !booked.has(a.id)).length)
    })
    return () => { cancelled = true }
  }, [pathname])

  // Close the phone drawer after navigating from it.
  const [drawerPath, setDrawerPath] = useState(pathname)
  if (drawerPath !== pathname) {
    setDrawerPath(pathname)
    setDrawerOpen(false)
  }

  // ── Theme toggle ───────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  function toggleTheme() {
    const next = !dark
    try { localStorage.setItem('scc-theme', next ? 'dark' : 'light') } catch { /* private mode */ }
    setDark(next)
  }

  // ── Avatar menu: close on outside click ────────────────────
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const name = profile?.display_name ?? 'Admin'
  const initials =
    name
      .split(/\s+/)
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'A'

  const groups: NavGroup[] = [
    {
      heading: 'Overview',
      items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      heading: 'People',
      items: [
        { to: '/admin/students', label: 'Students', icon: GraduationCap },
        { to: '/admin/volunteers', label: 'Volunteers', icon: Users, badge: pendingCount },
        { to: '/admin/users', label: 'Users & roles', icon: Shield },
      ],
    },
    {
      heading: 'Program',
      items: [
        { to: '/admin/classes', label: 'Classes', icon: LayoutGrid },
        { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
        { to: '/admin/duties', label: 'Duty schedule', icon: ListChecks },
        { to: '/admin/interviews', label: 'Interviews', icon: Mic, badge: unscheduledCount },
      ],
    },
    {
      heading: 'Setup',
      items: [{ to: '/admin/forms', label: 'Form editor', icon: Settings2 }],
    },
  ]

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-16 bg-ink-950 flex items-center gap-3 px-4 sm:px-6">
        <button
          onClick={() => setDrawerOpen(true)}
          className="lg:hidden text-white/70 hover:text-white p-1.5 rounded-[8px] hover:bg-white/10 transition"
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>

        <img src={wordmark} alt="Steel City Codes // Denver" className="h-8 w-auto" />

        <AdminSearch pages={groups.flatMap(g => g.items)} />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="text-white/70 hover:text-white p-2 rounded-[10px] hover:bg-white/10 transition"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <AttentionBell key={pathname} />

          {/* Avatar menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full hover:bg-white/10 transition"
              aria-label="Account menu"
            >
              <span className="w-8 h-8 rounded-full bg-role-admin-soft text-role-admin ring-2 ring-brand flex items-center justify-center font-sans font-bold text-xs">
                {initials}
              </span>
              <ChevronDown size={14} className="text-white/60 hidden sm:block" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-surface-raised border border-border rounded-[12px] shadow-lg p-1.5 z-50">
                <div className="px-3 py-2 border-b border-border mb-1">
                  <div className="font-sans font-semibold text-sm text-ink truncate">{name}</div>
                  <div className="font-sans text-xs text-ink-muted">Administrator</div>
                </div>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] font-sans text-sm text-ink hover:bg-surface-sunken transition"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* ── Desktop sidebar ───────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-[260px] shrink-0 bg-surface border-r border-border sticky top-16 h-[calc(100vh-4rem)]">
          <SidebarBody groups={groups} name={name} initials={initials} signOut={signOut} />
        </aside>

        {/* ── Mobile off-canvas drawer ──────────────────────── */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-ink-950/50"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-surface border-r border-border flex flex-col">
              <div className="h-16 shrink-0 bg-ink-950 flex items-center justify-between px-4">
                <img src={wordmark} alt="Steel City Codes // Denver" className="h-7 w-auto" />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-white/70 hover:text-white p-1.5 rounded-[8px] hover:bg-white/10 transition"
                  aria-label="Close navigation"
                >
                  <X size={20} />
                </button>
              </div>
              <SidebarBody
                groups={groups}
                name={name}
                initials={initials}
                signOut={signOut}
                onNavigate={() => setDrawerOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* ── Page content ──────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

interface SidebarBodyProps {
  groups: NavGroup[]
  name: string
  initials: string
  signOut: () => void | Promise<void>
  onNavigate?: () => void
}

function SidebarBody({ groups, name, initials, signOut, onNavigate }: SidebarBodyProps) {
  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map(group => (
          <div key={group.heading}>
            <div className="px-3 mb-1.5 font-sans text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {group.heading}
            </div>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 h-10 px-3 rounded-[10px] font-sans text-sm font-semibold transition ${
                      isActive
                        ? 'bg-brand-soft text-ink before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-brand'
                        : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                    }`
                  }
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-warning-soft text-warning text-xs font-bold tabular-nums">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-role-admin-soft text-role-admin ring-2 ring-brand flex items-center justify-center font-sans font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-sans font-semibold text-sm text-ink truncate">{name}</div>
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold bg-role-admin-soft text-role-admin">
              <Shield size={10} /> Admin
            </span>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="text-ink-faint hover:text-ink p-1.5 rounded-[8px] hover:bg-surface-sunken transition shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  )
}
