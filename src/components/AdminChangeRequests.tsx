import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Admin: parents' open change requests (spec 11), resolved inline. Resolving emails the family.
interface RequestRow {
  id: string
  message: string | null
  kind: string
  created_at: string
  student: { full_name: string } | null
  requester: { display_name: string } | null
  registration: { status: string; sections: { label: string; week: number | null; classes: { name: string } | null } | null } | null
}

export default function AdminChangeRequests({ onResolved }: { onResolved?: () => void }) {
  const [rows, setRows] = useState<RequestRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    supabase
      .from('change_requests')
      .select(`id, message, kind, created_at,
        student:students ( full_name ),
        requester:profiles!change_requests_requested_by_fkey ( display_name ),
        registration:registrations ( status, sections ( label, week, classes ( name ) ) )`)
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setError(error.message)
        else setRows((data ?? []) as unknown as RequestRow[])
      })
    return () => { alive = false }
  }, [version])

  async function resolve(id: string, status: 'done' | 'declined') {
    setBusy(id)
    const { error } = await supabase.from('change_requests')
      .update({ status, resolution_note: notes[id]?.trim() || null }).eq('id', id)
    setBusy(null)
    if (error) { setError(error.message); return }
    setVersion(v => v + 1)
    onResolved?.()
  }

  if (rows && rows.length === 0 && !error) return null
  return (
    <section id="requests" aria-labelledby="requests-heading" className="bg-surface border border-brand/40 rounded-xl shadow-sm px-4 sm:px-5 py-4 mb-6">
      <h2 id="requests-heading" className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted flex items-center gap-1.5 mb-1">
        <MessageSquare size={13} /> Change requests
      </h2>
      <p className="font-sans text-sm text-ink-muted mb-3">Make the change (move, cancel, reassign), then mark it done. The person who asked gets an email either way.</p>
      {error && <p role="alert" className="font-sans text-sm text-danger mb-2">{error}</p>}
      {!rows ? <div className="h-16 bg-surface-sunken rounded-[10px] animate-pulse" /> : (
        <ul className="divide-y divide-border">
          {rows.map(r => {
            const sec = r.registration?.sections
            return (
              <li key={r.id} className="py-3 space-y-2">
                <p className="font-sans text-sm text-ink">
                  <span className="font-semibold">{r.kind === 'crew_switch' ? 'Volunteer section switch' : r.student?.full_name ?? 'A camper'}</span>
                  {sec ? ` · ${sec.classes?.name ?? ''} ${sec.label}${sec.week ? ` (Week ${sec.week})` : ''}` : ''}
                  <span className="text-ink-muted"> · from {r.requester?.display_name ?? 'a parent'}, {new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </p>
                <p className="font-sans text-sm text-ink bg-surface-sunken rounded-[8px] px-3 py-2">“{r.message}”</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <label htmlFor={`note-${r.id}`} className="sr-only">Reply (optional)</label>
                  <input id={`note-${r.id}`} placeholder="Reply (optional)" value={notes[r.id] ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                  <div className="flex gap-2">
                    <button type="button" disabled={busy === r.id} onClick={() => { void resolve(r.id, 'declined') }}
                      className="h-9 px-3 rounded-[8px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition disabled:opacity-50">Decline</button>
                    <button type="button" disabled={busy === r.id} onClick={() => { void resolve(r.id, 'done') }}
                      className="h-9 px-3 rounded-[8px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm transition disabled:opacity-50">Mark done</button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
