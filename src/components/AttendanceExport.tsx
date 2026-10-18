import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSessions } from '../hooks/useSessions'
import { ROLL_CALLS, localDateISO, sessionDays } from '../lib/campDay'
import { downloadCsv, toCsv } from '../lib/csv'
import { ChevronDown, Download } from 'lucide-react'
import Button from './Button'
import { Select } from './Field'

interface SecRow { id: string; label: string; classes: { name: string } | null }
type Stud = { id: string; full_name: string }
interface RegRow { section_id: string; students: Stud | Stud[] | null }
interface MarkRow { section_id: string; student_id: string; day: string; roll_call: string; present: boolean; note: string | null; students: Stud | Stud[] | null }

// PostgREST caps a response (1000 rows by default), and a full week of marks is more than that,
// so read every page. `page` must order by a unique column so pages don't overlap.
const PAGE = 1000
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

const one = (s: Stud | Stud[] | null): Stud | null => Array.isArray(s) ? s[0] ?? null : s

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
        [regs, marks] = await Promise.all([
          fetchAll<RegRow>((from, to) =>
            supabase.from('registrations').select('section_id, students ( id, full_name )')
              .in('section_id', ids).in('status', ['confirmed', 'pending']).order('id').range(from, to)),
          fetchAll<MarkRow>((from, to) =>
            supabase.from('roll_call_marks').select('section_id, student_id, day, roll_call, present, note, students ( id, full_name )')
              .in('section_id', ids).gte('day', session.start_date).lte('day', session.end_date).order('id').range(from, to)),
        ])
      }

      const markMap = new Map<string, boolean>()
      const noteMap = new Map<string, string>()
      for (const m of marks) {
        markMap.set(`${m.section_id}|${m.student_id}|${m.day}|${m.roll_call}`, m.present)
        if (m.note) noteMap.set(`${m.section_id}|${m.student_id}|${m.day}|${m.roll_call}`, m.note)
      }
      const secMap = new Map(sections.map(s => [s.id, s]))

      // Who gets rows: everyone enrolled now, plus anyone with marks in a section they have since
      // left (cancelled or moved mid-week), so the record of the days they attended survives.
      const campers = new Map<string, { secId: string; stud: Stud }>()
      for (const r of regs) {
        const stud = one(r.students)
        if (stud) campers.set(`${r.section_id}|${stud.id}`, { secId: r.section_id, stud })
      }
      for (const m of marks) {
        const key = `${m.section_id}|${m.student_id}`
        const stud = one(m.students)
        if (stud && !campers.has(key)) campers.set(key, { secId: m.section_id, stud })
      }
      // Camp days, plus any other day in the session that has a mark (a weekend event).
      const days = [...new Set([...sessionDays(session), ...marks.map(m => m.day)])].sort()

      const rows: { cls: string; sec: string; camper: string; day: string; cells: string[]; notes: string }[] = []
      for (const { secId, stud } of campers.values()) {
        const sec = secMap.get(secId)
        if (!sec) continue
        for (const day of days) {
          rows.push({
            cls: sec.classes?.name ?? '', sec: sec.label, camper: stud.full_name, day,
            cells: ROLL_CALLS.map(rc => {
              const v = markMap.get(`${sec.id}|${stud.id}|${day}|${rc.key}`)
              return v === undefined ? '' : v ? 'present' : 'absent'
            }),
            // The crew's quick tags (spec 34), named by roll call: "Arrival: Late; Dismissal: Left early".
            notes: ROLL_CALLS.flatMap(rc => {
              const n = noteMap.get(`${sec.id}|${stud.id}|${day}|${rc.key}`)
              return n ? [`${rc.label}: ${n}`] : []
            }).join('; '),
          })
        }
      }
      const cmp = (a: string, b: string) => a.localeCompare(b)
      rows.sort((a, b) => cmp(a.cls, b.cls) || cmp(a.sec, b.sec) || cmp(a.camper, b.camper) || cmp(a.day, b.day))

      const csv = toCsv(
        ['Camper', 'Class', 'Section', 'Day', ...ROLL_CALLS.map(r => r.label), 'Notes'],
        rows.map(r => [r.camper, r.cls, r.sec, r.day, ...r.cells, r.notes]),
      )
      downloadCsv(`attendance-${session.name.replace(/\s+/g, '-').toLowerCase()}-${session.year}.csv`, csv)
      setDone(rows.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  // A Friday job, not a 9 am one: folded at the bottom of the board, with a secondary button.
  return (
    <details className="group mt-10 pt-5 border-t-2 border-ink">
      <summary className="flex items-center gap-2 min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <h2 className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em]">Week export</h2>
        <ChevronDown size={20} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-1 text-ink-muted text-pretty">One row per camper per camp day, with each roll call and the crew's notes.</p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex-[0_1_20rem] min-w-0">
          <label htmlFor="export-session" className="block font-bold mb-1.5">Week</label>
          <Select
            id="export-session"
            value={sessionId}
            onChange={e => { setPicked(e.target.value); setDone(null); setError(null) }}
          >
            {sorted.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
          </Select>
        </div>
        <Button onClick={run} disabled={busy || !session} aria-busy={busy}>
          {busy
            ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            : <Download size={18} aria-hidden="true" />}
          Download attendance CSV
        </Button>
      </div>

      {error && <p role="alert" className="mt-3 text-sm font-bold text-danger text-pretty">Couldn't export: {error}. Try again.</p>}
      {done !== null && !error && <p role="status" className="mt-3 text-sm text-ink-muted">Downloaded {done} rows.</p>}
    </details>
  )
}
