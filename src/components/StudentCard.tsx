import { CircleCheck, Clock, List, CircleX, Pencil, GraduationCap } from 'lucide-react'
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

// Rollup status badge (DS §7.5) that summarizes all of a camper's registrations
// into a single at-a-glance signal — the "is my kid all set?" answer (§2).
function rollupStatus(
  registrations: RegistrationWithSection[],
): { label: string; className: string; Icon: LucideIcon | null } {
  const active = registrations.filter(r => r.status !== 'cancelled')
  if (active.length === 0) {
    return { label: 'Not enrolled', className: 'bg-surface-sunken text-ink-muted', Icon: null }
  }
  const needsAction = active.some(r => r.status === 'pending' || r.status === 'waitlisted')
  if (needsAction) {
    return { label: 'Action pending', className: 'bg-warning-soft text-warning', Icon: Clock }
  }
  return { label: 'All set', className: 'bg-success-soft text-success', Icon: CircleCheck }
}

interface Props {
  student: Student
  registrations: RegistrationWithSection[]
  onEdit?: (student: Student) => void
}

export default function StudentCard({ student, registrations, onEdit }: Props) {
  const initials = student.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const rollup = rollupStatus(registrations)
  const RollupIcon = rollup.Icon

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-role-parent-soft flex items-center justify-center shrink-0">
            <span className="font-sans font-semibold text-sm text-role-parent">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h3 className="font-sans font-semibold text-base text-ink truncate">{student.full_name}</h3>
                <span className="text-xs font-sans text-ink-muted shrink-0">Age {student.age}</span>
                {student.medical_info && <MedicalFlag info={student.medical_info} />}
              </div>
              {/* Rollup status badge: all confirmed → All set, any pending/waitlisted → Action pending, none → Not enrolled */}
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${rollup.className}`}
              >
                {RollupIcon && <RollupIcon size={13} />}
                {rollup.label}
              </span>
            </div>

            {registrations.length === 0 ? (
              <p className="text-sm font-sans text-ink-muted mt-1">Not enrolled in any class yet</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {registrations.map(reg => {
                  const cfg = STATUS_CONFIG[reg.status]
                  const Icon = cfg.Icon
                  const week = reg.sections?.week
                  return (
                    <li key={reg.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
                        >
                          <Icon size={13} />
                          {cfg.label}
                        </span>
                        <span className="text-sm font-sans text-ink-muted truncate">
                          {reg.sections?.classes?.name ?? '—'}
                          {reg.sections?.label ? ` · ${reg.sections.label}` : ''}
                          {week ? ` · Week ${week}` : ''}
                        </span>
                      </div>
                      {/* SCHEDULE LINE PLACEHOLDER — render days · times · lead volunteer here once the
                          `sections` table gains start_time / end_time / weekdays columns. Times are
                          deferred (no such columns exist yet); do not fabricate them. */}
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

      {/* Footer: per-camper actions (DS §7.1). Ghost Edit + secondary Register; the single gold
          primary (Add camper) lives in the dashboard header. */}
      <div className="bg-surface-sunken border-t border-border px-5 py-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit?.(student)}
          className="h-10 px-3 text-sm font-sans font-semibold text-ink-muted rounded-[8px] hover:bg-surface hover:text-ink flex items-center gap-1.5 transition"
        >
          <Pencil size={14} /> Edit camper
        </button>
        <Link
          to={`/parent/classes?camper=${student.id}`}
          className="h-10 px-3.5 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[8px] hover:bg-surface-sunken flex items-center gap-1.5 transition shadow-sm"
        >
          <GraduationCap size={14} /> Register for another class
        </Link>
      </div>
    </div>
  )
}
