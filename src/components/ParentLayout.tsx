import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, GraduationCap, Sun, Moon, Heart, LogOut, ChevronDown } from 'lucide-react'
import ParentBell from './ParentBell'
import { useAuth } from '../context/AuthContext'
import wordmark from '../../assets/sccdenver.png'

// Parent shell (handoff §5): reuse the admin shell *pattern* — real wordmark on the ink bar,
// a notifications bell, and a parent-tinted avatar menu with sign-out — but parents don't need
// the admin sidebar, so a light inline nav (Home · Browse classes) is enough.
export default function ParentLayout() {
  const { pathname } = useLocation()
  const { profile, signOut } = useAuth()

  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => {
    if (typeof document === 'undefined') return false
    const stored = localStorage.getItem('scc-theme')
    if (stored) return stored === 'dark'
    return document.documentElement.classList.contains('dark')
  })
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Theme: sync the DOM class from state (effects are for external systems) ──
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  function toggleTheme() {
    const next = !dark
    localStorage.setItem('scc-theme', next ? 'dark' : 'light')
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

  const name = profile?.display_name ?? 'Parent'
  const initials =
    name
      .split(/\s+/)
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'P'

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] font-sans text-sm font-semibold transition ${
      isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
    }`

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-16 bg-ink-950 flex items-center gap-3 px-4 sm:px-6">
        <img src={wordmark} alt="Steel City Codes // Denver" className="h-8 w-auto" />

        <nav className="ml-4 flex items-center gap-1">
          <NavLink to="/parent" end className={navCls}>
            <Home size={16} /> Home
          </NavLink>
          <NavLink to="/parent/classes" className={navCls}>
            <GraduationCap size={16} /> Browse classes
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="text-white/70 hover:text-white p-2 rounded-[10px] hover:bg-white/10 transition"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <ParentBell key={pathname} />

          {/* Avatar menu — parent-tinted, holds sign-out */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full hover:bg-white/10 transition"
              aria-label="Account menu"
            >
              <span className="w-8 h-8 rounded-full bg-role-parent-soft text-role-parent ring-2 ring-brand flex items-center justify-center font-sans font-bold text-xs">
                {initials}
              </span>
              <ChevronDown size={14} className="text-white/60 hidden sm:block" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-surface-raised border border-border rounded-[12px] shadow-lg p-1.5 z-50">
                <div className="px-3 py-2 border-b border-border mb-1">
                  <div className="font-sans font-semibold text-sm text-ink truncate">{name}</div>
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold bg-role-parent-soft text-role-parent">
                    <Heart size={10} /> Parent
                  </span>
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

      {/* ── Page content ──────────────────────────────────────── */}
      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
