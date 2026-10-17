import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutGrid, GraduationCap, UserPlus, CornerDownLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Result {
  key: string
  label: string
  hint: string
  icon: LucideIcon
  to: string
}

// Jump-to search in the admin top bar (⌘K / Ctrl+K focuses it). Results drop down under the
// input — no modal. The index (classes, campers, applicants) loads on first focus.
export default function AdminSearch({ pages }: { pages: { label: string; to: string; icon: LucideIcon }[] }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [index, setIndex] = useState<Result[] | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])

  function loadIndex() {
    if (index) return
    Promise.all([
      supabase.from('classes').select('id, name'),
      supabase.from('students').select('id, full_name'),
      supabase.from('volunteer_applications').select('id, first_name, last_name, status'),
    ]).then(([classes, students, apps]) => {
      setIndex([
        ...(classes.data ?? []).map(c => ({
          key: `c-${c.id}`, label: c.name, hint: 'Class', icon: LayoutGrid, to: `/admin/classes?open=${c.id}`,
        })),
        ...(students.data ?? []).map(s => ({
          key: `s-${s.id}`, label: s.full_name, hint: 'Camper', icon: GraduationCap,
          to: `/admin/students?q=${encodeURIComponent(s.full_name)}`,
        })),
        ...(apps.data ?? []).map(a => ({
          key: `a-${a.id}`, label: `${a.first_name} ${a.last_name}`, hint: `Applicant · ${a.status}`, icon: UserPlus,
          to: '/admin/volunteers?tab=applications',
        })),
      ])
    })
  }

  const q = query.trim().toLowerCase()
  const pageResults: Result[] = pages.map(p => ({ key: `p-${p.to}`, label: p.label, hint: 'Page', icon: p.icon, to: p.to }))
  const results = q
    ? [...pageResults, ...(index ?? [])].filter(r => r.label.toLowerCase().includes(q)).slice(0, 8)
    : []

  function go(r: Result) {
    navigate(r.to)
    setQuery('')
    setOpen(false)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <div ref={boxRef} className="relative hidden md:block ml-4 w-full max-w-sm">
      <div className="flex items-center gap-2 h-9 px-3 rounded-[10px] bg-white/10 focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-brand transition">
        <Search size={16} className="text-white/50 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onFocus={() => { loadIndex(); setOpen(true) }}
          onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]) }
            else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
          }}
          placeholder="Search pages, classes, campers…"
          aria-label="Search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="admin-search-results"
          className="bg-transparent flex-1 min-w-0 text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
        <kbd className="text-[11px] font-sans px-1.5 py-0.5 rounded bg-white/10 text-white/50 border border-white/10">⌘K</kbd>
      </div>

      {open && q && (
        <ul
          id="admin-search-results"
          role="listbox"
          className="absolute left-0 right-0 mt-2 bg-surface-raised border border-border rounded-[12px] shadow-lg p-1.5 z-50"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 font-sans text-sm text-ink-muted">
              {index ? `No matches for “${query}”` : 'Searching…'}
            </li>
          ) : results.map((r, i) => {
            const Icon = r.icon
            return (
              <li key={r.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-left transition ${i === active ? 'bg-surface-sunken' : ''}`}
                >
                  <Icon size={15} className="text-ink-muted shrink-0" />
                  <span className="flex-1 min-w-0 font-sans text-sm text-ink truncate">{r.label}</span>
                  <span className="font-sans text-xs text-ink-muted shrink-0">{r.hint}</span>
                  {i === active && <CornerDownLeft size={13} className="text-ink-faint shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
