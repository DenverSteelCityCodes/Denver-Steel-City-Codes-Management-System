import { useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { FIELD_LABELS } from '../lib/editConflict'
import InlineConfirm from './InlineConfirm'

// One audit-log entry as admin_history() / admin_camper_history() return it (spec 15).
export interface HistoryEntry {
  id: number
  at: string
  actor_name: string | null
  actor_role: string | null
  table_name?: string
  row_id?: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old: Record<string, unknown> | null
  new: Record<string, unknown> | null
  reason: string | null
}

const REVERTIBLE = new Set(['students', 'registrations', 'sections'])
// Stamped by the database; never shown as a change.
const HIDDEN = new Set(['updated_at', 'cancelled_at', 'cancelled_by', 'created_at', 'medical_info', 'full_name', 'displaced_from_section', 'session_id', 'cancel_reason', 'offered_at', 'offer_expires_at'])
const EXTRA_LABELS: Record<string, string> = {
  status: 'status', section_id: 'section', cancel_reason: 'reason', registration_year: 'confirmed for',
  waiver_signed_at: 'waiver signed', cancelled: 'cancelled',
}
const REASONS: Record<string, string> = {
  admin_removed: 'Removed by an admin', parent_cancel: 'Parent cancelled', section_cancelled: 'Class cancelled',
  declined_offer: 'Offer declined', offer_expired: 'Offer expired', took_other_seat: 'Took another spot', parent_swap: 'Parent switched class',
  auto_confirm: 'Auto-confirmed', merged: 'Merged duplicate', waitlist_offer: 'Waitlist offer', offer_accepted: 'Offer accepted',
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'blank'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (Array.isArray(v)) return v.join(', ') || 'blank'
  const s = String(v)
  return s.length > 60 ? `${s.slice(0, 60)}…` : s
}

function when(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Readable lines for one entry. sectionName turns a section id into "Python · PY-A (W1)".
function describe(e: HistoryEntry, sectionName: (id: string) => string, personName: (id: string) => string): string[] {
  const table = e.table_name ?? ''
  if (e.action === 'INSERT') {
    if (table === 'registrations') return [`Signed up for ${sectionName(String(e.new?.section_id ?? ''))} (${show(e.new?.status)})`]
    return ['Created']
  }
  if (e.action === 'DELETE') {
    if (table === 'registrations') return [`Registration for ${sectionName(String(e.old?.section_id ?? ''))} deleted`]
    return ['Deleted']
  }
  const lines: string[] = []
  for (const k of Object.keys(e.new ?? {})) {
    if (HIDDEN.has(k)) continue
    const a = e.old?.[k], b = e.new?.[k]
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue
    const label = EXTRA_LABELS[k] ?? FIELD_LABELS[k] ?? k.replace(/_/g, ' ')
    if (k === 'section_id') lines.push(`Moved: ${sectionName(String(a))} → ${sectionName(String(b))}`)
    else if (k === 'lead_id') lines.push(`Lead: ${a ? personName(String(a)) : 'none'} → ${b ? personName(String(b)) : 'none'}`)
    else lines.push(`${label[0].toUpperCase()}${label.slice(1)}: ${show(a)} → ${show(b)}`)
  }
  return lines.length > 0 ? lines : ['No visible change']
}

export default function HistoryStrip({
  load,
  tableName,
  sectionName = id => id,
  personName = () => 'a volunteer',
  onReverted,
  heading = true,
}: {
  load: () => PromiseLike<{ data: unknown; error: { message: string } | null }>
  // For admin_history(table, row), whose rows don't carry the table name.
  tableName?: string
  sectionName?: (id: string) => string
  personName?: (id: string) => string
  onReverted?: () => void | Promise<void>
  // Off when the page already names the list (Classes' History tab).
  heading?: boolean
}) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    load().then(({ data, error }) => {
      if (!alive) return
      if (error) setError(error.message)
      else { setError(null); setEntries(((data ?? []) as HistoryEntry[]).map(e => ({ ...e, table_name: e.table_name ?? tableName }))) }
    })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when a revert bumps the version
  }, [version])

  async function revert(id: number) {
    setBusy(true); setNote(null)
    const { error } = await supabase.rpc('admin_revert', { p_audit_id: id })
    setBusy(false); setConfirming(null)
    if (error) { setNote(error.message); return }
    setNote('Reverted. The undo is in the history too.')
    setVersion(v => v + 1)
    await onReverted?.()
  }

  // Rows of one dataset (DESIGN.md › Rows): the change in bold, then when, who and why; Revert is
  // a text action with a 44px target, and its confirm opens under the row.
  return (
    <div>
      {heading && <h3 className="text-lg font-bold leading-[1.3]">History</h3>}
      {error && <p role="alert" title={error} className="mt-2 font-bold text-danger">Couldn't load the history. Check your connection, then try again.</p>}
      {note && <p role="status" className="mt-2 text-ink-muted">{note}</p>}
      {!entries && !error ? (
        <div aria-hidden="true" className="mt-2 h-16 rounded bg-surface-sunken animate-pulse" />
      ) : entries && entries.length === 0 ? (
        <p className="mt-2 text-ink-muted text-pretty">No changes recorded yet. The log starts when the audit log was switched on.</p>
      ) : (
        <ol className="mt-2 border-y-2 border-ink">
          {entries?.slice(0, 20).map((e, i) => {
            const who = e.actor_name ? `${e.actor_name}${e.actor_role ? ` (${e.actor_role})` : ''}` : 'System'
            // The write's own reason (set by an RPC), else the cancel reason the row was stamped with.
            const raw = e.reason ?? (e.new?.cancel_reason !== e.old?.cancel_reason ? (e.new?.cancel_reason as string | null | undefined) : null) ?? null
            const reason = raw?.startsWith('revert:') ? 'Undo of an earlier change' : raw ? REASONS[raw] ?? raw : null
            const canRevert = e.action === 'UPDATE' && REVERTIBLE.has(e.table_name ?? '')
            return (
              <li key={e.id} className={`py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                <div className="flex flex-wrap items-start gap-x-4">
                  <div className="min-w-0 flex-[1_1_240px]">
                    {describe(e, sectionName, personName).map((line, j) => (
                      <p key={j} className="font-bold break-words">{line}</p>
                    ))}
                    <p className="text-sm text-ink-muted">{when(e.at)} · {who}{reason ? ` · ${reason}` : ''}</p>
                  </div>
                  {canRevert && confirming !== e.id && (
                    <button
                      type="button"
                      onClick={() => { setNote(null); setConfirming(e.id) }}
                      className="ui-btn ui-btn--text -my-2.5"
                    >
                      <Undo2 size={16} strokeWidth={2.5} aria-hidden="true" /> Revert
                    </button>
                  )}
                </div>
                {confirming === e.id && (
                  <div className="mt-3">
                    <InlineConfirm
                      tone="neutral"
                      message="Put back the values from before this change? It's saved as a new change, so it can be undone too."
                      confirmLabel="Revert"
                      cancelLabel="Keep"
                      busy={busy}
                      onConfirm={() => { void revert(e.id) }}
                      onCancel={() => setConfirming(null)}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
