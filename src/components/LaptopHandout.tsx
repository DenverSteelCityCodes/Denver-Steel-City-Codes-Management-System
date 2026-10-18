import { useState } from 'react'
import { h2Class } from './AdminPageHead'
import InlineConfirm from './InlineConfirm'
import { buttonClass } from '../lib/ui'
import { useLaptopHandout, type HandoutLoan } from '../hooks/useAdminLaptops'

// The camp-day hand-out checklist (spec 29): each section's loaner laptops, ticked as they're
// handed out. Unticking undoes a mistaken tick; Returned frees the loaner for the queue (asked
// first, since it can email the next family). A queued camper can be ticked when there's a spare.
// Once a camper's spot is cancelled, their handed-out laptop can only be marked returned.
const order = (l: HandoutLoan) => (l.status === 'queued' ? 1 : 0)
const word = (l: HandoutLoan) => ({
  reserved: 'To hand out', queued: 'In the queue', handed_out: 'Handed out', returned: 'Returned', released: 'Released',
}[l.status] + (l.holds_seat ? '' : ', spot cancelled'))

export default function LaptopHandout({ sessionId, sections }: {
  sessionId: string
  sections: { id: string; label: string; className: string }[]
}) {
  const { loans, error, setStatus } = useLaptopHandout(sessionId)
  const [busy, setBusy] = useState<string | null>(null)
  const [returning, setReturning] = useState<string | null>(null)
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null)

  const lent = loans.filter(l => l.status === 'reserved' || l.status === 'handed_out')
  const queued = loans.filter(l => l.status === 'queued').length
  if (!error && loans.length === 0) return null
  const groups = sections
    .map(s => ({ ...s, loans: loans.filter(l => l.section_id === s.id).sort((a, b) => order(a) - order(b)) }))
    .filter(g => g.loans.length > 0)

  async function run(l: HandoutLoan, status: 'handed_out' | 'reserved' | 'returned') {
    setBusy(l.registration_id); setFailed(null)
    try { await setStatus(l.registration_id, status); setReturning(null) }
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
                {g.loans.map(l => {
                  const out = l.status === 'handed_out'
                  // Ticking needs a spot; unticking needs one too (the database refuses otherwise).
                  const canToggle = l.holds_seat && l.status !== 'released'
                  return (
                    <li key={l.registration_id} className="flex flex-wrap items-center gap-x-4">
                      <label className="flex flex-1 min-w-[min(100%,16rem)] items-center gap-3 min-h-11 py-1 cursor-pointer has-[input:disabled]:cursor-not-allowed">
                        <input type="checkbox" className="w-6 h-6 shrink-0" checked={out}
                          disabled={!canToggle || busy === l.registration_id} aria-busy={busy === l.registration_id}
                          onChange={e => { void run(l, e.target.checked ? 'handed_out' : 'reserved') }} />
                        <span className="flex-1 min-w-0 [overflow-wrap:anywhere]"><span className="sr-only">Handed out: </span>{l.full_name}</span>
                        <span className="text-sm text-ink-muted">{word(l)}</span>
                      </label>
                      {out && returning !== l.registration_id && (
                        <button type="button" className={buttonClass('text', 'text-sm')} disabled={busy === l.registration_id}
                          onClick={() => { setReturning(l.registration_id); setFailed(null) }}>
                          Returned<span className="sr-only">: {l.full_name}'s laptop</span>
                        </button>
                      )}
                      {returning === l.registration_id && (
                        <div className="basis-full mb-2">
                          <InlineConfirm tone="neutral"
                            message={`Mark ${l.full_name}'s laptop returned? ${queued > 0 ? 'It goes to the next camper in the laptop queue, and their family gets an email.' : 'It goes back to the camp for this week.'}`}
                            confirmLabel={busy === l.registration_id ? 'Saving…' : 'Mark returned'} cancelLabel="Not yet" busy={busy === l.registration_id}
                            onConfirm={() => { void run(l, 'returned') }} onCancel={() => setReturning(null)} />
                        </div>
                      )}
                      {failed?.id === l.registration_id && <p role="alert" className="basis-full text-sm font-bold text-danger text-pretty">{failed.message}</p>}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
