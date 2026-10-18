import type { ReactNode } from 'react'
import { Check, CircleAlert, LoaderCircle, Phone, X } from 'lucide-react'
import type { AssignedStudent } from '../hooks/useAssignedClass'
import HealthNotes from './HealthNotes'
import CallLink from './CallLink'
import { callLines, healthLines } from '../lib/campers'

export type MarkState = 'present' | 'absent' | null

interface Props {
  student: AssignedStudent
  state: MarkState
  // This camper's mark is saving; only this toggle waits, the rest of the list stays live.
  pending: boolean
  // The last save for this camper failed (the toggle is back to what it showed before).
  failed: boolean
  onToggle: () => void
  // Extra lines under the row, full width (the roll-call note, spec 34).
  children?: ReactNode
  // Dismissal (spec 36): the camper has been collected, so the toggle gives way to a fixed word
  // (undo the release first to change the mark).
  collected?: boolean
}

// One camper in a roll call: the name and a 44px toggle on one line, health notes and (when absent)
// who to call full width under them. Safety information is never behind a tap (DESIGN.md › Roll
// Call). The toggle cycles unmarked → Present → Absent → Present …, so "mark all present, then tap
// whoever is missing" is one tap per missing camper.
export default function RollCallRow({ student, state, pending, failed, onToggle, children, collected = false }: Props) {
  const health = healthLines(student)
  const calls = state === 'absent' ? callLines(student) : []
  const name = student.full_name

  const tone = state === 'present'
    ? 'border-success bg-success-soft text-success'
    : state === 'absent'
      ? 'border-danger bg-danger-soft text-danger'
      : 'border-border-strong bg-surface text-ink hover:bg-surface-sunken'
  const label = state === 'present' ? 'Present' : state === 'absent' ? 'Absent' : 'Mark present'
  const spoken = state === 'present' ? `Present, ${name}. Tap to mark absent.`
    : state === 'absent' ? `Absent, ${name}. Tap to mark present.`
      : `Mark present, ${name}`
  const icon = pending ? <LoaderCircle size={16} strokeWidth={2.5} className="animate-spin" aria-hidden="true" />
    : state === 'present' ? <Check size={16} strokeWidth={3} aria-hidden="true" />
      : state === 'absent' ? <X size={16} strokeWidth={3} aria-hidden="true" />
        : null

  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 sm:px-8 lg:px-4 py-3 border-t border-border first:border-t-0 ${
      state === 'absent' ? 'bg-danger-soft' : ''}`}>
      <p className="font-bold text-lg leading-[1.3] text-ink">{name}</p>

      {collected ? (
        <span className="min-h-11 min-w-[132px] px-3 rounded border-2 font-extrabold inline-flex items-center justify-center gap-1.5 border-success bg-success-soft text-success">
          <Check size={16} strokeWidth={3} aria-hidden="true" />Collected
        </span>
      ) : <button
        type="button"
        onClick={onToggle}
        // aria-disabled, not disabled: a disabled button drops keyboard focus mid-save. The panel
        // ignores taps on a row that is still saving.
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        aria-label={spoken}
        className={`min-h-11 min-w-[132px] px-3 rounded border-2 font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors aria-disabled:cursor-progress ${tone}`}
      >
        {icon}{label}
      </button>}

      {health.length > 0 && <HealthNotes lines={health} className="col-span-2 mt-1" />}

      {failed && (
        <p className="col-span-2 mt-1 flex items-start gap-1.5 text-sm font-bold text-danger">
          <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />
          Couldn't save. Check your connection and tap again.
        </p>
      )}

      {state === 'absent' && (calls.length > 0
        ? calls.map(c => <CallLink key={c.number} call={c} verb className="col-span-2 justify-self-start" />)
        : (
          <p className="col-span-2 mt-1 flex items-start gap-1.5 text-ink-muted">
            <Phone size={16} strokeWidth={2.5} className="shrink-0 mt-1" aria-hidden="true" />
            No phone number on file. Tell an admin.
          </p>
        ))}

      {children}
    </li>
  )
}
