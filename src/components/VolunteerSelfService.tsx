import { useEffect, useState } from 'react'
import { CalendarX, Check, Repeat, SlidersHorizontal, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDateISO } from '../lib/campDay'
import InlineConfirm from './InlineConfirm'

// Volunteer self-service (spec 25, decided Q-V1: preferences + admin assigns, no self-pick):
// week availability and course choices, "I can't make it" dates, and a switch request.
interface Prefs { availability_week_1: boolean; availability_week_2: boolean; course_first_choice: string | null; course_second_choice: string | null }
interface Absence { id: string; from_date: string; to_date: string; note: string | null }

const card = 'bg-surface border border-border rounded-xl shadow-sm p-4 sm:p-5'
const heading = 'font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted flex items-center gap-1.5'
const input = 'w-full h-10 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand'
const label = 'block font-sans text-xs font-semibold text-ink-muted mb-1'
const primary = 'h-10 px-4 rounded-[8px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm transition disabled:opacity-50'
const secondary = 'h-10 px-4 rounded-[8px] border border-border-strong bg-surface text-ink font-sans font-semibold text-sm hover:bg-surface-sunken transition'

function fmt(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function VolunteerSelfService({ userId }: { userId: string }) {
  return (
    <div className="space-y-4">
      <PrefsCard />
      <AbsenceCard userId={userId} />
      <SwitchCard />
    </div>
  )
}

function PrefsCard() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [form, setForm] = useState<Prefs | null>(null)
  const [courses, setCourses] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    void Promise.all([
      supabase.rpc('my_volunteer_prefs'),
      supabase.rpc('course_names'),
    ]).then(([p, c]) => {
      if (!alive) return
      const row = ((p.data ?? []) as Prefs[])[0] ?? null
      setPrefs(row)
      setCourses((c.data ?? []) as string[])
    })
    return () => { alive = false }
  }, [])

  if (!prefs) return null
  const cur = form ?? prefs
  const set = (patch: Partial<Prefs>) => { setSaved(false); setErr(null); setForm({ ...cur, ...patch }) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('update_my_volunteer_prefs', {
      p_week1: cur.availability_week_1, p_week2: cur.availability_week_2,
      p_first: cur.course_first_choice ?? '', p_second: cur.course_second_choice ?? '',
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setPrefs(cur); setForm(null); setSaved(true)
  }

  const options = (keep: string | null) => [...new Set([...(keep ? [keep] : []), ...courses])]
  return (
    <section aria-labelledby="prefs-heading" className={card}>
      <h2 id="prefs-heading" className={heading}><SlidersHorizontal size={13} aria-hidden="true" /> My preferences</h2>
      <p className="font-sans text-sm text-ink-muted mt-1 mb-3">The camp uses these when assigning crews. Your section is set by an admin.</p>
      <form onSubmit={save} className="space-y-3">
        <fieldset>
          <legend className={label}>Weeks I can help</legend>
          <div className="flex flex-wrap gap-4">
            {([1, 2] as const).map(w => {
              const key = w === 1 ? 'availability_week_1' : 'availability_week_2'
              return (
                <label key={w} className="flex items-center gap-2 font-sans text-sm text-ink min-h-6">
                  <input type="checkbox" className="w-4 h-4 accent-brand" checked={cur[key]} onChange={e => set({ [key]: e.target.checked })} />
                  Week {w}
                </label>
              )
            })}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pref-first" className={label}>First-choice course</label>
            <select id="pref-first" className={input} value={cur.course_first_choice ?? ''} onChange={e => set({ course_first_choice: e.target.value || null })}>
              <option value="">No preference</option>
              {options(cur.course_first_choice).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pref-second" className={label}>Second choice</label>
            <select id="pref-second" className={input} value={cur.course_second_choice ?? ''} onChange={e => set({ course_second_choice: e.target.value || null })}>
              <option value="">No preference</option>
              {options(cur.course_second_choice).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
        <div className="flex items-center justify-end gap-3">
          {saved && <span role="status" className="font-sans text-sm text-success">Saved</span>}
          <button type="submit" disabled={busy || !form} className={`${primary} flex items-center gap-1.5`}>
            <Check size={15} aria-hidden="true" /> {busy ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </form>
    </section>
  )
}

function AbsenceCard({ userId }: { userId: string }) {
  const [list, setList] = useState<Absence[] | null>(null)
  const [open, setOpen] = useState(false)
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
    <section aria-labelledby="absence-heading" className={card}>
      <h2 id="absence-heading" className={heading}><CalendarX size={13} aria-hidden="true" /> Days I can't make it</h2>
      <p className="font-sans text-sm text-ink-muted mt-1 mb-3">Let the camp know early so they can find cover. Admins see it right away.</p>
      {list && list.length > 0 && (
        <ul className="divide-y divide-border mb-3 border border-border rounded-[10px] overflow-hidden">
          {list.map(a => (
            <li key={a.id}>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <p className="font-sans text-sm text-ink">
                  {a.from_date === a.to_date ? fmt(a.from_date) : `${fmt(a.from_date)} – ${fmt(a.to_date)}`}
                  {a.note && <span className="text-ink-muted"> · {a.note}</span>}
                </p>
                {removing !== a.id && (
                  <button type="button" onClick={() => setRemoving(a.id)} aria-label={`Remove ${fmt(a.from_date)}`}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] text-ink-muted hover:text-danger hover:bg-danger-soft transition">
                    <Trash2 size={15} aria-hidden="true" />
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
        <form onSubmit={add} className="space-y-3" noValidate>
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label htmlFor="abs-from" className={label}>First day</label>
              <input id="abs-from" type="date" min={today} className={input} value={from} onChange={e => setFrom(e.target.value)} autoFocus />
            </div>
            <div>
              <label htmlFor="abs-to" className={label}>Last day (if more than one)</label>
              <input id="abs-to" type="date" min={from || today} className={input} value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="abs-note" className={label}>Note for the camp (optional)</label>
            <input id="abs-note" maxLength={500} className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Dentist in the morning" />
          </div>
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setOpen(false); setErr(null) }} className={secondary}>Cancel</button>
            <button type="submit" disabled={busy} className={primary}>{busy ? 'Sending…' : 'Tell the camp'}</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={secondary}>I can't make it…</button>
      )}
      {!open && err && <p role="alert" className="mt-2 font-sans text-sm text-danger">{err}</p>}
    </section>
  )
}

function SwitchCard() {
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
    <section aria-labelledby="switch-heading" className={card}>
      <h2 id="switch-heading" className={heading}><Repeat size={13} aria-hidden="true" /> Switch section</h2>
      {sent ? (
        <p role="status" className="font-sans text-sm text-ink mt-2">Request sent. An admin will get back to you by email.</p>
      ) : open ? (
        <form onSubmit={send} className="mt-2 space-y-2">
          <label htmlFor="switch-msg" className={label}>Which section would you like, and why?</label>
          <textarea id="switch-msg" rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} autoFocus
            className="w-full px-3 py-2 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setOpen(false); setErr(null) }} className={secondary}>Cancel</button>
            <button type="submit" disabled={busy || !message.trim()} className={primary}>{busy ? 'Sending…' : 'Send to the camp'}</button>
          </div>
        </form>
      ) : (
        <>
          <p className="font-sans text-sm text-ink-muted mt-1 mb-3">Admins assign sections. If you'd like a different one, ask here.</p>
          <button type="button" onClick={() => setOpen(true)} className={secondary}>Request a switch…</button>
        </>
      )}
    </section>
  )
}
