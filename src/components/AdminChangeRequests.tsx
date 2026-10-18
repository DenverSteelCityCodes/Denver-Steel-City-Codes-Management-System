import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/campDay'
import { Input } from './Field'

// Admin: open change requests from families (spec 11) and volunteers (spec 25), first on Campers.
// One decision per line between 2px ink rules: who and what, who asked, their words, then an
// optional reply and Mark done / Decline. Resolving emails the person who asked, with the reply.
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
  const { hash } = useLocation()
  const [rows, setRows] = useState<RequestRow[] | null>(null)
  const [error, setError] = useState<{ what: 'load' | 'save'; message: string } | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

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
        if (error) setError({ what: 'load', message: error.message })
        else { setError(null); setRows((data ?? []) as unknown as RequestRow[]) }
      })
    return () => { alive = false }
  }, [version])

  // Today's "Review requests" links to #requests: land on the heading once the list is in.
  const hasRows = !!rows && rows.length > 0
  useEffect(() => {
    if (hash === '#requests' && hasRows) headingRef.current?.focus()
  }, [hash, hasRows])

  async function resolve(id: string, status: 'done' | 'declined') {
    setBusy(id)
    const { error } = await supabase.from('change_requests')
      .update({ status, resolution_note: notes[id]?.trim() || null }).eq('id', id)
    setBusy(null)
    if (error) { setError({ what: 'save', message: error.message }); return }
    setError(null)
    setVersion(v => v + 1)
    onResolved?.()
  }

  if (rows && rows.length === 0 && !error) return null
  return (
    <section id="requests" aria-labelledby="requests-heading" className="mb-10 scroll-mt-32 lg:scroll-mt-20">
      <h2 id="requests-heading" ref={headingRef} tabIndex={-1}
        className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] focus:outline-none">
        Change requests{rows ? ` (${rows.length})` : ''}
      </h2>
      <p className="mt-2 text-sm text-ink-muted text-pretty max-w-[68ch]">
        Make the change in the camper's row below (or the section, for a volunteer), then mark the request done.
        The person who asked gets an email either way, with your reply.
      </p>
      {error && (
        <p role="alert" title={error.message} className="mt-3 font-bold text-danger text-pretty">
          {error.what === 'save'
            ? "Couldn't save that. Check your connection, then try again."
            : rows
              ? "Couldn't reload the change requests, so this list may be out of date. Check your connection."
              : "Couldn't load the change requests. Check your connection, then try again."}
        </p>
      )}
      {!rows ? (
        !error && <div aria-hidden="true" className="mt-3 h-28 rounded bg-surface-sunken animate-pulse" />
      ) : (
        <ul className="mt-3 border-b-2 border-ink">
          {rows.map(r => {
            const sec = r.registration?.sections
            const who = r.kind === 'crew_switch' ? 'Volunteer section switch' : r.student?.full_name ?? 'A camper'
            const where = sec ? `${sec.classes?.name ?? ''}${sec.classes?.name ? ', ' : ''}${sec.label}${sec.week ? ` · Week ${sec.week}` : ''}` : null
            const asker = r.requester?.display_name ?? (r.kind === 'crew_switch' ? 'a volunteer' : 'a parent')
            return (
              <li key={r.id} className="py-4 border-t-2 border-ink">
                <p className="text-lg font-bold leading-[1.3] text-pretty">{who}{where && <> · {where}</>}</p>
                <p className="mt-1 text-ink-muted">From {asker} · {timeAgo(r.created_at)}</p>
                {r.message && <p className="mt-2 max-w-[68ch] text-pretty">“{r.message}”</p>}
                <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
                  <div className="flex-[1_1_320px] max-w-[480px] min-w-0">
                    <label htmlFor={`note-${r.id}`} className="block font-bold">Reply <span className="font-normal text-ink-muted">(optional)</span></label>
                    <Input id={`note-${r.id}`} className="mt-1.5" value={notes[r.id] ?? ''}
                      onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                  </div>
                  <div className="flex flex-wrap gap-x-5">
                    <button type="button" disabled={busy === r.id} onClick={() => { void resolve(r.id, 'done') }}
                      className="ui-btn ui-btn--text">Mark done</button>
                    <button type="button" disabled={busy === r.id} onClick={() => { void resolve(r.id, 'declined') }}
                      className="ui-btn ui-btn--text text-ink-muted font-semibold">Decline</button>
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
