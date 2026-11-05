import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from './Button'
import { Input, Select } from './Field'
import Segmented from './Segmented'
import InlineConfirm from './InlineConfirm'
import { campSessions, useSessions } from '../hooks/useSessions'
import { useVolunteers } from '../hooks/useVolunteers'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import { guardedUpdate } from '../lib/editConflict'
import { staffingStatus } from '../lib/staffing'
import { supabase } from '../lib/supabase'
import type { AdminStaffing, StaffingPerson, WeekRoleKind } from '../types/database'

const heading = 'text-xl font-bold mt-8 mb-3'
const link = 'inline-flex min-h-11 items-center font-bold underline underline-offset-4'
const roleName = { admin_room: 'Admin room', floater: 'Floater' }

export default function StaffingBoard() {
  const outlet = useAdminOutlet()
  const { sessions, loading: sessionsLoading, error: sessionError, refetch: refetchSessions } = useSessions()
  const { volunteers, crewError, refetch: refetchVolunteers } = useVolunteers()
  const crewAlert = useRef<HTMLParagraphElement>(null)
  const crewOf = new Map(volunteers.map(v => [v.id, v]))
  useEffect(() => { if (crewError) crewAlert.current?.focus() }, [crewError])
  const weeks = campSessions(sessions)
  const [params, setParams] = useSearchParams()
  const session = weeks.find(s => s.id === params.get('session')) ?? weeks[0]
  const [board, setBoard] = useState<AdminStaffing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const alert = useRef<HTMLParagraphElement>(null)
  const sessionId = session?.id
  const refresh = useCallback(() => setRevision(n => n + 1), [])

  useEffect(() => {
    if (!sessionId) return
    let alive = true
    void supabase.rpc('admin_staffing', { p_session_id: sessionId }).then(({ data, error }) => {
      if (!alive) return
      if (error) setError(error.message)
      if (!error) setBoard(data as AdminStaffing)
    })
    return () => { alive = false }
  }, [sessionId, revision])
  useEffect(() => { if (error || sessionError) alert.current?.focus() }, [error, sessionError])

  async function mutate(action: () => PromiseLike<{ error: { message: string } | null }>) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const { error } = await action()
      if (error) throw new Error(error.message)
      refresh()
      // The To do queue counts short sections and unassigned volunteers: reload it with the board.
      outlet?.refreshAttention()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save staffing'); refresh() }
    finally { setBusy(false) }
  }

  const current = board?.session_id === sessionId ? board : null
  return <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 className="font-display text-[1.75rem] font-bold">Staffing</h1>
    <p className="text-ink-muted mt-2">Planned crew for each week. Assignments stay in your hands.</p>
    {weeks.length > 0 && <Segmented className="mt-5" label="Staffing week" value={sessionId ?? ''}
      options={weeks.map((s, i) => ({ value: s.id, label: `Week ${i + 1}` }))} disabled={busy}
      onChange={id => { setError(null); setParams({ tab: 'staffing', session: id }) }} />}
    {(error || sessionError) && <p ref={alert} tabIndex={-1} role="alert" className="text-danger font-bold mt-4 text-pretty focus:outline-none">{error || sessionError} <Button onClick={() => { setError(null); refresh(); void refetchSessions() }}>Retry</Button></p>}
    {crewError && <p ref={crewAlert} tabIndex={-1} role="alert" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-bold text-danger text-pretty focus:outline-none"><span className="flex-1 min-w-[16rem]" title={crewError}>Couldn't check who can take a week role.</span><Button onClick={() => { void refetchVolunteers() }}>Retry</Button></p>}
    {!sessionsLoading && !session && <p className="mt-5">Create a camp week in Setup to plan staffing.</p>}
    {session && !current && !error && <p role="status" className="mt-5">Loading staffing…</p>}
    {current && session && <>
      <form key={`${sessionId}-${current.target}-${current.min_crew}`} className="mt-6 border-y-2 border-ink py-5" onSubmit={e => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        void mutate(() => supabase.from('season_settings').upsert({ year: session.year,
          target_campers_per_crew: Number(data.get('target')), min_crew_per_section: Number(data.get('minimum')) }, { onConflict: 'year' }))
      }}>
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <div><label htmlFor="staffing-target" className="block font-bold">Target campers per crew member</label>
            <Input id="staffing-target" name="target" type="number" min={1} max={20} required defaultValue={current.target} /></div>
          <div><label htmlFor="staffing-minimum" className="block font-bold">Minimum crew per section</label>
            <Input id="staffing-minimum" name="minimum" type="number" min={1} max={6} required defaultValue={current.min_crew} /></div>
        </div>
        <Button className="mt-4" type="submit" variant="primary" disabled={busy}>Save staffing targets</Button>
      </form>
      <label className="flex items-center gap-3 min-h-12 mt-4 font-bold">
        <input type="checkbox" className="w-5 h-5" checked={current.needs_teachers} disabled={busy}
          onChange={e => { const checked = e.target.checked; void mutate(() => supabase.from('sessions').update({ needs_teachers: checked }).eq('id', session.id)) }} />
        Week {current.week_number} still needs teachers (shown on Apply)
      </label>
      <p className="mt-5 text-lg font-bold">Seats could need {current.projected_need} crew; {current.available_accepted} accepted volunteers are available.</p>
      <p className="text-ink-muted">{current.crew_total} assigned crew including week roles. Week roles and duties do not improve a section’s ratio.</p>
      <h2 className={heading}>Sections</h2>
      <ul className="border-y-2 border-ink">
        {current.sections.map(s => {
          const status = staffingStatus(s.seated, s.crew, current.target, s.min_crew)
          return <li key={s.section_id} className={`py-4 px-3 border-t border-border first:border-0 ${status.tone === 'red' ? 'bg-danger-soft' : status.tone === 'amber' ? 'bg-warning-soft' : 'bg-success-soft'}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <Link className={link} to={`/admin/classes?open=${s.section_id}`}>{s.course} · {s.label}</Link>
            <span className={`font-bold ${status.tone === 'red' ? 'text-danger' : status.tone === 'amber' ? 'text-warning' : 'text-success'}`}>
              {status.tone === 'red' ? '⚠' : status.tone === 'amber' ? '△' : '✓'} {status.word}
            </span>
          </div>
          <p>{s.seated} / {s.capacity} campers · {s.waitlist} waitlisted · {s.crew} / {s.required} teachers needed</p>
          <p>{s.campers_per_crew === null ? 'No crew yet' : `${Number(s.campers_per_crew.toFixed(2))} campers per crew`} · target {current.target} · minimum {s.min_crew}</p>
          <p className="text-ink-muted">{s.room || 'No room set'} · {s.grade_low ? `Fall grades ${s.grade_low}–${s.grade_high}` : 'No seated grades yet'}{s.small && ' · Small section: minimum crew sets the need.'}</p>
        </li>})}
      </ul>
      {current.sections.length === 0 && <p>No sections in this week.</p>}
      <h2 className={heading}>Teachers per course</h2>
      <ul className="border-y-2 border-ink">{current.courses.map(c => <li className="py-3 border-t border-border first:border-0" key={c.class_id}>
        <p><b>{c.course}:</b> {c.assigned} of {c.required} teachers · {c.ranked_available} more available who ranked it</p>
        <Link className={link} to={`/admin/classes?open=${c.class_id}`}>Edit course minimum</Link>
      </li>)}</ul>
      <h2 className={heading}>Week roles · {current.week_roles.length}</h2>
      <ul>{current.week_roles.map(r => <li key={r.id} className="border-t border-border py-4">
        <p className="font-bold mb-3">{r.name} · {r.level}</p>
        <RoleForm id={r.id} initial={r} busy={busy} onSave={(role, note) => mutate(async () => {
          await guardedUpdate('week_roles', { id: r.id, updated_at: r.updated_at, role: r.role, note: r.note }, { role, note: note || null })
          return { error: null }
        })}
          onRemove={() => mutate(() => supabase.from('week_roles').delete().eq('id', r.id))} />
      </li>)}</ul>
      <details className="border-y-2 border-ink py-4 mt-3"><summary className="min-h-11 cursor-pointer font-bold">Add a week role</summary>
        <RoleForm key={sessionId} id="new" busy={busy} people={[...current.unassigned, ...current.duty_holders.filter(p => !current.week_roles.some(r => r.volunteer_id === p.volunteer_id))].map(p => {
          const row = crewOf.get(p.volunteer_id)
          return { ...p, block: row?.crew_known ? row.crew_block : null, unknown: row ? !row.crew_known : false }
        })}
          onSave={(role, note, volunteer_id) => mutate(() => supabase.from('week_roles').insert({ session_id: session.id, volunteer_id, role, note: note || null }))} />
      </details>
      <h2 className={heading} id="unassigned">Accepted, available this week, no section, week role or duty slot · {current.unassigned.length}</h2>
      <ul className="border-y-2 border-ink">{current.unassigned.map(p => <li key={p.volunteer_id} className="py-3 border-t border-border first:border-0">
        <b>{p.name}</b> · {p.level} · <Link to="/admin/classes" className={link}>Open crew editor</Link>
        {crewOf.get(p.volunteer_id)?.crew_block && <span className="block text-sm font-bold text-danger text-pretty">{crewOf.get(p.volunteer_id)?.crew_block}</span>}
        {crewOf.get(p.volunteer_id)?.crew_known === false && <span className="block text-sm font-bold text-danger text-pretty">Couldn't check yet.</span>}
      </li>)}</ul>
      {current.unassigned.length === 0 && <p className="mt-3">Everyone available has an assignment.</p>}
      <h2 className={heading}>Duty-slot holders without a section</h2>
      <ul className="border-y-2 border-ink">{current.duty_holders.map(p => <li key={p.volunteer_id} className="py-3 border-t border-border first:border-0"><b>{p.name}</b> · {p.duties.join(', ')}</li>)}</ul>
      {current.duty_holders.length === 0 && <p className="mt-3">No duty-only volunteers this week.</p>}
      <Link to="/admin/help#staffing" className={`${link} mt-5`}>How staffing colours work</Link>
    </>}
  </div>
}

function RoleForm({ id, initial, people, busy, onSave, onRemove }: {
  id: string; initial?: { role: WeekRoleKind; note: string | null }; people?: (StaffingPerson & { block?: string | null; unknown?: boolean })[]; busy: boolean
  onSave: (role: WeekRoleKind, note: string, volunteer?: string) => Promise<void>; onRemove?: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState(false)
  const remove = useRef<HTMLButtonElement>(null)
  return <>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget)
      void onSave(f.get('role') as WeekRoleKind, String(f.get('note') ?? '').trim(), String(f.get('volunteer') ?? ''))
    }}>
      {people && <div className="flex-[1_1_200px]"><label className="block font-bold" htmlFor={`${id}-person`}>Volunteer</label>
        <Select id={`${id}-person`} name="volunteer" required><option value="">Choose a volunteer</option>{people.map(p => <option key={p.volunteer_id} value={p.volunteer_id}>{p.unknown ? `${p.name} · Couldn't check yet` : p.block ? `${p.name} · ${p.block}` : p.name}</option>)}</Select></div>}
      <div className="flex-[1_1_150px]"><label className="block font-bold" htmlFor={`${id}-role`}>Role</label>
        <Select id={`${id}-role`} name="role" defaultValue={initial?.role ?? 'admin_room'}>{Object.entries(roleName).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></div>
      <div className="flex-[2_1_220px]"><label className="block font-bold" htmlFor={`${id}-note`}>Note (optional)</label>
        <Input id={`${id}-note`} name="note" maxLength={200} defaultValue={initial?.note ?? ''} /></div>
      <Button type="submit" disabled={busy}>{initial ? 'Save role' : 'Add role'}</Button>
      {onRemove && <Button ref={remove} variant="danger" disabled={busy} onClick={() => setConfirm(true)}>Remove</Button>}
    </form>
    {confirm && onRemove && <div className="mt-3"><InlineConfirm message="Remove this week role?" confirmLabel="Remove role" busy={busy}
      onConfirm={() => { void onRemove() }} onCancel={() => { setConfirm(false); remove.current?.focus() }} /></div>}
  </>
}
