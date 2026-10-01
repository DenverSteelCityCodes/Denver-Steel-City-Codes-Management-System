import { Check, X, Phone } from 'lucide-react'
import type { AssignedStudent } from '../hooks/useAssignedClass'
import MedicalFlag from './MedicalFlag'
import { realNote } from '../lib/campers'

export type MarkState = 'present' | 'absent' | null

interface Props {
  student: AssignedStudent
  state: MarkState
  disabled: boolean
  onToggle: () => void
}

// One camper in a roll call. A single 44px toggle: unmarked → Present → Absent → Present …
// so "mark all present, then untick the missing" is one tap per missing camper.
export default function RollCallRow({ student, state, disabled, onToggle }: Props) {
  const allergies = realNote(student.allergies)
  const medical = realNote(student.medical_conditions) ?? realNote(student.medical_info)
  const medicalNote = [allergies && `Allergies: ${allergies}`, medical && `Medical: ${medical}`].filter(Boolean).join(' · ')
  const callNumber = student.emergency_contact_phone || student.parent_phone
  const callWho = student.emergency_contact_phone ? (student.emergency_contact_name ?? 'emergency contact') : 'parent'
  const initials = student.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const tone = state === 'present'
    ? 'bg-success text-surface border-success'
    : state === 'absent'
      ? 'bg-danger-soft text-danger border-danger/40'
      : 'bg-surface text-ink border-border-strong hover:bg-success-soft hover:text-success'

  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border last:border-0 transition ${
      state === 'present' ? 'bg-success-soft/30' : state === 'absent' ? 'bg-danger-soft/40' : ''
    }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-sans font-semibold text-sm ${
        state === 'present' ? 'bg-success-soft text-success' : state === 'absent' ? 'bg-danger-soft text-danger' : 'bg-surface-sunken text-ink-muted'
      }`}>
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans font-semibold text-sm text-ink">{student.full_name}</span>
          <span className="font-sans text-xs text-ink-muted">Age {student.age}</span>
          {medicalNote && <MedicalFlag info={medicalNote} footnote="Confidential — for camp staff only." />}
        </div>
      </div>

      {state === 'absent' && callNumber && (
        <a
          href={`tel:${callNumber.replace(/[^\d+]/g, '')}`}
          aria-label={`Call ${student.full_name}'s ${callWho}`}
          title={`Call ${callWho}: ${callNumber}`}
          className="h-11 w-11 shrink-0 rounded-[10px] border border-border-strong bg-surface text-ink-muted hover:text-ink hover:bg-surface-sunken flex items-center justify-center transition"
        >
          <Phone size={16} />
        </a>
      )}

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={state === 'present'}
        aria-label={`${student.full_name}: ${state === 'present' ? 'present, tap to mark absent' : state === 'absent' ? 'absent, tap to mark present' : 'not marked, tap to mark present'}`}
        className={`h-11 min-w-[6.5rem] px-3 shrink-0 rounded-[10px] border font-sans font-semibold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${tone}`}
      >
        {state === 'present' ? <><Check size={15} /> Present</> : state === 'absent' ? <><X size={15} /> Absent</> : 'Mark'}
      </button>
    </div>
  )
}
