import type { UpdateWithSection } from '../hooks/useUpdates'

// Who a post went to, as words that follow "to": "everyone", "volunteers",
// "families in Intro to Python PY-B, Week 1". Read as a sentence instead of a dot-joined run.
export function audienceText(u: Pick<UpdateWithSection, 'audience' | 'sections'>): string {
  switch (u.audience) {
    case 'everyone': return 'everyone'
    case 'parents': return 'parents'
    case 'volunteers': return 'volunteers'
    case 'section': {
      const cls = u.sections?.classes?.name
      if (!cls) return 'one class'
      const label = u.sections?.label
      const week = u.sections?.week
      return `families in ${cls}${label ? ` ${label}` : ''}${week ? `, Week ${week}` : ''}`
    }
  }
}
