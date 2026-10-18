import { useParentShell, parentAudience } from '../lib/parentShell'
import { timeAgo } from '../lib/campDay'

// The Updates tab: posts from the camp team and class leads, newest first. A plain reading list;
// visiting it clears the unread marker on the tab (ParentLayout).
export default function ParentUpdates() {
  const { posts, postsLoading, postsError } = useParentShell()

  return (
    <div className="max-w-[760px] mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-12">
      <h1 className="font-display text-[1.75rem] leading-[1.15] font-bold tracking-[-0.01em] text-balance">Updates from camp</h1>
      <p className="mt-2 mb-5 text-ink-muted text-pretty">News from your campers' class leads and the camp team, newest first.</p>

      {postsLoading ? (
        <div className="border-y-2 border-ink" aria-busy="true">
          {[1, 2].map(i => <div key={i} className="h-20 my-3 bg-surface-sunken rounded animate-pulse" />)}
        </div>
      ) : postsError ? (
        <p role="alert" className="font-bold text-danger">Couldn't load updates. Check your connection and reload the page.</p>
      ) : posts.length === 0 ? (
        <p className="py-4 border-y-2 border-ink text-ink-muted">
          Nothing from camp yet. Updates from the camp team and your camper's class lead will show here.
        </p>
      ) : (
        <ul className="border-y-2 border-ink">
          {posts.map(p => (
            <li key={p.id} className="py-4 border-t border-border first:border-t-0">
              <p>
                <b>{p.author_name}</b>
                <span className="text-sm text-ink-muted"><span className="px-[0.35em]">·</span>{parentAudience(p)}<span className="px-[0.35em]">·</span>{timeAgo(p.created_at)}</span>
              </p>
              <p className="mt-1 whitespace-pre-line text-pretty max-w-[65ch]">{p.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
