import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDayLong, localDateISO } from '../lib/campDay'
import { useVolunteerPrefs, weeksLabel, type VolunteerPrefs } from '../hooks/useVolunteerPrefs'
import InlineConfirm from './InlineConfirm'

// Volunteer self-service (spec 25, decided Q-V1: preferences + admin assigns, no self-pick), shown
// on My profile: week availability and course choices, "I can't make it" days, a switch request.
interface Absence { id: string; from_date: string; to_date: string; note: string | null }

const panel = 'bg-surface border border-border rounded-[14px] p-4'
const h2 = 'font-sans font-bold text-lg text-ink'
const hint = 'font-sans text-[15px] text-ink-muted'
// 16px so iOS Safari doesn't zoom the page when the field is focused.
const input = 'w-full h-11 px-3 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-base focus:outline-none focus:ring-2 focus:ring-brand'
const label = 'block font-sans text-sm font-semibold text-ink-muted mb-1'
const primary = 'h-11 px-4 rounded-[10px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-[15px] inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50'
const secondary = 'h-11 px-4 rounded-[10px] border border-border-strong bg-surface text-ink font-sans font-semibold text-[15px] inline-flex items-center justify-center gap-1.5 hover:bg-surface-sunken transition'

function fmt(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Read-only first, with an inline Edit (same pattern as ContactDetailsCard on the parent side).
export function PrefsSection() {
  const { prefs, courses, loading, error, save } = useVolunteerPrefs()
  const [form, setForm] = useState<VolunteerPrefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (loading) return <div className="h-32 bg-surface-sunken rounded-[14px] animate-pulse" />
  if (!prefs) return error ? <p role="alert" className="font-sans text-sm text-danger">{error}</p> : null

  const set = (patch: Partial<VolunteerPrefs>) => { setErr(null); setForm(f => ({ ...(f ?? prefs), ...patch })) }
  const options = (keep: string | null) => [...new Set([...(keep ? [keep] : []), ...courses])]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.availability_week_1 && !form.availability_week_2) { setErr('Pick at least one week.'); return }
    setBusy(true); setErr(null)
    try { await save(form); setForm(null); setSaved(true) }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : "Couldn't save — check your connection and try again") }
    finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="prefs-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="prefs-heading" className={h2}>Availability and courses</h2>
        {!form && (
          <button type="button" onClick={() => { setForm(prefs); setSaved(false) }}
            className="h-11 px-3 rounded-[10px] font-sans font-semibold text-[15px] text-ink-muted hover:bg-surface-sunken hover:text-ink inline-flex items-center gap-1.5 transition">
            <Pencil size={15} /> Edit
          </button>
        )}
      </div>
      <p className={`${hint} mb-3`}>Admins use these when they assign classes. Your class is set by an admin.</p>
      {!form ? (
        <>
          <dl className={`${panel} grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 font-sans text-base`}>
            <dt className="text-ink-muted">Weeks</dt><dd className="font-semibold text-ink">{weeksLabel(prefs)}</dd>
            <dt className="text-ink-muted">First choice</dt><dd className="font-semibold text-ink">{prefs.course_first_choice || 'No preference'}</dd>
            <dt className="text-ink-muted">Second choice</dt><dd className="font-semibold text-ink">{prefs.course_second_choice || 'No preference'}</dd>
          </dl>
          {saved && <p role="status" className="mt-2 font-sans text-[15px] font-semibold text-success inline-flex items-center gap-1.5"><Check size={16} /> Availability saved</p>}
        </>
      ) : (
        <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') setForm(null) }} className={`${panel} space-y-4`}>
          <fieldset>
            <legend className={label}>Weeks you can help</legend>
            <div className="flex flex-wrap gap-2">
              {([1, 2] as const).map(w => {
                const key = w === 1 ? 'availability_week_1' : 'availability_week_2'
                return (
                  <label key={w} className="h-11 px-3.5 flex items-center gap-2 rounded-[10px] border border-border-strong bg-surface font-sans text-[15px] font-semibold text-ink cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 accent-brand" checked={form[key]} onChange={e => set({ [key]: e.target.checked })} />
                    Week {w}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
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
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setForm(null); setErr(null) }} className={secondary}>Cancel</button>
            <button type="submit" disabled={busy} className={primary}><Check size={15} aria-hidden="true" /> {busy ? 'Saving…' : 'Save availability'}</button>
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
    if (error) { setErr(error.message); return }
    setOpen(false); setFrom(''); setTo(''); setNote('')
    setVersion(v => v + 1)
  }

  async function remove(id: string) {
    setBusy(true)
    const { error } = await supabase.from('crew_absences').delete().eq('id', id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setRemoving(null)
    setVersion(v => v + 1)
  }

  return (
    <section id="days-off" aria-labelledby="absence-heading" className="scroll-mt-16">
      <h2 id="absence-heading" className={h2}>Days you can't make it</h2>
      <p className={`${hint} mb-3`}>Tell the camp early so they can find cover. Admins see it right away.</p>
      {list && list.length > 0 && (
        <ul className="bg-surface border border-border rounded-[14px] overflow-hidden mb-3">
          {list.map(a => (
            <li key={a.id} className="border-b border-border last:border-0">
              <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-2">
                <p className="font-sans text-base text-ink min-w-0">
                  <span className="font-semibold">{a.from_date === a.to_date ? formatDayLong(a.from_date) : `${fmt(a.from_date)} to ${fmt(a.to_date)}`}</span>
                  {a.note && <span className="block text-sm text-ink-muted">{a.note}</span>}
                </p>
                {removing !== a.id && (
                  <button type="button" onClick={() => setRemoving(a.id)} aria-label={`Remove ${fmt(a.from_date)}`}
                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-[10px] text-ink-muted hover:text-danger hover:bg-danger-soft transition">
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
              {removing === a.id && (
                <InlineConfirm message="Remove this? The camp will count on you those days." confirmLabel="Remove" cancelLabel="Keep it"
                  busy={busy} onConfirm={() => { void remove(a.id) }} onCancel={() => setRemoving(null)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form onSubmit={add} className={`${panel} space-y-3`} noValidate>
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label htmlFor="abs-from" className={label}>First day</label>
              <input id="abs-from" type="date" min={today} className={input} value={from} onChange={e => setFrom(e.target.value)} autoFocus />
            </div>
            <div>
              <label htmlFor="abs-to" className={label}>Last day (optional)</label>
              <input id="abs-to" type="date" min={from || today} className={input} value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="abs-note" className={label}>Note for the camp (optional)</label>
            <input id="abs-note" maxLength={500} className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="Dentist in the morning" />
          </div>
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setOpen(false); setErr(null) }} className={secondary}>Cancel</button>
            <button type="submit" disabled={busy} className={primary}>{busy ? 'Sending…' : 'Tell the camp'}</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={secondary}><Plus size={16} /> Add a day</button>
      )}
      {!open && err && <p role="alert" className="mt-2 font-sans text-sm text-danger">{err}</p>}
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
    if (error) { setErr(error.message); return }
    setSent(true); setOpen(false); setMessage('')
  }

  return (
    <section aria-labelledby="switch-heading">
      <h2 id="switch-heading" className={h2}>Switch classes</h2>
      {sent ? (
        <p role="status" className="mt-1 font-sans text-[15px] font-semibold text-success inline-flex items-center gap-1.5"><Check size={16} /> Request sent. An admin will reply by email.</p>
      ) : open ? (
        <form onSubmit={send} className={`${panel} mt-2 space-y-3`}>
          <div>
            <label htmlFor="switch-msg" className={label}>Which class would you like, and why?</label>
            <textarea id="switch-msg" rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} autoFocus
              className="w-full px-3 py-2.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-base focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setOpen(false); setErr(null) }} className={secondary}>Cancel</button>
            <button type="submit" disabled={busy || !message.trim()} className={primary}>{busy ? 'Sending…' : 'Send request'}</button>
          </div>
        </form>
      ) : (
        <>
          <p className={`${hint} mb-3`}>{current ? `You're in ${current}. ` : ''}Admins assign classes, but you can ask for a change.</p>
          <button type="button" onClick={() => setOpen(true)} className={secondary}>Ask to switch</button>
        </>
      )}
    </section>
  )
}
