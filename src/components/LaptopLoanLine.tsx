import { useEffect, useRef, useState } from 'react'
import { Laptop } from 'lucide-react'
import InlineConfirm from './InlineConfirm'
import { buttonClass } from '../lib/ui'
import { LAPTOP_DEVICES, LAPTOP_ON_SITE, laptopState } from '../lib/laptopLoans'
import { ErrorLine, StatusWord } from '../pages/parent/parts'
import type { Laptops } from '../hooks/useMyLaptops'

// One week's loaner laptop on the camper card (spec 29): "Laptop: Reserved / In the queue (#3) /
// Not needed", with Request, Release or Leave the queue inline until the week starts. Releasing
// gives the loaner to the next family, so it asks first, in place (no modal).
export default function LaptopLoanLine({ registrationId, camper, where, laptops }: {
  registrationId: string
  camper: string
  where: string
  laptops: Laptops
}) {
  const laptop = laptops.byRegistration.get(registrationId)
  const { word, tone, action } = laptopState(laptop)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Closing the confirm puts focus back on the action that opened it.
  const actionRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  useEffect(() => {
    if (!confirming && wasConfirming.current) actionRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn(); setConfirming(false) } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  const textBtn = buttonClass('text')
  const settled = laptop?.status === 'handed_out' || laptop?.status === 'returned'
  return (
    <div className="mt-2">
      <p aria-live="polite" className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-bold">
          <Laptop size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" /> Laptop:
        </span>
        <StatusWord tone={tone}>{word}</StatusWord>
      </p>

      {action === 'request' && (
        <>
          <p className="mt-1 text-sm text-ink-muted text-pretty max-w-[60ch]">
            Need to borrow one? {LAPTOP_DEVICES} {LAPTOP_ON_SITE}
          </p>
          <button ref={actionRef} type="button" disabled={busy} aria-busy={busy}
            onClick={() => { void run(() => laptops.request(registrationId)) }} className={textBtn}>
            {busy ? 'Asking…' : `Borrow a laptop for ${camper}`}
          </button>
        </>
      )}

      {(action === 'release' || action === 'leave') && !confirming && (
        <button ref={actionRef} type="button" onClick={() => { setConfirming(true); setErr(null) }} className={textBtn}>
          {action === 'release' ? 'Release the laptop' : 'Leave the laptop queue'}
        </button>
      )}
      {confirming && (
        <div className="mt-2">
          <InlineConfirm
            message={action === 'release'
              ? `Release ${camper}'s loaner laptop for ${where}? It goes to the next family in the laptop queue, and asking again later puts ${camper} at the back of it.`
              : `Take ${camper} out of the laptop queue for ${where}?`}
            confirmLabel={busy ? 'Releasing…' : action === 'release' ? 'Release laptop' : 'Leave the queue'}
            cancelLabel={action === 'release' ? 'Keep it' : 'Stay in it'}
            busy={busy}
            onConfirm={() => { void run(() => laptops.release(registrationId)) }}
            onCancel={() => { setConfirming(false); setErr(null) }}
          />
        </div>
      )}

      {laptop && !laptop.changes_open && !settled && (
        <p className="mt-1 text-sm text-ink-muted">Laptop changes for this week happen at check-in.</p>
      )}
      {err && <ErrorLine className="mt-2">{err}</ErrorLine>}
    </div>
  )
}
