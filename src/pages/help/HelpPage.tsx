import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Search } from 'lucide-react'
import HelpText from '../../components/HelpText'
import { plainHelpText } from '../../content/help/markup'
import type { HelpBlock, HelpGuide, HelpTopic } from '../../content/help/types'

// One help guide (issue #186): the page title, a search box, an "On this page" list (sticky
// beside the text from 1024px) and the topics as disclosures, closed until opened so the page
// reads as a list of questions instead of one long scroll. /…/help#<topic> opens that topic.

const blockText = (b: HelpBlock) =>
  b.kind === 'p' ? [b.text] : [...('heading' in b && b.heading ? [b.heading] : []), ...b.items]

function topicText(t: HelpTopic) {
  return [t.title, t.keywords ?? '', ...t.body.flatMap(blockText)].map(plainHelpText).join(' ').toLowerCase()
}

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)

export default function HelpPage({ guide, framed = false }: { guide: HelpGuide; framed?: boolean }) {
  const { hash, key } = useLocation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set())

  const index = useMemo(
    () => new Map(guide.sections.flatMap(s => s.topics.map(t => [t.id, topicText(t)] as const))),
    [guide],
  )
  const terms = words(query)
  const matches = (t: HelpTopic) => terms.every(w => index.get(t.id)?.includes(w))
  const searching = terms.length > 0
  const shownSections = guide.sections
    .map(s => ({ ...s, topics: s.topics.filter(matches) }))
    .filter(s => s.topics.length > 0)
  const found = shownSections.reduce((n, s) => n + s.topics.length, 0)

  // A link to /…/help#topic (from the contents, a tip or another topic) opens it, clearing any
  // search, while rendering (keyed on the navigation, so following the same link twice works);
  // the effect then brings it, or a #section, into view.
  const [seenKey, setSeenKey] = useState<string | null>(null)
  if (seenKey !== key) {
    setSeenKey(key)
    const id = decodeURIComponent(hash.slice(1))
    if (index.has(id)) {
      if (query) setQuery('')
      if (!open.has(id)) setOpen(new Set(open).add(id))
    }
  }

  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1))
    if (!id) return
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({ block: 'start' })
      const target = el.querySelector<HTMLElement>('summary, h2') ?? el
      target.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash, key])

  function toggle(id: string, isOpen: boolean) {
    setOpen(prev => {
      if (prev.has(id) === isOpen) return prev
      const next = new Set(prev)
      if (isOpen) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div className={framed ? 'max-w-[1200px] mx-auto px-4 sm:px-8 py-8' : undefined}>
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <div className="lg:col-start-2 max-w-[70ch]">
          <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance">{guide.title}</h1>
          <p className="mt-2 text-ink-muted text-pretty"><HelpText text={guide.intro} /></p>

          <div role="search" className="mt-5 max-w-[30rem]">
            <label htmlFor={`${guide.role}-help-search`} className="block font-bold mb-1.5">Search help</label>
            <div className="relative">
              <Search size={18} strokeWidth={2.25} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                id={`${guide.role}-help-search`}
                type="search"
                className="ui-input pl-10"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-describedby={`${guide.role}-help-found`}
                autoComplete="off"
              />
            </div>
            <p id={`${guide.role}-help-found`} role="status" className="mt-1.5 text-sm text-ink-muted min-h-5">
              {searching ? (found === 0 ? `Nothing matches “${query.trim()}”. Try a shorter word.` : `${found} topic${found === 1 ? '' : 's'} match.`) : ''}
            </p>
          </div>
        </div>

        <nav aria-label="On this page" className="mt-6 lg:mt-0 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
          <h2 className="text-sm font-bold text-ink-muted">On this page</h2>
          <ul role="list" className="mt-1 flex flex-wrap gap-x-5 lg:block">
            {guide.sections.map(s => (
              <li key={s.id} className="lg:mt-3">
                <Link to={`#${s.id}`} className="inline-flex items-center min-h-11 lg:min-h-0 lg:py-1 font-bold text-ink underline underline-offset-[3px] decoration-[1.5px] hover:decoration-[3px]">
                  {s.title}
                </Link>
                <ul role="list" className="hidden lg:block mt-1 border-l border-border">
                  {s.topics.map(t => (
                    <li key={t.id}>
                      <Link to={`#${t.id}`} className="block py-1 pl-3 text-sm text-ink-muted hover:text-ink hover:underline underline-offset-[3px] text-pretty">
                        {t.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-start-2 max-w-[70ch]">
          {shownSections.map(s => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-8 pt-5 border-t-2 border-ink scroll-mt-24">
              <h2 id={`${s.id}-h`} tabIndex={-1} className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] focus:outline-none">{s.title}</h2>
              {s.intro && !searching && <p className="mt-1.5 text-ink-muted text-pretty"><HelpText text={s.intro} /></p>}
              <ul role="list" className="mt-3 border-b border-border divide-y divide-border">
                {s.topics.map(t => (
                  <li key={t.id}>
                    <details
                      id={t.id}
                      open={searching || open.has(t.id)}
                      onToggle={e => { if (!searching) toggle(t.id, e.currentTarget.open) }}
                      className="group/topic scroll-mt-24"
                    >
                      <summary className="flex items-center justify-between gap-3 min-h-14 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-lg font-bold leading-[1.3] text-pretty hover:underline underline-offset-[3px]">
                        {t.title}
                        <ChevronDown size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-ink-muted transition-transform group-open/topic:rotate-180" />
                      </summary>
                      <TopicBody topic={t} />
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {searching && found === 0 && (
            <p className="mt-8 pt-5 border-t-2 border-ink text-ink-muted">
              No help topic uses those words. Clear the search to see every topic.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function TopicBody({ topic }: { topic: HelpTopic }) {
  return (
    <div className="pb-6 pt-1 space-y-4 text-pretty">
      {topic.body.map((b, i) => {
        if (b.kind === 'p') return <p key={i}><HelpText text={b.text} /></p>
        if (b.kind === 'steps') {
          return (
            <div key={i}>
              {b.heading && <h3 className="font-bold mb-2">{b.heading}</h3>}
              <ol role="list" className="space-y-2.5">
                {b.items.map((item, n) => (
                  <li key={n} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2">
                    <span aria-hidden="true" className="font-extrabold tabular-nums">{n + 1}.</span>
                    <span><HelpText text={item} /></span>
                  </li>
                ))}
              </ol>
            </div>
          )
        }
        return (
          <div key={i}>
            <h3 className="font-bold mb-2">{b.kind === 'system' ? 'What the system does for you' : b.heading}</h3>
            <ul role="list" className="space-y-2 list-disc pl-5 marker:text-ink-muted">
              {b.items.map((item, n) => <li key={n}><HelpText text={item} /></li>)}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
