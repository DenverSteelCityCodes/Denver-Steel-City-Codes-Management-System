import { useState } from 'react'
import { LogIn, LogOut, Phone } from 'lucide-react'
import type { AssignedStudent } from '../hooks/useAssignedClass'
import type { AttendanceAction } from '../types/database'
import MedicalFlag from './MedicalFlag'
import { realNote } from '../lib/campers'

interface Props {
  student: AssignedStudent
  status: AttendanceAction | null
  onAction: (action: AttendanceAction) => Promise<void>
  busy: boolean
}

export default function AttendanceRow({ student, status, onAction, busy }: Props) {
  // Which button was pressed, so only that one spins.
  const [pressed, setPressed] = useState<AttendanceAction | null>(null)
  const act = (a: AttendanceAction) => { setPressed(a); void onAction(a).finally(() => setPressed(null)) }
  const isIn = status === 'check_in'
  const isOut = status === 'check_out'

  // What a volunteer needs at a glance: allergies and medical needs (ignoring "None" answers).
  const allergies = realNote(student.allergies)
  const medical = realNote(student.medical_conditions) ?? realNote(student.medical_info)
  const medicalNote = [allergies && `Allergies: ${allergies}`, medical && `Medical: ${medical}`].filter(Boolean).join(' · ')
  const callNumber = student.emergency_contact_phone || student.parent_phone
  const callWho = student.emergency_contact_phone ? (student.emergency_contact_name ?? 'emergency contact') : 'parent'

  const initials = student.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={`flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-4 py-3.5 border-b border-border last:border-0 transition ${
      isIn ? 'bg-success-soft/40' : isOut ? 'bg-surface-sunken/60' : ''
    }`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-sans font-semibold text-sm ${
        isIn ? 'bg-success-soft text-success' : 'bg-surface-sunken text-ink-muted'
      }`}>
        {initials}
      </div>

      {/* Name + age */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans font-semibold text-sm text-ink">{student.full_name}</span>
          <span className="font-sans text-xs text-ink-muted">Age {student.age}</span>
          {medicalNote && <MedicalFlag info={medicalNote} />}
        </div>
        {status && (
          <p className={`text-xs font-sans mt-0.5 ${isIn ? 'text-success' : 'text-ink-muted'}`}>
            {isIn ? 'Checked in' : 'Checked out'}
          </p>
        )}
      </div>

      {callNumber && (
        <a
          href={`tel:${callNumber.replace(/[^\d+]/g, '')}`}
          aria-label={`Call ${student.full_name}'s ${callWho}`}
          title={`Call ${callWho}: ${callNumber}`}
          className="h-11 w-11 shrink-0 rounded-[10px] border border-border-strong bg-surface text-ink-muted hover:text-ink hover:bg-surface-sunken flex items-center justify-center transition"
        >
          <Phone size={16} />
        </a>
      )}

      {/* Check-in / Check-out segmented control — 44px+ tap targets */}
      <div className="flex rounded-[10px] border border-border-strong overflow-hidden shrink-0">
        <button
          onClick={() => act('check_in')}
          disabled={busy || isIn}
          className={`h-11 px-4 flex items-center gap-1.5 font-sans font-semibold text-sm transition disabled:cursor-not-allowed ${
            isIn
              ? 'bg-success text-surface'
              : 'bg-surface text-ink hover:bg-success-soft hover:text-success'
          }`}
        >
          {busy && pressed === 'check_in'
            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            : <LogIn size={15} />}
          In
        </button>
        <div className="w-px bg-border-strong" />
        <button
          onClick={() => act('check_out')}
          disabled={busy || isOut || !status}
          className={`h-11 px-4 flex items-center gap-1.5 font-sans font-semibold text-sm transition disabled:cursor-not-allowed ${
            isOut
              ? 'bg-ink-muted text-surface'
              : 'bg-surface text-ink hover:bg-surface-sunken disabled:opacity-40'
          }`}
        >
          {busy && pressed === 'check_out'
            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            : <LogOut size={15} />}
          Out
        </button>
      </div>
    </div>
  )
}
