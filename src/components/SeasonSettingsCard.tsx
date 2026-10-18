import { useEffect, useRef, useState } from 'react'
import { useSeasonSettings } from '../hooks/useSeasonSettings'
import { useFormConfigs } from '../hooks/useFormConfigs'
import { campInputToISO, isoToCampInput, formatCampDay, formatCampTime } from '../lib/denverTime'
import { registrationPhase } from '../lib/registrationStatus'
import { Input } from './Field'
import Button from './Button'
import InlineConfirm from './InlineConfirm'

const label = 'block font-bold mb-1.5'
const hint = 'mt-1.5 text-sm text-ink-muted text-pretty'

// Admin: the one place registration opens and closes (spec 13, issue #171). The on/off switch is
// the camper registration form's `enabled` flag; the opening time is this year's season settings.
// Parents can register only while the switch is on and the opening time (if any) has passed.
export default function SeasonSettingsCard({ year }: { year: number }) {
  const { settings, loading, error, save, refetch: refetchSettings } = useSeasonSettings(year)
  const { configs, loading: formsLoading, error: formsError, setFormEnabled, refetch: refetchForms } = useFormConfigs()
  const [form, setForm] = useState<{ opens: string; deadline: string; offer: string; final: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchErr, setSwitchErr] = useState<string | null>(null)

  // When the confirm closes (cancel, Escape or done), focus goes back to the switch, not the page.
  const switchRef = useRef<HTMLInputElement>(null)
  const refocus = useRef(false)
  useEffect(() => {
    if (refocus.current && !confirming && !switching) {
      refocus.current = false
      switchRef.current?.focus()
    }
  }, [confirming, switching])

  // The status reads the clock; a minute's tick keeps "opens" turning into "open since".
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const regForm = configs.find(c => c.form_key === 'student_registration')
  const enabled = regForm ? regForm.config.enabled !== false : true
  const opensAt = settings?.registration_opens_at ?? null
  const phase = registrationPhase(enabled, opensAt, now)
  const when = opensAt ? `${formatCampDay(opensAt)} at ${formatCampTime(opensAt)}` : ''
  const scheduledAhead = !!opensAt && new Date(opensAt).getTime() > now

  const status = enabled && error
    ? "On. The opening time couldn't be checked, so it may not be open yet."
    : phase === 'open'
    ? (opensAt ? `Open since ${when} (Denver time).` : 'Open now.')
    : phase === 'scheduled'
      ? `Opens by itself ${when} (Denver time).`
      : `Closed. Families can't register or join a waitlist.${scheduledAhead ? ` It won't open on ${when} until this is on.` : ''}`

  async function switchTo(next: boolean) {
    setSwitching(true); setSwitchErr(null)
    try {
      await setFormEnabled('student_registration', next)
      refocus.current = true
      setConfirming(false)
    } catch (e) {
      setSwitchErr(`Couldn't ${next ? 'open' : 'close'} registration: ${e instanceof Error ? e.message : 'unknown error'}. Try again.`)
    } finally {
      setSwitching(false)
    }
  }

  // Start editing from the loaded values once they arrive.
  const current = form ?? (settings ? {
    opens: isoToCampInput(settings.registration_opens_at),
    deadline: String(settings.change_deadline_days),
    offer: String(settings.offer_hours),
    final: String(settings.offer_hours_final_week),
  } : null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!current) return
    const nums = [current.deadline, current.offer, current.final].map(Number)
    if (nums.some(n => !Number.isInteger(n) || n < 0)) { setErr('Use whole numbers.'); return }
    if (nums[1] < 1 || nums[2] < 1) { setErr('Offer windows must be at least 1 hour.'); return }
    setSaving(true); setErr(null); setSaved(false)
    try {
      await save({
        registration_opens_at: campInputToISO(current.opens),
        change_deadline_days: nums[0],
        offer_hours: nums[1],
        offer_hours_final_week: nums[2],
      })
      setForm(null)
      setSaved(true)
    } catch (e2) {
      setErr(`Couldn't save the settings: ${e2 instanceof Error ? e2.message : 'unknown error'}. Try again.`)
    } finally {
      setSaving(false)
    }
  }

  const set = (k: 'opens' | 'deadline' | 'offer' | 'final', v: string) => { setSaved(false); setForm({ ...(current ?? { opens: '', deadline: '14', offer: '48', final: '12' }), [k]: v }) }

  return (
    <section aria-labelledby="registration-heading" className="pt-5 border-t-2 border-ink">
      <h2 id="registration-heading" className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em]">Registration</h2>

      {formsLoading ? (
        <div aria-hidden="true" className="mt-3 h-14 rounded bg-surface-sunken animate-pulse" />
      ) : formsError ? (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 min-h-14">
          <p title={formsError} className="flex-1 min-w-[16rem] font-bold text-danger text-pretty">
            Couldn't check whether registration is on. Check your connection, then try again.
          </p>
          <Button onClick={() => { void refetchForms() }}>Try again</Button>
        </div>
      ) : (
        <label htmlFor="registration-on" className="mt-2 flex items-center gap-4 min-h-14 cursor-pointer">
          <span className="flex-1 min-w-0">
            <span id="registration-on-label" className="block text-lg font-bold leading-[1.3]">Families can register</span>
            <span id="registration-status" className="block text-sm text-ink-muted text-pretty">{status}</span>
          </span>
          <input
            ref={switchRef}
            id="registration-on"
            type="checkbox"
            role="switch"
            className="ui-switch"
            aria-labelledby="registration-on-label"
            aria-describedby="registration-status"
            checked={enabled}
            disabled={switching || !regForm}
            onChange={e => { if (e.target.checked) void switchTo(true); else setConfirming(true) }}
          />
        </label>
      )}
      {!formsLoading && !formsError && !regForm && (
        <p role="alert" className="mt-2 text-sm font-bold text-danger">The registration form's settings are missing from the database, so it can't be switched here.</p>
      )}
      {confirming && (
        <div className="mt-3">
          <InlineConfirm
            frame
            message={phase === 'scheduled'
              ? `Turn registration off? It won't open on ${when} until you turn it on again.`
              : "Close registration now? Families can't register or join a waitlist until you open it again. Registrations already made stay as they are."}
            confirmLabel={phase === 'scheduled' ? 'Turn it off' : 'Close registration'}
            cancelLabel={phase === 'scheduled' ? 'Keep it on' : 'Keep it open'}
            busy={switching}
            onConfirm={() => { void switchTo(false) }}
            onCancel={() => { refocus.current = true; setConfirming(false) }}
          />
        </div>
      )}
      {switchErr && <p role="alert" className="mt-2 text-sm font-bold text-danger">{switchErr}</p>}

      {error && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p title={error} className="flex-1 min-w-[16rem] text-sm font-bold text-danger text-pretty">Couldn't load the opening time and deadlines. Check your connection, then try again.</p>
          <Button onClick={() => { void refetchSettings() }}>Try again</Button>
        </div>
      )}
      {error && !current ? null : loading || !current ? (
        <div aria-hidden="true" className="mt-6 h-48 rounded bg-surface-sunken animate-pulse" />
      ) : (
        <form onSubmit={submit} aria-label="Registration settings" className="mt-6 max-w-[640px] space-y-5">
          <div>
            <label htmlFor="season-opens" className={label}>Opening time (Denver)</label>
            <Input id="season-opens" type="datetime-local" className="max-w-[320px]" aria-describedby="season-opens-hint"
              value={current.opens} onChange={e => set('opens', e.target.value)} />
            <p id="season-opens-hint" className={hint}>While the switch is on, registration opens by itself at this time. Leave it empty to open it with the switch alone.</p>
          </div>
          <div>
            <label htmlFor="season-deadline" className={label}>Change deadline</label>
            <div className="flex items-center gap-3">
              <Input id="season-deadline" type="number" inputMode="numeric" min={0} max={120} className="max-w-[112px]" aria-describedby="season-deadline-unit season-deadline-hint"
                value={current.deadline} onChange={e => set('deadline', e.target.value)} />
              <span id="season-deadline-unit" className="text-ink-muted">days before the week starts</span>
            </div>
            <p id="season-deadline-hint" className={hint}>Until then, parents cancel or switch classes themselves. After it, they send a change request.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="season-offer" className={label}>Waitlist offer window</label>
              <div className="flex items-center gap-3">
                <Input id="season-offer" type="number" inputMode="numeric" min={1} max={336} className="max-w-[112px]" aria-describedby="season-offer-unit"
                  value={current.offer} onChange={e => set('offer', e.target.value)} />
                <span id="season-offer-unit" className="text-ink-muted">hours</span>
              </div>
            </div>
            <div>
              <label htmlFor="season-final" className={label}>Offer window in the final week</label>
              <div className="flex items-center gap-3">
                <Input id="season-final" type="number" inputMode="numeric" min={1} max={336} className="max-w-[112px]" aria-describedby="season-final-unit"
                  value={current.final} onChange={e => set('final', e.target.value)} />
                <span id="season-final-unit" className="text-ink-muted">hours</span>
              </div>
            </div>
          </div>
          {err && <p role="alert" className="text-sm font-bold text-danger">{err}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={saving || form === null}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
            {saved
              ? <span role="status" className="text-sm font-bold text-success">Saved</span>
              : form === null && <span className="text-sm text-ink-muted">Nothing changed yet.</span>}
          </div>
        </form>
      )}
    </section>
  )
}
