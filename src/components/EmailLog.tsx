import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Hourglass, MailWarning, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusWord from './StatusWord'

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
}

function Status({ status }: { status: NotificationRow['status'] }) {
  if (status === 'sent') return <StatusWord tone="ok" icon={CircleCheck}>Sent</StatusWord>
  if (status === 'failed') return <StatusWord tone="danger" icon={CircleAlert}>Failed</StatusWord>
  if (status === 'sending') return <StatusWord tone="waiting" icon={Send}>Sending</StatusWord>
  if (status === 'queued') return <StatusWord tone="waiting" icon={Hourglass}>Waiting</StatusWord>
  return <StatusWord tone="plain">Skipped</StatusWord>
}

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

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

  const th = 'px-3 py-2.5 text-left text-sm font-bold text-ink-muted border-b border-ink whitespace-nowrap'
  const mobileLabel = 'md:hidden text-sm font-bold text-ink-muted'

  return (
    <section aria-labelledby="email-log-heading">
      <h2 id="email-log-heading" className="sr-only">Sent emails</h2>
      {stuck > 0 && (
        <div role="note" className="mb-5 py-3 flex items-start gap-3 border-y-2 border-ink">
          <MailWarning size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 mt-0.5" />
          <p className="text-pretty">
            <b className="block font-extrabold">{stuck} email{stuck === 1 ? ' is' : 's are'} waiting to send.</b>
            If this doesn't clear, the email service isn't connected yet. They go out to families once it is.
          </p>
        </div>
      )}
      <p className="text-ink-muted text-pretty max-w-[65ch]">
        Confirmations, waitlist and change notices go to families by themselves. Addresses at example.com (the demo) are skipped. The 50 newest are here, newest first.
      </p>
      {error && <p role="alert" title={error} className="mt-4 font-bold text-danger">Couldn't load the sent emails. Reload the page to try again.</p>}
      {!rows && !error ? (
        <div aria-busy="true" aria-label="Loading sent emails" className="mt-4 border-y-2 border-ink">
          {[1, 2, 3].map(i => <div key={i} className="h-12 my-1 rounded bg-surface-sunken animate-pulse" />)}
        </div>
      ) : rows && rows.length === 0 ? (
        <p className="mt-4 py-4 border-y-2 border-ink font-bold">No emails yet.</p>
      ) : rows && (
        <table className="mt-4 w-full bg-surface border-y-2 border-ink max-md:block">
          <caption className="sr-only">Emails the app sent, newest first</caption>
          <thead className="max-md:sr-only">
            <tr>
              <th scope="col" className={th}>Email</th>
              <th scope="col" className={th}>To</th>
              <th scope="col" className={th}>Queued</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="max-md:block">
            {rows.map(r => {
              const camper = String(r.payload?.camper_full ?? r.payload?.camper ?? '')
              const cls = String(r.payload?.class ?? '')
              return (
                <tr key={r.id} className="border-t border-border first:border-t-0 max-md:block max-md:py-3">
                  <td className="px-3 py-3 align-top max-md:block max-md:p-0">
                    <b className="font-bold">{LABELS[r.template] ?? r.template}</b>
                    {(camper || cls) && <span className="block text-sm text-ink-muted">{[camper, cls].filter(Boolean).join(' · ')}</span>}
                  </td>
                  <td className="px-3 py-3 align-top break-words max-md:block max-md:p-0 max-md:pt-1">
                    <span className={mobileLabel}>To </span>{r.recipient_email ?? <span className="text-ink-muted">No address</span>}
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap max-md:block max-md:p-0">
                    <span className={mobileLabel}>Queued </span>{when(r.created_at)}
                  </td>
                  <td className="px-3 py-3 align-top max-md:block max-md:p-0 max-md:pt-2">
                    <Status status={r.status} />
                    {r.last_error && (
                      <span className={`block mt-1 text-sm text-pretty ${r.status === 'failed' ? 'font-bold text-danger' : 'text-ink-muted'}`}>{r.last_error}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
