import { useState } from 'react'
import { CheckCheck, Check } from 'lucide-react'
import type { AssignedSection } from '../hooks/useAssignedClass'
import { useRollCalls } from '../hooks/useRollCalls'
import RollCallRow from './RollCallRow'
import { ROLL_CALLS, rollCallForTime, formatTime, localDateISO } from '../lib/campDay'
import { countLabel } from '../lib/volunteerHome'
import type { RollCallKind } from '../types/database'

interface Props {
  section: AssignedSection
  // Show the class name in the header (when more than one section runs today).
  showClass?: boolean
}

// A section's roll calls for today: pick Arrival / After lunch / Dismissal, mark everyone
// present in one tap, untick the missing. Under 30 seconds on a phone. The dark header sticks
// below the tab strip while you scroll the campers, so the count and tabs never leave the screen.
export default function RollCallPanel({ section, showClass = false }: Props) {
  const today = localDateISO()
  const { marks, loading, error: loadError, getMark, taken, setMark, markAllPresent, refetch } = useRollCalls(section.id, today)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [chosen, setChosen] = useState<RollCallKind | null>(null)

  // Default to the roll call for the time of day — not "first untaken", which at 9:30 after
  // arrival is done lands on After lunch, where one stray tap marks everyone else unmarked.
  const current: RollCallKind = chosen ?? rollCallForTime()
  const label = ROLL_CALLS.find(r => r.key === current)?.label ?? ''

  const ids = section.students.map(s => s.id)
  const presentCount = ids.filter(id => getMark(id, current)?.present).length
  const markedCount = ids.filter(id => getMark(id, current)).length
  const left = ids.length - markedCount
  const latestMark = marks.filter(m => m.roll_call === current).sort((a, b) => b.marked_at.localeCompare(a.marked_at))[0]

  async function run(fn: () => Promise<void>) {
    // Pin the tab the volunteer is working on; the time-of-day default only applies until then.
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

  const hint = loading ? 'Loading today’s marks…'
    : ids.length === 0 ? 'No campers in this section yet.'
    : left === ids.length ? 'Mark everyone, then tap whoever is missing.'
    : left > 0 ? `${countLabel(left, 'camper', 'campers')} still to mark.`
    : `Taken${latestMark ? ` at ${formatTime(new Date(latestMark.marked_at).toTimeString().slice(0, 5))}` : ''}. ${presentCount} present${ids.length - presentCount ? `, ${ids.length - presentCount} absent` : ''}.`

  return (
    <section aria-labelledby={`rc-${section.id}`} className="-mx-4 sm:mx-0">
      <div className="sticky top-12 sm:top-16 z-20 bg-ink-950 dark:bg-surface-raised dark:border-y dark:border-border-strong sm:rounded-t-[14px] px-4 py-3.5 text-white">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`rc-${section.id}`} className="font-sans font-bold text-xl leading-tight">
              {label} roll call{showClass ? ` · ${section.label}` : ''}
            </h2>
            <p className="font-sans text-sm text-white/75 mt-0.5" aria-live="polite">{hint}</p>
          </div>
          {!loading && ids.length > 0 && (
            <p className="text-right shrink-0 font-sans" aria-label={`${presentCount} of ${ids.length} present`}>
              <span className="block font-bold text-[44px] leading-[0.9] text-brand tabular-nums">{presentCount}</span>
              <span className="block text-[13.5px] font-semibold text-white/75 mt-1.5 whitespace-nowrap">of {ids.length} present</span>
            </p>
          )}
        </div>

        <div role="tablist" aria-label="Roll call" className="grid grid-cols-3 gap-1.5 mt-3">
          {ROLL_CALLS.map(r => {
            const done = taken(r.key)
            const active = current === r.key
            return (
              <button
                key={r.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setChosen(r.key)}
                className={`h-10 px-2 rounded-[10px] border font-sans font-semibold text-sm flex items-center justify-center gap-1 transition ${
                  active ? 'bg-white border-white text-ink-950'
                    : done ? 'border-success-soft/45 text-success-soft dark:border-success/45 dark:text-success hover:bg-white/10'
                      : 'border-white/25 text-white/85 hover:bg-white/10'
                }`}
              >
                {done && <Check size={14} aria-hidden="true" />}
                <span className="truncate">{r.label}</span>
              </button>
            )
          })}
        </div>

        {!loading && !loadError && left > 0 && (
          <button
            onClick={() => run(() => markAllPresent(ids, current))}
            disabled={busy}
            className="ui-btn ui-btn--primary mt-2.5 w-full"
          >
            <CheckCheck size={17} /> {left === ids.length ? `Mark all ${ids.length} present` : `Mark the other ${left} present`}
          </button>
        )}
      </div>

      {(loadError || err) && (
        <div role="alert" className="px-4 py-2.5 bg-danger-soft font-sans text-sm text-danger">
          {err ?? <>Couldn't load today's marks, so what you see may be out of date.{' '}
            <button type="button" onClick={() => void refetch()} className="underline font-semibold">Try again</button></>}
        </div>
      )}

      <div className="bg-surface border-b border-border sm:border sm:border-t-0 sm:rounded-b-[14px] overflow-hidden">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-16 border-b border-border last:border-0 animate-pulse" />)
        ) : section.students.length === 0 ? (
          <p className="p-6 font-sans text-ink-muted text-sm">No campers enrolled in this section yet.</p>
        ) : (
          section.students.map(student => {
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
          })
        )}
      </div>
      <div className="px-4 sm:px-0">
        <button type="button" onClick={() => void refetch()}
          className="min-h-11 font-sans text-sm font-semibold text-ink-muted hover:text-ink underline-offset-4 hover:underline">
          Refresh
        </button>
      </div>
    </section>
  )
}
