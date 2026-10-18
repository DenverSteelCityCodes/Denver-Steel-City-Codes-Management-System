import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutGrid, Backpack, UserPlus, CornerDownLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'

interface Result {
  key: string
  label: string
  hint: string
  icon: LucideIcon
  to: string
}

// Jump-to search in the admin ink bar (⌘K / Ctrl+K focuses it). Results drop down under the field
// in an inline popover framed by a 2px ink rule: no modal, no shadow. The index (classes, campers,
// applicants) loads on focus, and reloads on a later focus once it's over a minute old so new
// campers and applicants show up. On a phone the shell opens it across the bar; `onEscape` closes that.
const INDEX_MAX_AGE_MS = 60_000

export default function AdminSearch({ pages, onEscape }: {
  pages: { label: string; to: string; icon: LucideIcon }[]
  onEscape?: () => void
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [index, setIndex] = useState<Result[] | null>(null)
  const [indexError, setIndexError] = useState<string | null>(null)
  const indexLoadedAt = useRef(0)
  const indexLoading = useRef(false)

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

  function loadIndex(force = false) {
    if (indexLoading.current) return
    if (!force && index && Date.now() - indexLoadedAt.current < INDEX_MAX_AGE_MS) return
    indexLoading.current = true
    setIndexError(null)
    // Campers and applications are paged past the API's 1,000-row cap (spec 18).
    const all = <T,>(p: Promise<T[]>) => p.then(data => ({ data, error: null as { message: string } | null }), (e: unknown) => ({ data: null as T[] | null, error: { message: e instanceof Error ? e.message : 'unknown error' } }))
    Promise.all([
      supabase.from('classes').select('id, name'),
      all(fetchAll<{ id: string; full_name: string }>(async (from, to) => supabase.from('students').select('id, full_name').order('id').range(from, to))),
      all(fetchAll<{ id: string; first_name: string; last_name: string; status: string }>(async (from, to) => supabase.from('volunteer_applications').select('id, first_name, last_name, status').order('id').range(from, to))),
    ]).then(([classes, students, apps]) => {
      const err = classes.error ?? students.error ?? apps.error
      // Keep any older index on failure; the dropdown shows the error with a Retry.
      if (err) { setIndexError(err.message); return }
      indexLoadedAt.current = Date.now()
      setIndex([
        ...(classes.data ?? []).map(c => ({
          key: `c-${c.id}`, label: c.name, hint: 'Class', icon: LayoutGrid, to: `/admin/classes?open=${c.id}`,
        })),
        ...(students.data ?? []).map(s => ({
          key: `s-${s.id}`, label: s.full_name, hint: 'Camper', icon: Backpack,
          to: `/admin/students?q=${encodeURIComponent(s.full_name)}`,
        })),
        ...(apps.data ?? []).map(a => ({
          key: `a-${a.id}`, label: `${a.first_name} ${a.last_name}`, hint: `Applicant · ${a.status}`, icon: UserPlus,
          to: '/admin/volunteers?tab=applications',
        })),
      ])
    }, (e: unknown) => {
      setIndexError(e instanceof Error ? e.message : 'unknown error')
    }).finally(() => { indexLoading.current = false })
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
    <div ref={boxRef} className="relative w-full">
      <label htmlFor="admin-search"
        className="flex items-center gap-2 h-11 pl-3 pr-2 rounded border border-on-shell-muted/55 bg-shell-raised text-on-shell-muted cursor-text focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
        <Search size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
        <span className="sr-only">Search campers, classes and people</span>
        <input
          ref={inputRef}
          id="admin-search"
          type="search"
          autoComplete="off"
          value={query}
          onFocus={() => { loadIndex(); setOpen(true) }}
          onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]) }
            else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); onEscape?.() }
          }}
          placeholder="Search campers, classes, people"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !!q}
          aria-controls="admin-search-results"
          aria-activedescendant={open && results[active] ? `admin-search-${results[active].key}` : undefined}
          className="flex-1 min-w-0 h-full bg-transparent border-0 text-base text-on-shell placeholder:text-on-shell-muted caret-brand focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd aria-hidden="true" className="hidden md:inline px-1.5 py-1 rounded-[3px] border border-on-shell-muted/55 text-sm font-bold leading-none text-on-shell-muted">⌘K</kbd>
      </label>

      {open && q && (
        <ul
          id="admin-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 md:right-auto md:w-[max(100%,24rem)] top-[calc(100%+6px)] py-2 rounded border-2 border-ink bg-surface text-ink z-50"
        >
          {indexError && (
            <li role="alert" className="flex flex-wrap items-center justify-between gap-x-3 px-4 py-2 text-sm font-bold text-danger">
              <span title={indexError}>Couldn't load campers and classes. Check your connection.</span>
              <button type="button" onClick={() => { loadIndex(true); inputRef.current?.focus() }} className="ui-btn ui-btn--text text-sm text-ink">Try again</button>
            </li>
          )}
          {results.length === 0 ? (
            !indexError && (
              <li className="px-4 py-2.5 text-ink-muted">
                {index ? `No matches for “${query}”` : 'Searching…'}
              </li>
            )
          ) : results.map((r, i) => {
            const Icon = r.icon
            return (
              <li key={r.key} id={`admin-search-${r.key}`} role="option" aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => go(r)}
                className={`flex items-center gap-3 min-h-11 px-4 cursor-pointer ${i === active ? 'bg-surface-sunken' : ''}`}
              >
                <Icon size={18} strokeWidth={2.25} aria-hidden="true" className="text-ink-muted shrink-0" />
                <span className="flex-1 min-w-0 truncate font-bold">{r.label}</span>
                <span className="text-sm text-ink-muted shrink-0">{r.hint}</span>
                {i === active && <CornerDownLeft size={16} strokeWidth={2.5} aria-hidden="true" className="text-ink-muted shrink-0" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
