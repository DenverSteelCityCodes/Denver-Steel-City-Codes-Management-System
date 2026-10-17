import { useState } from 'react'
import { Megaphone, Trash2, Mail, Users } from 'lucide-react'
import InlineConfirm from './InlineConfirm'
import { audienceLabel, fetchRecipientEmails, type UpdateWithSection } from '../hooks/useUpdates'
import { timeAgo } from '../lib/campDay'
import { copyText } from '../lib/mailto'

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

// Read-only list of updates, newest first. Delete uses InlineConfirm under the item (no modal).
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
    catch (e) { setMsg({ id, text: e instanceof Error ? e.message : "Couldn't delete" }) }
    finally { setBusy(false) }
  }

  async function copyEmails(u: UpdateWithSection) {
    try {
      const emails = await fetchRecipientEmails(u.audience, u.section_id)
      const ok = await copyText(emails.join(', '))
      setMsg({ id: u.id, text: ok ? `Copied ${emails.length} ${emails.length === 1 ? 'address' : 'addresses'}` : 'Clipboard blocked — try again from a secure tab' })
    } catch (e) {
      setMsg({ id: u.id, text: e instanceof Error ? e.message : "Couldn't fetch addresses" })
    }
    setTimeout(() => setMsg(null), 4000)
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 bg-surface-sunken rounded-[10px] animate-pulse" />)}</div>
  }
  if (list.length === 0) {
    return (
      <p className="flex items-center gap-2 font-sans text-sm text-ink-muted">
        <Megaphone size={16} className="text-ink-faint" /> {emptyText}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {list.map(u => (
        <li key={u.id} className={compact ? 'py-2.5' : 'py-3.5'}>
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-brand-soft text-warning flex items-center justify-center shrink-0 mt-0.5">
              <Megaphone size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 font-sans text-xs text-ink-muted">
                <span className="font-semibold text-ink">{u.author_name}</span>
                <span className="inline-flex items-center gap-1"><Users size={11} /> {audienceLabel(u)}</span>
                <span>· {timeAgo(u.created_at)}</span>
              </p>
              <p className={`mt-1 font-sans text-ink whitespace-pre-line ${compact ? 'text-sm' : 'text-[15px]'}`}>{u.body}</p>
              {msg?.id === u.id && <p role="status" className="mt-1 font-sans text-xs text-ink-muted">{msg.text}</p>}
            </div>
            {(canCopyEmails?.(u) || canDelete?.(u)) && (
              <div className="flex items-center gap-0.5 shrink-0">
                {canCopyEmails?.(u) && (
                  <button type="button" onClick={() => copyEmails(u)} title="Copy recipient emails" aria-label="Copy recipient emails"
                    className="p-2 text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[8px] transition">
                    <Mail size={15} />
                  </button>
                )}
                {canDelete?.(u) && (
                  <button type="button" onClick={() => setPending(pending === u.id ? null : u.id)} title="Delete update" aria-label="Delete update"
                    className="p-2 text-ink-muted hover:text-danger hover:bg-danger-soft rounded-[8px] transition">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
          {pending === u.id && (
            <div className="mt-2 rounded-[10px] overflow-hidden border border-danger/30">
              <InlineConfirm
                message="Delete this update? Readers will no longer see it."
                confirmLabel="Delete"
                busy={busy}
                onConfirm={() => del(u.id)}
                onCancel={() => setPending(null)}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
