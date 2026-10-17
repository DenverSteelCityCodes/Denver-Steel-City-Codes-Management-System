import { useState } from 'react'
import { Check, CalendarClock } from 'lucide-react'
import { useSeasonSettings } from '../hooks/useSeasonSettings'
import { campInputToISO, isoToCampInput, formatCampDateTime } from '../lib/denverTime'

// Admin: one camp year's registration settings (spec 13), inline on the Sessions page.
export default function SeasonSettingsCard({ year }: { year: number }) {
  const { settings, loading, error, save } = useSeasonSettings(year)
  const [form, setForm] = useState<{ opens: string; deadline: string; offer: string; final: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full h-10 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand'
  const label = 'block font-sans text-xs font-semibold text-ink-muted mb-1'
  const set = (k: 'opens' | 'deadline' | 'offer' | 'final', v: string) => { setSaved(false); setForm({ ...(current ?? { opens: '', deadline: '14', offer: '48', final: '12' }), [k]: v }) }

  return (
    <section aria-labelledby="season-settings-heading" className="bg-surface border border-border rounded-[14px] p-4 sm:p-5">
      <h2 id="season-settings-heading" className="font-sans font-semibold text-ink flex items-center gap-2">
        <CalendarClock size={16} /> {year} registration settings
      </h2>
      <p className="font-sans text-sm text-ink-muted mt-0.5 mb-4">
        {settings?.registration_opens_at
          ? `Registration opens ${formatCampDateTime(settings.registration_opens_at)} (Denver time). Sign-ups before then are refused.`
          : 'No opening time is set, so registration follows the Forms on/off switch.'}
      </p>
      {error && <p role="alert" className="font-sans text-sm text-danger mb-3">⚠ {error}</p>}
      {loading || !current ? (
        <div className="h-24 bg-surface-sunken rounded-[10px] animate-pulse" />
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="season-opens" className={label}>Registration opens (Denver time)</label>
              <input id="season-opens" type="datetime-local" className={input} value={current.opens} onChange={e => set('opens', e.target.value)} />
              <p className="mt-1 font-sans text-xs text-ink-faint">Leave empty for no scheduled opening.</p>
            </div>
            <div>
              <label htmlFor="season-deadline" className={label}>Parents can cancel or switch until (days before a session)</label>
              <input id="season-deadline" type="number" min={0} max={120} className={input} value={current.deadline} onChange={e => set('deadline', e.target.value)} />
            </div>
            <div>
              <label htmlFor="season-offer" className={label}>Waitlist offer lasts (hours)</label>
              <input id="season-offer" type="number" min={1} max={336} className={input} value={current.offer} onChange={e => set('offer', e.target.value)} />
            </div>
            <div>
              <label htmlFor="season-final" className={label}>…in the week before camp (hours)</label>
              <input id="season-final" type="number" min={1} max={336} className={input} value={current.final} onChange={e => set('final', e.target.value)} />
            </div>
          </div>
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          <div className="flex items-center justify-end gap-3">
            {saved && <span role="status" className="font-sans text-sm text-success">Saved</span>}
            <button type="submit" disabled={saving || form === null}
              className="h-10 px-4 rounded-[8px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm flex items-center gap-1.5 transition disabled:opacity-50">
              <Check size={15} /> {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
