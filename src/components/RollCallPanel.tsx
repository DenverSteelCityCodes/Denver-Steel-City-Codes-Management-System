import { useState } from 'react'
import { Check, CheckCheck, CircleAlert, CircleCheck, StickyNote } from 'lucide-react'
import type { AssignedSection, AssignedStudent } from '../hooks/useAssignedClass'
import { useRollCalls } from '../hooks/useRollCalls'
import RollCallRow from './RollCallRow'
import RollCallNote from './RollCallNote'
import Button from './Button'
import { ROLL_CALLS, rollCallForTime, formatTime, localDateISO, markKey } from '../lib/campDay'
import type { RollCallKind } from '../types/database'

interface Props {
  section: AssignedSection
  // Name the class in the band (when more than one section runs today).
  showClass?: boolean
}

// A section's roll calls for today: pick Arrival / After lunch / Dismissal, mark everyone present
// in one tap, then tap whoever is missing. Under 30 seconds on a phone. Only the slim ink band
// (roll calls and the count) sticks; on a phone the shell scrolls away so it stays in view
// (VolunteerLayout). The roll calls and count share one row only when the panel is wide enough for
// both (a container query: in the desktop's left column they stack). Each tap saves on its own, so
// the rest of the list stays live while it does.
export default function RollCallPanel({ section, showClass = false }: Props) {
  const today = localDateISO()
  const { marks, loading, error: loadError, getMark, taken, setMark, markAllPresent, setNote, refetch } = useRollCalls(section.id, today)
  // "Add notes" mode (spec 34): the quick tags show under each marked camper.
  const [noting, setNoting] = useState(false)
  const [chosen, setChosen] = useState<RollCallKind | null>(null)
  // Marks being saved, and marks whose save failed (with the camper's name), keyed by markKey.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [failed, setFailed] = useState<ReadonlyMap<string, string>>(new Map())
  const [markAllFailed, setMarkAllFailed] = useState<RollCallKind | null>(null)

  // Default to the roll call for the time of day — not "first untaken", which at 9:30 after
  // arrival is done lands on After lunch, where one stray tap marks everyone else unmarked.
  const current: RollCallKind = chosen ?? rollCallForTime()
  const label = ROLL_CALLS.find(r => r.key === current)?.label ?? ''
  const students = section.students
  const total = students.length
  const presentCount = students.filter(s => getMark(s.id, current)?.present).length
  const markedCount = students.filter(s => getMark(s.id, current)).length
  const left = total - markedCount
  const latestMark = marks.filter(m => m.roll_call === current).sort((a, b) => b.marked_at.localeCompare(a.marked_at))[0]
  const done = !loading && total > 0 && left === 0

  function track(keys: string[], saving: boolean) {
    setPending(prev => {
      const next = new Set(prev)
      for (const k of keys) {
        if (saving) next.add(k)
        else next.delete(k)
      }
      return next
    })
  }

  function forget(keys: string[]) {
    setFailed(prev => {
      if (!keys.some(k => prev.has(k))) return prev
      const next = new Map(prev)
      for (const k of keys) next.delete(k)
      return next
    })
  }

  function toggle(student: AssignedStudent) {
    const kind = current
    const key = markKey(student.id, kind)
    if (pending.has(key)) return
    // Pin the tab the volunteer is working on; the time-of-day default only applies until then.
    setChosen(kind)
    forget([key])
    // Marking a row by hand moves on from a failed "Mark all"; its message would only mislead.
    if (markAllFailed === kind) setMarkAllFailed(null)
    track([key], true)
    // unmarked → present; present → absent; absent → present
    setMark(student.id, kind, !(getMark(student.id, kind)?.present ?? false))
      .catch(() => setFailed(prev => new Map(prev).set(key, student.full_name)))
      .finally(() => track([key], false))
  }

  function markAll() {
    const kind = current
    setChosen(kind)
    const keys = students.filter(s => !getMark(s.id, kind)).map(s => markKey(s.id, kind))
    forget(keys)
    setMarkAllFailed(null)
    track(keys, true)
    markAllPresent(students.map(s => s.id), kind)
      .catch(() => setMarkAllFailed(kind))
      .finally(() => track(keys, false))
  }

  // A named camper first; the "Mark all" failure only while there is still someone to mark (its
  // button is the way to try again, and it disappears once everyone is marked).
  const failedNames = [...failed].filter(([k]) => k.endsWith(`:${current}`)).map(([, n]) => n)
  const saveError = failedNames.length === 1 ? `Couldn't save ${failedNames[0]}. Check your connection and tap again.`
    : failedNames.length > 1 ? `Couldn't save ${failedNames.length} campers: ${failedNames.join(', ')}. Check your connection and tap again.`
      : markAllFailed === current && left > 0 ? "Couldn't mark everyone present. Check your connection and try again."
        : null

  const headingId = `rc-${section.id}`
  const tabId = (k: RollCallKind) => `rc-${section.id}-${k}`
  const absentCount = markedCount - presentCount

  return (
    <section aria-labelledby={headingId} className="@container -mx-4 sm:-mx-8 lg:mx-0">
      <div data-rollcall-band
        className="sticky top-0 md:top-16 z-20 bg-shell text-on-shell px-4 sm:px-8 lg:px-4 py-3 lg:rounded grid grid-cols-1 @min-[42rem]:grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 dark:shadow-[inset_0_-1px_0_var(--border)] [&_:focus-visible]:outline-brand">
        <h2 id={headingId} className={showClass ? 'col-span-full text-sm font-bold text-on-shell-muted' : 'sr-only'}>
          {label} roll call{showClass ? `, ${section.class_name} ${section.label}` : ''}
        </h2>

        <div role="tablist" aria-label="Roll call" className="flex min-w-0 border-2 border-on-shell-muted rounded overflow-hidden">
          {ROLL_CALLS.map(r => {
            const isDone = taken(r.key)
            const active = current === r.key
            return (
              <button
                key={r.key}
                id={tabId(r.key)}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={`${headingId}-list`}
                onClick={() => setChosen(r.key)}
                className={`flex-auto min-h-11 px-3 inline-flex items-center justify-center gap-1.5 text-center leading-tight font-bold border-l-2 border-on-shell-muted first:border-l-0 transition-colors ${
                  active ? 'bg-on-shell text-shell' : 'text-on-shell hover:bg-shell-raised'}`}
              >
                {isDone && <Check size={16} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />}
                {r.label}{isDone && <span className="sr-only">, done</span>}
              </button>
            )
          })}
        </div>

        {!loading && total > 0 && (
          <p className="@min-[42rem]:justify-self-end flex items-baseline gap-[0.15em] text-brand font-extrabold tabular-nums leading-[0.92] tracking-[-0.03em] text-[3.5rem]">
            {done && <Check strokeWidth={3} className="self-center size-[0.62em]" aria-hidden="true" />}
            <span aria-hidden="true">{presentCount}/{total}</span>
            <span aria-hidden="true" className="text-[0.42em] tracking-normal">present</span>
            <span role="status" className="sr-only">{presentCount} of {total} present</span>
          </p>
        )}

        {saveError && (
          <p role="alert" className="col-span-full flex items-start gap-2 rounded bg-danger-soft px-3 py-2 font-bold text-danger">
            <CircleAlert size={18} strokeWidth={2.5} className="shrink-0 mt-0.5" aria-hidden="true" />
            {saveError}
          </p>
        )}
      </div>

      {loadError && (
        <div role="alert" className="px-4 sm:px-8 lg:px-4 py-2.5 bg-danger-soft font-bold text-danger">
          Couldn't load today's marks, so what you see may be out of date.{' '}
          <button type="button" onClick={() => void refetch()} className="underline underline-offset-[3px] min-h-11">Try again</button>
        </div>
      )}

      {!loading && !loadError && left > 0 && (
        <div className="px-4 sm:px-8 lg:px-0 mt-4">
          {/* Two sections at once would mean two gold buttons; the second set of decisions stays ink. */}
          <Button variant={showClass ? 'ink' : 'primary'} block onClick={markAll}>
            <CheckCheck size={18} strokeWidth={2.5} aria-hidden="true" />
            {left === total ? `Mark all ${total} present` : `Mark the other ${left} present`}
          </Button>
          {left === total && <p className="mt-2 text-sm text-ink-muted">Then tap whoever is missing.</p>}
        </div>
      )}

      {done && (
        <div className="px-4 sm:px-8 lg:px-0 mt-4">
          <p className="flex items-center gap-2 text-lg font-bold leading-[1.3] text-success">
            <CircleCheck size={20} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
            {label} roll call done
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {presentCount} of {total} present{absentCount ? `, ${absentCount} absent` : ''}
            {latestMark ? ` · ${formatTime(new Date(latestMark.marked_at).toTimeString().slice(0, 5))}` : ''}
          </p>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="px-4 sm:px-8 lg:px-0 mt-2">
          <button type="button" aria-pressed={noting} onClick={() => setNoting(n => !n)}
            className="inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px] hover:decoration-2">
            <StickyNote size={16} strokeWidth={2.5} aria-hidden="true" />
            {noting ? 'Done adding notes' : 'Add notes: late, left early, picked up'}
          </button>
        </div>
      )}

      <div id={`${headingId}-list`} role="tabpanel" aria-labelledby={tabId(current)}>
        <ul className="mt-4 border-y-2 border-ink">
          {loading ? (
            [1, 2, 3].map(i => <li key={i} className="h-16 border-t border-border first:border-t-0 animate-pulse" />)
          ) : total === 0 ? (
            <li className="px-4 sm:px-8 lg:px-4 py-6 text-ink-muted">No campers enrolled in this section yet.</li>
          ) : (
            students.map(student => {
              const m = getMark(student.id, current)
              const key = markKey(student.id, current)
              return (
                <RollCallRow
                  key={student.id}
                  student={student}
                  state={m ? (m.present ? 'present' : 'absent') : null}
                  pending={pending.has(key)}
                  failed={failed.has(key)}
                  onToggle={() => toggle(student)}
                >
                  <RollCallNote name={student.full_name} marked={!!m} note={m?.note ?? null} editing={noting}
                    onSave={note => setNote(student.id, current, note)} />
                </RollCallRow>
              )
            })
          )}
        </ul>
      </div>
      <div className="px-4 sm:px-8 lg:px-0">
        <button type="button" onClick={() => void refetch()}
          className="min-h-11 text-sm font-bold text-ink-muted hover:text-ink underline-offset-[3px] hover:underline">
          Refresh
        </button>
      </div>
    </section>
  )
}
