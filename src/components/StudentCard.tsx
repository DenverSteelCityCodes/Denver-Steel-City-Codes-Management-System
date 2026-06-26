import { CircleCheck, Clock, List, CircleX, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Student, RegistrationStatus } from '../types/database'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import MedicalFlag from './MedicalFlag'

// Human-friendly status copy (DS §7.5 Deep-on-Soft chips, §10 warm voice).
// note: an optional reassuring sub-line shown beneath the chip.
const STATUS_CONFIG: Record<
  RegistrationStatus,
  { label: string; className: string; Icon: LucideIcon; note: string | null }
> = {
  confirmed: { label: 'Confirmed', className: 'bg-success-soft text-success', Icon: CircleCheck, note: null },
  pending: { label: 'Spot held', className: 'bg-warning-soft text-warning', Icon: Clock, note: "We'll confirm soon" },
  waitlisted: { label: 'On waitlist', className: 'bg-info-soft text-info', Icon: List, note: null },
  cancelled: { label: 'Cancelled', className: 'bg-danger-soft text-danger', Icon: CircleX, note: null },
}

interface Props {
  student: Student
  registrations: RegistrationWithSection[]
}

export default function StudentCard({ student, registrations }: Props) {
  const initials = student.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-role-parent-soft flex items-center justify-center shrink-0">
          <span className="font-sans font-semibold text-sm text-role-parent">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="font-sans font-semibold text-base text-ink truncate">{student.full_name}</h3>
            <span className="text-xs font-sans text-ink-muted shrink-0">Age {student.age}</span>
              {student.medical_info && <MedicalFlag info={student.medical_info} />}
            </div>
            <Link
              to={`/parent/register?studentId=${student.id}`}
              className="shrink-0 h-7 px-2.5 text-xs font-sans font-semibold text-ink-muted border border-border-strong rounded-[6px] hover:bg-surface-sunken flex items-center gap-1 transition"
              title="Re-register for a new year"
            >
              <RefreshCw size={11} /> Re-register
            </Link>
          </div>

          {registrations.length === 0 ? (
            <p className="text-sm font-sans text-ink-muted mt-1">Not enrolled in any class yet</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {registrations.map(reg => {
                const cfg = STATUS_CONFIG[reg.status]
                const Icon = cfg.Icon
                return (
                  <li key={reg.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
                      >
                        <Icon size={13} />
                        {cfg.label}
                      </span>
                      <span className="text-sm font-sans text-ink-muted truncate">
                        {reg.sections?.classes?.name ?? '—'}{reg.sections?.label ? ` · ${reg.sections.label}` : ''}
                      </span>
                    </div>
                    {cfg.note && (
                      <p className="mt-0.5 ml-1 text-xs font-sans text-ink-faint">{cfg.note}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
