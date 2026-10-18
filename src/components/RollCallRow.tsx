import { Check, X, Phone } from 'lucide-react'
import type { AssignedStudent } from '../hooks/useAssignedClass'
import MedicalFlag from './MedicalFlag'
import { callTarget, healthNote, telHref } from '../lib/campers'

export type MarkState = 'present' | 'absent' | null

interface Props {
  student: AssignedStudent
  state: MarkState
  disabled: boolean
  onToggle: () => void
}

// One camper in a roll call. A single 44px toggle: unmarked → Present → Absent → Present …
// so "mark all present, then untick the missing" is one tap per missing camper. Present is a soft
// fill so the roll-call header stays the loudest thing on the page; absent shows a call button.
export default function RollCallRow({ student, state, disabled, onToggle }: Props) {
  const medicalNote = healthNote(student)
  const call = callTarget(student)
  const initials = student.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const tone = state === 'present'
    ? 'bg-success-soft text-success border-success/35'
    : state === 'absent'
      ? 'bg-danger-soft text-danger border-danger/40'
      : 'bg-surface text-ink border-border-strong hover:bg-success-soft hover:text-success'

  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 transition ${
      state === 'absent' ? 'bg-danger-soft/45' : ''
    }`}>
      <div aria-hidden="true" className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-sans font-bold text-[13px] ${
        state === 'present' ? 'bg-success-soft text-success' : state === 'absent' ? 'bg-danger-soft text-danger' : 'bg-surface-sunken text-ink-muted'
      }`}>
        {initials}
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-x-2 gap-y-1 flex-wrap">
        <span className="font-sans font-semibold text-base text-ink leading-tight">{student.full_name}</span>
        <span className="font-sans text-sm text-ink-muted">{student.age}</span>
        {medicalNote && <MedicalFlag info={medicalNote} footnote="Confidential — for camp staff only." />}
      </div>

      {state === 'absent' && call && (
        <a
          href={telHref(call.number)}
          aria-label={`Call ${student.full_name}'s ${call.who}, ${call.number}`}
          className="h-11 w-11 shrink-0 rounded-[10px] border border-border-strong bg-surface text-ink hover:bg-surface-sunken flex items-center justify-center transition"
        >
          <Phone size={17} />
        </a>
      )}

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={state === 'present'}
        aria-label={`${student.full_name}: ${state === 'present' ? 'present, tap to mark absent' : state === 'absent' ? 'absent, tap to mark present' : 'not marked, tap to mark present'}`}
        className={`h-11 min-w-[6.5rem] px-3 shrink-0 rounded-[10px] border font-sans font-semibold text-[15px] flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${tone}`}
      >
        {state === 'present' ? <><Check size={15} /> Present</> : state === 'absent' ? <><X size={15} /> Absent</> : 'Mark'}
      </button>
    </div>
  )
}
