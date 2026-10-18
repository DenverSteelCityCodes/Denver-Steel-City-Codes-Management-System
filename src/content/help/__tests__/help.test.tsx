import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ADMIN_GUIDE } from '../admin'
import { PARENT_GUIDE } from '../parent'
import { VOLUNTEER_GUIDE } from '../volunteer'
import { TIPS } from '../tips'
import { PAGES } from '../pages'
import { pageKeysIn, parseHelpText } from '../markup'
import type { HelpBlock, HelpGuide, HelpRole, HelpTip } from '../types'
import HelpPage from '../../../pages/help/HelpPage'
import HowItWorks from '../../../components/HowItWorks'
// App.tsx as text (Vite's ?raw import), so the routes are read from the real file.
import appSource from '../../../App.tsx?raw'

// Every link in the in-app help (guides, playbook and tips) must land on a real route, in the
// area of the role reading it, and every "#topic" on a real topic. Routes come from App.tsx
// itself, so removing or renaming a route without updating the help fails here.

const routes = [...appSource.matchAll(/path="([^"]+)"/g)].map(m => m[1]).filter(p => p !== '*')
const routeMatchers = routes.map(r => new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}$`))
const isRoute = (path: string) => routeMatchers.some(m => m.test(path))

const GUIDES: HelpGuide[] = [ADMIN_GUIDE, PARENT_GUIDE, VOLUNTEER_GUIDE]
const guideFor = (role: HelpRole) => GUIDES.find(g => g.role === role)!

const PUBLIC = ['/login', '/signup', '/forgot', '/reset', '/apply']
const AREA: Record<HelpRole, (path: string) => boolean> = {
  admin: p => p === '/admin' || p.startsWith('/admin/') || p.startsWith('/print/') || PUBLIC.includes(p),
  parent: p => p === '/parent' || p.startsWith('/parent/') || PUBLIC.includes(p),
  volunteer: p => p === '/volunteer' || p.startsWith('/volunteer/') || p.startsWith('/print/') || PUBLIC.includes(p),
}

const blockStrings = (b: HelpBlock) => (b.kind === 'p' ? [b.text] : [...('heading' in b && b.heading ? [b.heading] : []), ...b.items])
function guideStrings(g: HelpGuide): string[] {
  return [g.intro, ...g.sections.flatMap(s => [s.title, s.intro ?? '', ...s.topics.flatMap(t => [t.title, ...t.body.flatMap(blockStrings)])])]
}
const tipStrings = (t: HelpTip) => [t.label ?? '', ...t.body]

const anchorsOf = (g: HelpGuide) => new Set(g.sections.flatMap(s => [s.id, ...s.topics.map(t => t.id)]))

// Problems with one link, or null when it's good.
function checkLink(to: string, role: HelpRole): string | null {
  const url = new URL(to, 'https://help.test')
  if (!to.startsWith('/')) return `${to} is not an app route`
  if (!isRoute(url.pathname)) return `${to} matches no route in App.tsx`
  if (!AREA[role](url.pathname)) return `${to} is outside the ${role} area`
  if (url.hash) {
    const target = GUIDES.find(g => g.path === url.pathname)
    if (!target) return `${to} has a #topic but isn't a help page`
    if (!anchorsOf(target).has(url.hash.slice(1))) return `${to} points at a topic that doesn't exist`
  }
  return null
}

function linkProblems(strings: string[], role: HelpRole): string[] {
  const problems: string[] = []
  for (const s of strings) {
    for (const key of pageKeysIn(s)) if (!(key in PAGES)) problems.push(`[[${key}]] is not in pages.ts`)
    for (const tok of parseHelpText(s)) {
      if (tok.kind !== 'link') continue
      const p = checkLink(tok.to, role)
      if (p) problems.push(p)
    }
  }
  return problems
}

describe('help pages registry', () => {
  it('reads the routes from App.tsx', () => {
    expect(routes).toContain('/admin/students')
    expect(routes.length).toBeGreaterThan(20)
  })

  it.each(Object.entries(PAGES))('%s points at a real route', (_key, page) => {
    expect(isRoute(new URL(page.to, 'https://help.test').pathname)).toBe(true)
  })
})

describe('help routes', () => {
  // Each help route sits inside its role's ProtectedRoute: the nearest allowedRoles before it.
  it.each([
    ['/admin/help', "['admin']"],
    ['/parent/help', "['parent']"],
    ['/volunteer/help', "['volunteer']"],
  ])('%s is gated to %s', (path, roles) => {
    const at = appSource.indexOf(`path="${path}"`)
    expect(at).toBeGreaterThan(-1)
    const gates = [...appSource.slice(0, at).matchAll(/allowedRoles=\{(\[[^\]]*\])\}/g)]
    expect(gates.at(-1)?.[1]).toBe(roles)
  })

  it.each(GUIDES.map(g => [g.role, g] as const))('the %s guide lives at a real route', (_role, g) => {
    expect(isRoute(g.path)).toBe(true)
  })
})

describe.each(GUIDES.map(g => [g.role, g] as const))('%s guide', (role, guide) => {
  it('links only to real routes in its own area, and to real topics', () => {
    expect(linkProblems(guideStrings(guide), role)).toEqual([])
  })

  it('has unique anchors', () => {
    const ids = guide.sections.flatMap(s => [s.id, ...s.topics.map(t => t.id)])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every topic something to do or know', () => {
    for (const t of guide.sections.flatMap(s => s.topics)) expect(t.body.length, t.id).toBeGreaterThan(0)
  })

  it('renders every topic', () => {
    const html = renderToStaticMarkup(<MemoryRouter><HelpPage guide={guide} /></MemoryRouter>)
    for (const t of guide.sections.flatMap(s => s.topics)) expect(html).toContain(`id="${t.id}"`)
    // No markup leaks through as text.
    expect(html).not.toMatch(/\*\*|\[\[/)
  })
})

describe('admin playbook', () => {
  it('has a numbered answer and a "what the system does" for each case', () => {
    const playbook = ADMIN_GUIDE.sections.find(s => s.id === 'playbook')!
    expect(playbook.topics.length).toBeGreaterThanOrEqual(13)
    for (const t of playbook.topics) {
      expect(t.title, t.id).toMatch(/^When /)
      expect(t.body.some(b => b.kind === 'steps'), t.id).toBe(true)
    }
  })
})

describe('tips', () => {
  const entries = Object.entries(TIPS) as [keyof typeof TIPS, HelpTip][]

  it('has 10 to 12 tips', () => {
    expect(entries.length).toBeGreaterThanOrEqual(10)
    expect(entries.length).toBeLessThanOrEqual(12)
  })

  it.each(entries)('%s links only to real routes and a real help topic for its role', (_key, tip) => {
    expect(linkProblems(tipStrings(tip), tip.role)).toEqual([])
    if (tip.more) {
      expect(checkLink(tip.more, tip.role)).toBeNull()
      expect(new URL(tip.more, 'https://help.test').pathname).toBe(guideFor(tip.role).path)
    }
  })

  it.each(entries)('%s renders as a closed disclosure', key => {
    const html = renderToStaticMarkup(<MemoryRouter><HowItWorks tip={key} /></MemoryRouter>)
    expect(html).toMatch(/^<details/)
    expect(html).not.toContain('open=""')
    expect(html).toContain('How this works')
  })
})
