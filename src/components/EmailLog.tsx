import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Admin: the emails the app itself sends (spec 09), newest first. RLS lets only admins read them.
interface NotificationRow {
  id: number
  recipient_email: string | null
  template: string
  payload: Record<string, unknown>
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled'
  attempts: number
  last_error: string | null
  created_at: string
  sent_at: string | null
}

const LABELS: Record<string, string> = {
  registration_confirmed: 'Spot confirmed', registration_waitlisted: 'Waitlisted', registration_moved: 'Class change',
  registration_cancelled: 'Cancelled',
  interest_confirm: 'Notify me: confirm', registration_opening_soon: 'Registration opening soon', registration_now_open: 'Registration open',
}
const STATUS: Record<NotificationRow['status'], string> = {
  queued: 'bg-warning-soft text-warning', sending: 'bg-info-soft text-info', sent: 'bg-success-soft text-success',
  failed: 'bg-danger-soft text-danger', cancelled: 'bg-surface-sunken text-ink-muted',
}

export default function EmailLog() {
  const [rows, setRows] = useState<NotificationRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Queued for more than 10 minutes means nothing is sending (usually: no provider key yet).
  const [stuck, setStuck] = useState(0)

  useEffect(() => {
    let alive = true
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setError(error.message)
        else {
          const list = (data ?? []) as NotificationRow[]
          const cutoff = Date.now() - 10 * 60_000
          setRows(list)
          setStuck(list.filter(r => r.status === 'queued' && new Date(r.created_at).getTime() < cutoff).length)
        }
      })
    return () => { alive = false }
  }, [])

  return (
    <section aria-labelledby="email-log-heading" className="bg-surface border border-border rounded-[14px] shadow-sm px-4 sm:px-5 py-4">
      <h2 id="email-log-heading" className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted mb-1 flex items-center gap-1.5">
        <Mail size={13} /> Emails the app sent
      </h2>
      <p className="font-sans text-sm text-ink-muted mb-3">
        Confirmations, waitlist and change notices go to families automatically. Addresses at example.com (the demo) are skipped.
      </p>
      {stuck > 0 && (
        <p role="alert" className="mb-3 font-sans text-sm text-warning bg-warning-soft rounded-[8px] px-3 py-2">
          {stuck} email{stuck === 1 ? ' is' : 's are'} waiting to be sent. If this doesn't clear, the email provider isn't set up yet (spec 02).
        </p>
      )}
      {error && <p role="alert" className="font-sans text-sm text-danger">Couldn't load the email log: {error}</p>}
      {!rows && !error ? (
        <div className="h-16 bg-surface-sunken rounded-[10px] animate-pulse" />
      ) : rows && rows.length === 0 ? (
        <p className="font-sans text-sm text-ink-muted">No emails yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows?.map(r => (
            <li key={r.id} className="py-2 flex items-start gap-3 font-sans text-sm">
              <span className={`shrink-0 mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS[r.status]}`}>{r.status === 'cancelled' ? 'skipped' : r.status}</span>
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate">
                  {[LABELS[r.template] ?? r.template, [r.payload?.camper_full ?? r.payload?.camper, r.payload?.class].filter(Boolean).map(String).join(' · ')].filter(Boolean).join(': ')}
                </p>
                <p className="text-xs text-ink-muted truncate">
                  {r.recipient_email ?? 'no address'} · {new Date(r.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {r.last_error ? ` · ${r.last_error}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
