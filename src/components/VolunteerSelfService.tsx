import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDayLong, localDateISO } from '../lib/campDay'
import { useVolunteerPrefs, weeksLabel, type VolunteerPrefs } from '../hooks/useVolunteerPrefs'
import InlineConfirm from './InlineConfirm'

// Volunteer self-service (spec 25, decided Q-V1: preferences + admin assigns, no self-pick), shown
// on My profile: week availability and course choices, "I can't make it" days, a switch request.
// Everything sits on the page (no cards): facts between hairlines, forms inline under their heading.
interface Absence { id: string; from_date: string; to_date: string; note: string | null }

const h2 = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-ink'
const hint = 'text-ink-muted text-pretty'
const input = 'ui-input'
const label = 'block font-bold text-ink mb-1.5'
const optional = <span className="font-normal text-ink-muted"> (optional)</span>
const formRow = 'flex flex-wrap items-center gap-x-6 gap-y-2 mt-5'
const cancelCls = 'ui-btn ui-btn--text text-ink-muted'

function fmt(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function ErrorLine({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p role="alert" className={`flex items-start gap-1.5 text-sm font-bold text-danger ${className}`}>
      <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{text}
    </p>
  )
}

function Done({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mt-3 flex items-start gap-1.5 font-bold text-success">
      <CircleCheck size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />{children}
    </p>
  )
}

// Read-only first, with an inline Edit (same pattern as ContactDetailsCard on the parent side).
export function PrefsSection() {
  const { prefs, courses, loading, error, save } = useVolunteerPrefs()
  const [form, setForm] = useState<VolunteerPrefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (loading) return <div className="h-32 bg-surface-sunken rounded animate-pulse" />
  if (!prefs) return error ? <ErrorLine text="Couldn't load your availability. Check your connection and reload the page." /> : null

  const set = (patch: Partial<VolunteerPrefs>) => { setErr(null); setForm(f => ({ ...(f ?? prefs), ...patch })) }
  const options = (keep: string | null) => [...new Set([...(keep ? [keep] : []), ...courses])]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.availability_week_1 && !form.availability_week_2) { setErr('Pick at least one week.'); return }
    setBusy(true); setErr(null)
    try { await save(form); setForm(null); setSaved(true) }
    catch { setErr("Couldn't save. Check your connection and try again.") }
    finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="prefs-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="prefs-heading" className={h2}>Availability and courses</h2>
        {!form && (
          <button type="button" onClick={() => { setForm(prefs); setSaved(false) }} className="ui-btn ui-btn--text">
            Edit<span className="sr-only"> availability and courses</span>
          </button>
        )}
      </div>
      <p className={hint}>Admins use these when they assign classes.</p>
      {!form ? (
        <>
          <dl className="mt-3 py-3 border-y border-border grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2">
            <dt className="text-ink-muted">Weeks</dt><dd className="font-bold text-ink">{weeksLabel(prefs)}</dd>
            <dt className="text-ink-muted">First choice</dt><dd className="font-bold text-ink">{prefs.course_first_choice || 'No preference'}</dd>
            <dt className="text-ink-muted">Second choice</dt><dd className="font-bold text-ink">{prefs.course_second_choice || 'No preference'}</dd>
          </dl>
          {saved && <Done>Availability saved</Done>}
        </>
      ) : (
        <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') setForm(null) }} className="mt-4">
          <fieldset>
            <legend className={label}>Weeks you can help</legend>
            <div className="grid gap-2 min-[480px]:grid-cols-2">
              {([1, 2] as const).map(w => {
                const key = w === 1 ? 'availability_week_1' : 'availability_week_2'
                return (
                  <label key={w} className="flex items-center gap-3 min-h-[52px] px-4 py-2 bg-surface border-2 border-border has-[:checked]:border-ink rounded font-bold text-ink cursor-pointer">
                    <input type="checkbox" className="w-[22px] h-[22px] shrink-0" checked={form[key]} onChange={e => set({ [key]: e.target.checked })} />
                    Week {w}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="grid gap-4 min-[480px]:grid-cols-2 mt-5">
            <div>
              <label htmlFor="pref-first" className={label}>First-choice course</label>
              <select id="pref-first" className={input} value={form.course_first_choice ?? ''} onChange={e => set({ course_first_choice: e.target.value || null })}>
                <option value="">No preference</option>
                {options(form.course_first_choice).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pref-second" className={label}>Second choice</label>
              <select id="pref-second" className={input} value={form.course_second_choice ?? ''} onChange={e => set({ course_second_choice: e.target.value || null })}>
                <option value="">No preference</option>
                {options(form.course_second_choice).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {err && <ErrorLine text={err} className="mt-3" />}
          <div className={formRow}>
            <button type="submit" disabled={busy} aria-busy={busy} className="ui-btn ui-btn--ink">{busy ? 'Saving…' : 'Save availability'}</button>
            <button type="button" onClick={() => { setForm(null); setErr(null) }} className={cancelCls}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  )
}

export function AbsenceSection({ userId, startOpen = false }: { userId: string; startOpen?: boolean }) {
  const [list, setList] = useState<Absence[] | null>(null)
  const [open, setOpen] = useState(startOpen)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const today = localDateISO()

  useEffect(() => {
    let alive = true
    supabase.from('crew_absences').select('id, from_date, to_date, note')
      .eq('volunteer_id', userId).gte('to_date', today).order('from_date')
      .then(({ data }) => { if (alive) setList((data ?? []) as Absence[]) })
    return () => { alive = false }
  }, [userId, today, version])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const end = to || from
    if (!from) { setErr('Pick the first day you can\'t make it.'); return }
    if (from < today) { setErr('Pick today or a later day.'); return }
    if (end < from) { setErr('The last day can\'t be before the first day.'); return }
    setBusy(true); setErr(null)
    const { error } = await supabase.from('crew_absences').insert({ volunteer_id: userId, from_date: from, to_date: end, note: note.trim() || null })
    setBusy(false)
    if (error) { setErr("Couldn't send it. Check your connection and try again."); return }
    setOpen(false); setFrom(''); setTo(''); setNote('')
    setVersion(v => v + 1)
  }

  async function remove(id: string) {
    setBusy(true)
    const { error } = await supabase.from('crew_absences').delete().eq('id', id)
    setBusy(false)
    if (error) { setErr("Couldn't remove it. Check your connection and try again."); return }
    setRemoving(null)
    setVersion(v => v + 1)
  }

  return (
    <section id="days-off" aria-labelledby="absence-heading" className="scroll-mt-16 md:scroll-mt-24">
      <h2 id="absence-heading" className={h2}>Days you can't make it</h2>
      <p className={hint}>Tell the camp early so they can find cover. Admins see it right away.</p>
      {list && list.length === 0 && !open && <p className="mt-3 text-ink">None added yet.</p>}
      {list && list.length > 0 && (
        <ul className="mt-3 border-y-2 border-ink">
          {list.map(a => {
            const when = a.from_date === a.to_date ? formatDayLong(a.from_date) : `${fmt(a.from_date)} to ${fmt(a.to_date)}`
            return (
              <li key={a.id} className="py-3 border-t border-border first:border-t-0">
                <div className="flex items-center justify-between gap-4">
                  <p className="min-w-0 text-ink">
                    <span className="block font-bold">{when}</span>
                    {a.note && <span className="block text-ink-muted text-pretty">{a.note}</span>}
                  </p>
                  {removing !== a.id && (
                    <button type="button" onClick={() => { setErr(null); setRemoving(a.id) }} className="ui-btn ui-btn--text shrink-0 text-danger">
                      Remove<span className="sr-only"> {when}</span>
                    </button>
                  )}
                </div>
                {removing === a.id && (
                  <div className="mt-3">
                    <InlineConfirm frame message="Remove this? The camp will count on you those days." confirmLabel="Remove" cancelLabel="Keep it"
                      busy={busy} onConfirm={() => { void remove(a.id) }} onCancel={() => setRemoving(null)} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {open ? (
        <form onSubmit={add} className="mt-4" noValidate>
          <div className="grid gap-4 min-[480px]:grid-cols-2">
            <div>
              <label htmlFor="abs-from" className={label}>First day</label>
              <input id="abs-from" type="date" min={today} className={input} value={from} onChange={e => setFrom(e.target.value)} autoFocus />
            </div>
            <div>
              <label htmlFor="abs-to" className={label}>Last day{optional}</label>
              <input id="abs-to" type="date" min={from || today} className={input} value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="abs-note" className={label}>Note for the camp{optional}</label>
            <input id="abs-note" maxLength={500} className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="Dentist in the morning" />
          </div>
          {err && <ErrorLine text={err} className="mt-3" />}
          <div className={formRow}>
            <button type="submit" disabled={busy} aria-busy={busy} className="ui-btn ui-btn--primary">{busy ? 'Sending…' : 'Tell the camp'}</button>
            <button type="button" onClick={() => { setOpen(false); setErr(null) }} className={cancelCls}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="ui-btn ui-btn--secondary mt-4">
          <Plus size={18} strokeWidth={2.25} aria-hidden="true" /> Add a day
        </button>
      )}
      {!open && err && <ErrorLine text={err} className="mt-3" />}
    </section>
  )
}

export function SwitchSection({ current }: { current: string | null }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('request_change', { p_registration_id: null, p_kind: 'crew_switch', p_message: message })
    setBusy(false)
    if (error) { setErr("Couldn't send it. Check your connection and try again."); return }
    setSent(true); setOpen(false); setMessage('')
  }

  return (
    <section aria-labelledby="switch-heading">
      <h2 id="switch-heading" className={h2}>Switch classes</h2>
      {sent ? (
        <Done>Request sent. An admin will reply by email.</Done>
      ) : (
        <>
          <p className={`${hint} mt-1`}>{current ? `You're in ${current}. ` : ''}Admins assign classes, but you can ask for a change.</p>
          {open ? (
            <form onSubmit={send} className="mt-4">
              <label htmlFor="switch-msg" className={label}>Which class would you like, and why?</label>
              <textarea id="switch-msg" rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} autoFocus className={input} />
              {err && <ErrorLine text={err} className="mt-3" />}
              <div className={formRow}>
                <button type="submit" disabled={busy || !message.trim()} aria-busy={busy} className="ui-btn ui-btn--ink">{busy ? 'Sending…' : 'Send request'}</button>
                <button type="button" onClick={() => { setOpen(false); setErr(null) }} className={cancelCls}>Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="ui-btn ui-btn--secondary mt-4">Ask to switch</button>
          )}
        </>
      )}
    </section>
  )
}
