import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSessions } from '../hooks/useSessions'
import { ROLL_CALLS, localDateISO, sessionDays } from '../lib/campDay'
import { downloadCsv, toCsv } from '../lib/csv'

interface SecRow { id: string; label: string; classes: { name: string } | null }
interface RegRow { section_id: string; students: { id: string; full_name: string } | { id: string; full_name: string }[] | null }
interface MarkRow { section_id: string; student_id: string; day: string; roll_call: string; present: boolean }

export default function AttendanceExport() {
  const { sessions } = useSessions()
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  const sorted = useMemo(() => [...sessions].sort((a, b) => b.start_date.localeCompare(a.start_date)), [sessions])
  const defaultId = useMemo(() => {
    const today = localDateISO()
    return (sorted.find(s => s.start_date <= today && s.end_date >= today) ?? sorted[0])?.id ?? ''
  }, [sorted])
  const sessionId = picked ?? defaultId
  const session = sorted.find(s => s.id === sessionId)

  async function run() {
    if (!session) return
    setBusy(true); setError(null); setDone(null)
    try {
      const { data: secs, error: e1 } = await supabase
        .from('sections').select('id, label, classes ( name )').eq('session_id', session.id)
      if (e1) throw new Error(e1.message)
      const sections = (secs ?? []) as unknown as SecRow[]
      const ids = sections.map(s => s.id)

      let regs: RegRow[] = []
      let marks: MarkRow[] = []
      if (ids.length) {
        const [r, m] = await Promise.all([
          supabase.from('registrations').select('section_id, students ( id, full_name )')
            .in('section_id', ids).in('status', ['confirmed', 'pending']),
          supabase.from('roll_call_marks').select('section_id, student_id, day, roll_call, present')
            .in('section_id', ids).gte('day', session.start_date).lte('day', session.end_date),
        ])
        if (r.error) throw new Error(r.error.message)
        if (m.error) throw new Error(m.error.message)
        regs = (r.data ?? []) as unknown as RegRow[]
        marks = (m.data ?? []) as unknown as MarkRow[]
      }

      const markMap = new Map<string, boolean>()
      for (const m of marks) markMap.set(`${m.section_id}|${m.student_id}|${m.day}|${m.roll_call}`, m.present)
      const secMap = new Map(sections.map(s => [s.id, s]))
      const days = sessionDays(session)

      const rows: { cls: string; sec: string; camper: string; day: string; cells: string[] }[] = []
      for (const r of regs) {
        const sec = secMap.get(r.section_id)
        const studs = Array.isArray(r.students) ? r.students : r.students ? [r.students] : []
        if (!sec) continue
        for (const st of studs) {
          for (const day of days) {
            rows.push({
              cls: sec.classes?.name ?? '', sec: sec.label, camper: st.full_name, day,
              cells: ROLL_CALLS.map(rc => {
                const v = markMap.get(`${sec.id}|${st.id}|${day}|${rc.key}`)
                return v === undefined ? '' : v ? 'present' : 'absent'
              }),
            })
          }
        }
      }
      const cmp = (a: string, b: string) => a.localeCompare(b)
      rows.sort((a, b) => cmp(a.cls, b.cls) || cmp(a.sec, b.sec) || cmp(a.camper, b.camper) || cmp(a.day, b.day))

      const csv = toCsv(
        ['Camper', 'Class', 'Section', 'Day', ...ROLL_CALLS.map(r => r.label)],
        rows.map(r => [r.camper, r.cls, r.sec, r.day, ...r.cells]),
      )
      downloadCsv(`attendance-${session.name.replace(/\s+/g, '-').toLowerCase()}-${session.year}.csv`, csv)
      setDone(rows.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-bold text-ink">End-of-week export</h3>
      <p className="text-sm text-ink-muted mt-0.5">One row per camper per camp day, with each roll call.</p>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex flex-col gap-1 sm:min-w-64">
          <label htmlFor="export-session" className="text-xs font-semibold text-ink-muted">Session</label>
          <select
            id="export-session"
            value={sessionId}
            onChange={e => { setPicked(e.target.value); setDone(null); setError(null) }}
            className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink"
          >
            {sorted.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy || !session}
          className="inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-lg bg-brand text-brand-on text-sm font-semibold hover:bg-brand-hover disabled:opacity-60 cursor-pointer"
        >
          {busy && <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />}
          Download attendance CSV
        </button>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {done !== null && !error && <p className="mt-3 text-xs text-ink-muted">Exported {done} rows</p>}
    </div>
  )
}
