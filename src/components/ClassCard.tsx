import { ClipboardList, CheckCircle, Clock, List } from 'lucide-react'
import type { ClassWithCount } from '../hooks/useClasses'
import type { RegistrationStatus } from '../types/database'
import CapacityMeter from './CapacityMeter'

const AGE_GROUP_COLORS = [
  'bg-warning-soft text-warning',
  'bg-info-soft text-info',
  'bg-role-parent-soft text-role-parent',
  'bg-success-soft text-success',
]

interface Props {
  classData: ClassWithCount
  registrationStatus?: RegistrationStatus
  onRegister?: () => void
  registering?: boolean
  studentName?: string
}

export default function ClassCard({ classData, registrationStatus, onRegister, registering, studentName }: Props) {
  const isFull = classData.registered_count >= classData.capacity
  const colorIdx = classData.name.charCodeAt(0) % AGE_GROUP_COLORS.length

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-sans font-semibold text-base text-ink truncate">{classData.name}</h3>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mt-1 ${AGE_GROUP_COLORS[colorIdx]}`}>
            {classData.age_group}
          </span>
        </div>
        <ClipboardList size={20} className="text-ink-faint shrink-0 mt-0.5" />
      </div>

      <CapacityMeter registered={classData.registered_count} capacity={classData.capacity} />

      {onRegister && (
        <div>
          {registrationStatus ? (
            <div className="flex items-center gap-2 text-sm font-sans font-semibold">
              {registrationStatus === 'confirmed' && <><CheckCircle size={16} className="text-success" /><span className="text-success">Confirmed</span></>}
              {registrationStatus === 'pending' && <><Clock size={16} className="text-warning" /><span className="text-warning">Pending</span></>}
              {registrationStatus === 'waitlisted' && <><List size={16} className="text-info" /><span className="text-info">Waitlisted</span></>}
              {studentName && <span className="text-ink-muted font-normal">· {studentName}</span>}
            </div>
          ) : (
            <button
              onClick={onRegister}
              disabled={registering}
              className="w-full h-10 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registering ? (
                <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
              ) : isFull ? (
                'Join waitlist'
              ) : (
                'Register camper'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
