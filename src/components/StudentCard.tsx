import { HeartPulse } from 'lucide-react'
import type { Student } from '../types/database'
import type { RegistrationWithClass } from '../hooks/useRegistrations'

const STATUS_STYLES = {
  confirmed: 'bg-success-soft text-success',
  pending: 'bg-warning-soft text-warning',
  waitlisted: 'bg-info-soft text-info',
  cancelled: 'bg-danger-soft text-danger',
}

interface Props {
  student: Student
  registrations: RegistrationWithClass[]
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
          <div className="flex items-center gap-2">
            <h3 className="font-sans font-semibold text-base text-ink truncate">{student.full_name}</h3>
            <span className="text-xs font-sans text-ink-muted shrink-0">Age {student.age}</span>
            {student.medical_info && (
              <span title="Medical / allergy info on file" className="shrink-0">
                <HeartPulse size={14} className="text-danger" />
              </span>
            )}
          </div>

          {registrations.length === 0 ? (
            <p className="text-sm font-sans text-ink-muted mt-1">Not enrolled in any class yet</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {registrations.map(reg => (
                <li key={reg.id} className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[reg.status]}`}>
                    {reg.status}
                  </span>
                  <span className="text-sm font-sans text-ink-muted truncate">{reg.classes.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
