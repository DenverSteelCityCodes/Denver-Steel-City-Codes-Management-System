import { useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import InlineConfirm from './InlineConfirm'
import { fetchRecipientEmails, type UpdateWithSection } from '../hooks/useUpdates'
import { timeAgo } from '../lib/campDay'
import { copyText } from '../lib/mailto'
import { audienceText } from '../lib/updateMeta'

interface Props {
  updates: UpdateWithSection[]
  loading?: boolean
  // Who may delete: the author (their own) or an admin (any).
  canDelete?: (u: UpdateWithSection) => boolean
  onDelete?: (id: string) => Promise<void>
  // Show "Copy emails" (admins and section crew; the RPC enforces it).
  canCopyEmails?: (u: UpdateWithSection) => boolean
  limit?: number
  emptyText?: string
  compact?: boolean
}

const actionCls = 'inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px] hover:decoration-2'

// Read-only list of updates, newest first, set straight on the page: who posted it and to whom as a
// sentence, then the post. Copy emails and Delete are labelled 44px actions; Delete asks inline
// under the item (no modal). The container frames the list (2px ink rules); rows divide with hairlines.
export default function UpdatesFeed({
  updates, loading = false, canDelete, onDelete, canCopyEmails, limit, emptyText = 'No updates yet.', compact = false,
}: Props) {
  const [pending, setPending] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null)
  const list = limit ? updates.slice(0, limit) : updates

  async function del(id: string) {
    setBusy(true)
    try { await onDelete?.(id); setPending(null) }
    catch { setMsg({ id, text: "Couldn't delete it. Check your connection and try again." }) }
    finally { setBusy(false) }
  }

  async function copyEmails(u: UpdateWithSection) {
    try {
      const emails = await fetchRecipientEmails(u.audience, u.section_id)
      const ok = await copyText(emails.join(', '))
      setMsg({ id: u.id, text: ok ? `Copied ${emails.length} ${emails.length === 1 ? 'address' : 'addresses'}.` : "Your browser blocked the clipboard. Try again from a secure tab." })
    } catch {
      setMsg({ id: u.id, text: "Couldn't get the addresses. Check your connection and try again." })
    }
    setTimeout(() => setMsg(null), 4000)
  }

  if (loading) {
    return <div className="space-y-3 py-3" aria-busy="true">{[1, 2].map(i => <div key={i} className="h-16 bg-surface-sunken rounded animate-pulse" />)}</div>
  }
  if (list.length === 0) {
    return <p className="py-3 text-ink-muted">{emptyText}</p>
  }

  return (
    <ul>
      {list.map(u => {
        const copy = canCopyEmails?.(u)
        const remove = canDelete?.(u)
        return (
          <li key={u.id} className={`border-t border-border first:border-t-0 ${compact ? 'py-3' : 'py-4'}`}>
            <p className="text-sm text-ink-muted">
              <b className="font-bold text-ink">{u.author_name}</b> to {audienceText(u)},{' '}
              <time dateTime={u.created_at}>{timeAgo(u.created_at)}</time>
            </p>
            <p className="mt-1.5 max-w-[65ch] text-ink whitespace-pre-line text-pretty break-words">{u.body}</p>
            {(copy || remove) && pending !== u.id && (
              <div className="mt-1 flex flex-wrap gap-x-6">
                {copy && (
                  <button type="button" onClick={() => void copyEmails(u)} className={`${actionCls} text-ink`}>
                    <Copy size={16} strokeWidth={2.5} aria-hidden="true" /> Copy emails
                  </button>
                )}
                {remove && (
                  <button type="button" onClick={() => setPending(u.id)} className={`${actionCls} text-danger`}>
                    <Trash2 size={16} strokeWidth={2.5} aria-hidden="true" /> Delete
                  </button>
                )}
              </div>
            )}
            {msg?.id === u.id && <p role="status" className="mt-1 text-sm font-bold text-ink-muted">{msg.text}</p>}
            {pending === u.id && (
              <div className="mt-3">
                <InlineConfirm
                  frame
                  message="Delete this update? Readers will no longer see it."
                  confirmLabel="Delete"
                  cancelLabel="Keep it"
                  busy={busy}
                  onConfirm={() => void del(u.id)}
                  onCancel={() => setPending(null)}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
