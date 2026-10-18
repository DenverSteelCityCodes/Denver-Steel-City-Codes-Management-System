import { PAGES, type PageKey } from './pages'

// Inline markup for help text (types.ts): [[page]], [text](/path) and **control**. Parsed into
// tokens so the renderer stays dumb and the tests can read every link without a DOM.

export type HelpToken =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'link'; text: string; to: string }

const TOKEN = /\[\[([a-z0-9-]+)\]\]|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g

export function parseHelpText(source: string): HelpToken[] {
  const out: HelpToken[] = []
  let last = 0
  for (const m of source.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: source.slice(last, at) })
    if (m[1] !== undefined) {
      const page = PAGES[m[1] as PageKey]
      // An unknown page key stays visible as text; the help tests fail on it.
      out.push(page ? { kind: 'link', text: page.label, to: page.to } : { kind: 'text', text: m[0] })
    } else if (m[2] !== undefined) {
      out.push({ kind: 'link', text: m[2], to: m[3] })
    } else {
      out.push({ kind: 'strong', text: m[4] })
    }
    last = at + m[0].length
  }
  if (last < source.length) out.push({ kind: 'text', text: source.slice(last) })
  return out
}

// The words of a help string without its markup, for search.
export function plainHelpText(source: string): string {
  return parseHelpText(source).map(t => t.text).join('')
}

// Every [[key]] used in a string, known or not (for the tests).
export function pageKeysIn(source: string): string[] {
  return [...source.matchAll(/\[\[([a-z0-9-]+)\]\]/g)].map(m => m[1])
}
