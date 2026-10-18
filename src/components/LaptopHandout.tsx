import { useState } from 'react'
import { h2Class } from './AdminPageHead'
import { useLaptopHandout, type HandoutLoan } from '../hooks/useAdminLaptops'

// The camp-day hand-out checklist (spec 29): each section's loaner laptops, ticked as they're
// handed out. Unticking undoes a mistaken tick. Loaners stay at camp; the queue is only counted.
export default function LaptopHandout({ sessionId, sections }: {
  sessionId: string
  sections: { id: string; label: string; className: string }[]
}) {
  const { loans, error, setHandedOut } = useLaptopHandout(sessionId)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null)

  const lent = loans.filter(l => l.status === 'reserved' || l.status === 'handed_out')
  const queued = loans.filter(l => l.status === 'queued').length
  if (!error && loans.length === 0) return null
  const groups = sections
    .map(s => ({ ...s, loans: loans.filter(l => l.section_id === s.id && l.status !== 'queued') }))
    .filter(g => g.loans.length > 0)

  async function toggle(l: HandoutLoan, on: boolean) {
    setBusy(l.registration_id); setFailed(null)
    try { await setHandedOut(l.registration_id, on) }
    catch (e) { setFailed({ id: l.registration_id, message: e instanceof Error ? e.message : 'Something went wrong' }) }
    finally { setBusy(null) }
  }

  return (
    <section aria-labelledby="laptops-heading" className="mt-10">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="laptops-heading" className={h2Class}>Loaner laptops</h2>
        <span className="text-sm text-ink-muted tabular-nums">
          {lent.filter(l => l.status === 'handed_out').length} of {lent.length} handed out{queued > 0 ? ` · ${queued} in the queue` : ''}
        </span>
      </div>
      {error && <p role="alert" className="mt-2 font-bold text-danger text-pretty">Couldn't load the loaner laptops. Refresh the page to try again.</p>}
      {groups.length > 0 && (
        <div className="mt-3 border-y-2 border-ink">
          {groups.map(g => (
            <div key={g.id} className="py-3 border-t border-border first:border-t-0">
              <h3 className="text-lg font-extrabold tracking-[0.02em]">{g.label} <span className="font-normal tracking-normal text-base text-ink-muted">· {g.className}</span></h3>
              <ul>
                {g.loans.map(l => (
                  <li key={l.registration_id}>
                    <label className="flex items-center gap-3 min-h-11 py-1 cursor-pointer has-[input:disabled]:cursor-not-allowed">
                      <input type="checkbox" className="w-6 h-6 shrink-0" checked={l.status === 'handed_out'}
                        disabled={busy === l.registration_id || l.status === 'returned'} aria-busy={busy === l.registration_id}
                        onChange={e => { void toggle(l, e.target.checked) }} />
                      <span className="flex-1 min-w-0 [overflow-wrap:anywhere]"><span className="sr-only">Handed out: </span>{l.full_name}</span>
                      <span className="text-sm text-ink-muted whitespace-nowrap">
                        {l.status === 'handed_out' ? 'Handed out' : l.status === 'returned' ? 'Returned' : 'To hand out'}
                      </span>
                    </label>
                    {failed?.id === l.registration_id && <p role="alert" className="text-sm font-bold text-danger text-pretty">{failed.message}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
