import { useState } from 'react'
import { CheckCheck, Check, CalendarDays, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AssignedSection } from '../hooks/useAssignedClass'
import { useRollCalls } from '../hooks/useRollCalls'
import RollCallRow from './RollCallRow'
import { ROLL_CALLS, formatTimeRange, formatTime, localDateISO } from '../lib/campDay'
import type { RollCallKind, Session } from '../types/database'

interface Props {
  section: AssignedSection
  // The section's session, used to decide whether roll calls are open today.
  session: Session | null
}

// A section's roll calls for today: pick Arrival / After lunch / Dismissal, mark everyone
// present in one tap, untick the missing. Under 30 seconds on a phone.
export default function RollCallPanel({ section, session }: Props) {
  const today = localDateISO()
  const inSession = !!session && session.start_date <= today && session.end_date >= today
  const { marks, loading, getMark, taken, setMark, markAllPresent, refetch } = useRollCalls(inSession ? section.id : undefined, today)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [chosen, setChosen] = useState<RollCallKind | null>(null)

  // Default to the first roll call not yet taken, else the last one taken.
  const current: RollCallKind = chosen
    ?? ROLL_CALLS.find(r => !taken(r.key))?.key
    ?? ROLL_CALLS[ROLL_CALLS.length - 1].key

  const ids = section.students.map(s => s.id)
  const presentCount = ids.filter(id => getMark(id, current)?.present).length
  const markedCount = ids.filter(id => getMark(id, current)).length
  const allMarked = markedCount === ids.length && ids.length > 0
  const latestMark = marks.filter(m => m.roll_call === current).sort((a, b) => b.marked_at.localeCompare(a.marked_at))[0]

  async function run(fn: () => Promise<void>) {
    // Pin the tab the volunteer is working on; the "first untaken" default only applies on load.
    setChosen(current)
    setBusy(true)
    setErr(null)
    try { await fn() }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save — check your connection and try again") }
    finally { setBusy(false) }
  }

  function toggle(studentId: string) {
    const m = getMark(studentId, current)
    // unmarked → present; present → absent; absent → present
    void run(() => setMark(studentId, current, !(m?.present ?? false)))
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="bg-surface border border-border rounded-xl shadow-sm p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-sans font-bold text-xl text-ink">{section.class_name}</h2>
          <p className="font-sans text-sm text-ink-muted mt-0.5">
            {section.label}{section.week ? ` · Week ${section.week}` : ''}
          </p>
          {(section.start_time || section.room) && (
            <p className="font-sans text-xs text-ink-muted mt-0.5">
              {[section.start_time && `${section.days} · ${formatTimeRange(section.start_time, section.end_time)}`, section.room].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {inSession && !loading && (
          <div className="text-right shrink-0">
            <p className="font-sans font-bold text-3xl text-ink tabular-nums leading-none">
              {presentCount}<span className="text-ink-muted font-normal text-xl">/{ids.length}</span>
            </p>
            <p className="font-sans text-xs text-ink-muted mt-0.5">present</p>
          </div>
        )}
      </div>

      {!inSession ? (
        <div className="bg-surface border border-border rounded-xl shadow-sm p-4 flex items-center gap-3">
          <CalendarDays size={18} className="text-ink-muted shrink-0" />
          <p className="font-sans text-sm text-ink-muted">
            {session
              ? `Roll calls open on the first day of ${session.name} (${new Date(session.start_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}).`
              : 'This section is not scheduled for a camp week yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Roll call picker */}
          <div role="tablist" aria-label="Roll call" className="grid grid-cols-3 rounded-[10px] border border-border-strong overflow-hidden bg-surface">
            {ROLL_CALLS.map((r, i) => {
              const done = taken(r.key)
              const active = current === r.key
              return (
                <button
                  key={r.key}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setChosen(r.key)}
                  className={`h-11 px-2 font-sans font-semibold text-sm flex items-center justify-center gap-1 transition ${
                    i > 0 ? 'border-l border-border-strong' : ''
                  } ${active ? 'bg-brand text-brand-on' : done ? 'text-success hover:bg-surface-sunken' : 'text-ink hover:bg-surface-sunken'}`}
                >
                  {done && <Check size={14} />}
                  <span className="truncate">{r.label}</span>
                </button>
              )
            })}
          </div>

          {!loading && ids.length > 0 && (
            !allMarked ? (
              <button
                onClick={() => run(() => markAllPresent(ids, current))}
                disabled={busy}
                className="w-full h-12 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                <CheckCheck size={16} /> Mark all present{markedCount > 0 ? ` (${ids.length - markedCount} left)` : ''}
              </button>
            ) : (
              <p className="font-sans text-sm text-ink-muted px-1">
                {ROLL_CALLS.find(r => r.key === current)?.label} taken{latestMark ? ` at ${formatTime(new Date(latestMark.marked_at).toTimeString().slice(0, 5))}` : ''} ·{' '}
                <span className="text-success font-semibold">{presentCount} present</span>
                {ids.length - presentCount > 0 && <> · <span className="text-danger font-semibold">{ids.length - presentCount} absent</span></>}
              </p>
            )
          )}

          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}

          {section.students.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
              <p className="font-sans text-ink-muted text-sm">No campers enrolled in this section yet.</p>
            </div>
          ) : loading ? (
            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
              {[1, 2, 3].map(i => <div key={i} className="h-16 border-b border-border last:border-0 animate-pulse" />)}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
              {section.students.map(student => {
                const m = getMark(student.id, current)
                return (
                  <RollCallRow
                    key={student.id}
                    student={student}
                    state={m ? (m.present ? 'present' : 'absent') : null}
                    disabled={busy}
                    onToggle={() => toggle(student.id)}
                  />
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => void refetch()} className="font-sans text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline">
              Refresh
            </button>
            <Link to={`/print/roster/${section.id}`} className="font-sans text-xs text-ink-muted hover:text-ink inline-flex items-center gap-1">
              <Printer size={12} /> Paper roster
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
