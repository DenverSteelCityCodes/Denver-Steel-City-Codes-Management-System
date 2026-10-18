import { useOutletContext } from 'react-router-dom'
import { audienceLabel, type UpdateWithSection } from '../hooks/useUpdates'

// What every parent page can read from the shell (ParentLayout): the camp's posts, fetched once
// there so the Updates tab carries the unread marker and Home can point at the latest post.
export interface ParentShell {
  posts: UpdateWithSection[]
  postsLoading: boolean
  postsError: string | null
}

export const useParentShell = () => useOutletContext<ParentShell>()

// Where a post went, in a parent's words: the class and week, never the section code.
export function parentAudience(u: UpdateWithSection): string {
  if (u.audience !== 'section') return audienceLabel(u)
  const cls = u.sections?.classes?.name
  return cls ? `${cls}${u.sections?.week ? `, Week ${u.sections.week}` : ''}` : "Your camper's class"
}
