import { useState } from 'react'
import { Users, CheckCheck, Clock, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAssignedClass } from '../hooks/useAssignedClass'
import { useAttendance } from '../hooks/useAttendance'
import { useDutySlots } from '../hooks/useDutyRoles'
import AttendanceRow from '../components/AttendanceRow'
import type { AssignedSection } from '../hooks/useAssignedClass'
import type { AttendanceAction } from '../types/database'

function DutyPanel({ userId }: { userId: string }) {
  const { slots, loading, claimSlot, unclaimSlot } = useDutySlots()
  const [busySlotId, setBusySlotId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const upcoming = slots.filter(s => s.slot_date >= today)

  const grouped = upcoming.reduce<Record<string, typeof slots>>((acc, s) => {
    acc[s.slot_date] = acc[s.slot_date] ?? []
    acc[s.slot_date].push(s)
    return acc
  }, {})

  async function handleClaim(slotId: string) {
    setBusySlotId(slotId)
    try { await claimSlot(slotId, userId) } finally { setBusySlotId(null) }
  }

  async function handleUnclaim(slotId: string) {
    setBusySlotId(slotId)
    try { await unclaimSlot(slotId, userId) } finally { setBusySlotId(null) }
  }

  if (loading) return (
    <div className="space-y-2">
      {[1, 2].map(i => <div key={i} className="h-12 bg-surface border border-border rounded-[14px] animate-pulse" />)}
    </div>
  )

  if (upcoming.length === 0) return (
    <div className="bg-surface border border-border rounded-xl p-6 text-center">
      <CalendarDays size={20} className="text-ink-muted mx-auto mb-2" />
      <p className="font-sans text-sm text-ink-muted">No upcoming duty slots.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, daySlots]) => (
          <div key={date}>
            <p className="font-sans font-semibold text-sm text-ink-muted mb-1.5">
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {daySlots.map((slot, idx) => {
                const myClaim = slot.assignments?.find((a: any) => a.volunteer_id === userId)
                const isFull = slot.assigned_count >= slot.capacity && !myClaim
                return (
                  <div
                    key={slot.id}
                    className={`flex items-center justify-between px-4 py-3 ${idx < daySlots.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div>
                      <p className="font-sans font-semibold text-sm text-ink">{slot.duty_type?.name ?? '—'}</p>
                      <p className="font-sans text-xs text-ink-muted">{slot.assigned_count}/{slot.capacity} filled</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {myClaim && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success-soft text-success">Signed up</span>
                      )}
                      {!myClaim && isFull && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-sunken text-ink-muted">Full</span>
                      )}
                      {myClaim ? (
                        <button
                          onClick={() => handleUnclaim(slot.id)}
                          disabled={busySlotId === slot.id}
                          className="h-8 px-3 text-xs font-semibold font-sans text-ink-muted bg-surface border border-border-strong rounded-[8px] hover:bg-danger-soft hover:text-danger transition disabled:opacity-50"
                        >
                          {busySlotId === slot.id ? '…' : 'Cancel'}
                        </button>
                      ) : !isFull ? (
                        <button
                          onClick={() => handleClaim(slot.id)}
                          disabled={busySlotId === slot.id}
                          className="h-8 px-3 text-xs font-semibold font-sans bg-brand text-brand-on rounded-[8px] hover:bg-brand-hover transition disabled:opacity-50"
                        >
                          {busySlotId === slot.id ? '…' : 'Sign up'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}

function SectionPanel({ section }: { section: AssignedSection }) {
  const { getStatus, logAction, loading: attendanceLoading } = useAttendance(section.id)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const presentCount = section.students.filter(s => getStatus(s.id) === 'check_in').length

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function handleAction(studentId: string, studentName: string, action: AttendanceAction) {
    setBusyId(studentId)
    try {
      await logAction(studentId, section.id, action)
      showToast(action === 'check_in' ? `${studentName} checked in` : `${studentName} checked out`)
    } catch {
      showToast('Something went wrong — try again')
    } finally {
      setBusyId(null)
    }
  }

  async function markAllPresent() {
    for (const student of section.students) {
      if (getStatus(student.id) !== 'check_in') {
        await handleAction(student.id, student.full_name, 'check_in')
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="bg-surface border border-border rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-xl text-ink">{section.class_name}</h2>
          <p className="font-sans text-sm text-ink-muted mt-0.5">
            {section.label}{section.week ? ` · Week ${section.week}` : ''}
          </p>
        </div>
        {!attendanceLoading && (
          <div className="text-right">
            <p className="font-sans font-bold text-3xl text-ink tabular-nums leading-none">
              {presentCount}<span className="text-ink-muted font-normal text-xl">/{section.students.length}</span>
            </p>
            <p className="font-sans text-xs text-ink-muted mt-0.5">present</p>
          </div>
        )}
      </div>

      {/* Mark all */}
      {!attendanceLoading && presentCount < section.students.length && (
        <button
          onClick={markAllPresent}
          disabled={busyId !== null}
          className="w-full h-11 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 hover:bg-success-soft hover:text-success hover:border-success/30 transition disabled:opacity-50"
        >
          <CheckCheck size={16} /> Mark all present
        </button>
      )}

      {/* Roster */}
      {section.students.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
          <p className="font-sans text-ink-muted text-sm">No students enrolled in this section yet.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          {section.students.map(student => (
            <AttendanceRow
              key={student.id}
              student={student}
              status={getStatus(student.id)}
              onAction={action => handleAction(student.id, student.full_name, action)}
              busy={busyId === student.id}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 max-w-xs px-4 py-3 bg-surface-raised border-l-4 border-success rounded-xl shadow-lg font-sans text-sm font-semibold text-ink">
          {toast}
        </div>
      )}
    </div>
  )
}

export default function VolunteerDashboard() {
  const { profile, signOut, user } = useAuth()
  const { assignedSections, isAccepted, loading } = useAssignedClass()

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar */}
      <header className="h-16 bg-ink-900 flex items-center justify-between px-6 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
            <span className="font-sans font-bold text-brand-on text-sm">S</span>
          </div>
          <span className="font-sans font-bold text-white text-base tracking-tight">Steel City Codes</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-role-volunteer-soft text-role-volunteer">
            <Users size={12} /> Volunteer
          </span>
          <span className="font-sans text-sm text-white/70">{profile?.display_name}</span>
          <button onClick={signOut} className="font-sans text-sm text-white/60 hover:text-white transition">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 bg-surface-sunken rounded-xl animate-pulse" />
            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 border-b border-border last:border-0 px-4 py-3 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-surface-sunken" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-surface-sunken rounded w-1/3" />
                    <div className="h-2 bg-surface-sunken rounded w-1/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !isAccepted ? (
          /* Application pending — volunteer role set but no volunteers row yet */
          <div className="bg-surface border border-border rounded-xl shadow-sm p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-warning-soft flex items-center justify-center mx-auto mb-4">
              <Clock size={24} className="text-warning" />
            </div>
            <h2 className="font-sans font-semibold text-xl text-ink mb-2">Application under review</h2>
            <p className="font-sans text-ink-muted text-base">
              Your application is being reviewed. You'll be notified once an admin accepts it and assigns you to a section.
            </p>
          </div>
        ) : assignedSections.length === 0 ? (
          /* Accepted but not yet assigned to any section */
          <>
            <div className="bg-surface border border-border rounded-xl shadow-sm p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-role-volunteer-soft flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-role-volunteer" />
              </div>
              <h2 className="font-sans font-semibold text-xl text-ink mb-2">No section assigned yet</h2>
              <p className="font-sans text-ink-muted text-base">An admin will assign you to a section before camp starts.</p>
            </div>
            <div className="space-y-3">
              <h2 className="font-sans font-bold text-xl text-ink">Duty schedule</h2>
              <DutyPanel userId={user!.id} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-sans font-bold text-2xl text-ink">My sections</h1>
              <p className="font-sans text-sm text-ink-muted">{today}</p>
            </div>
            <div className="space-y-8">
              {assignedSections.map(sec => (
                <SectionPanel key={sec.id} section={sec} />
              ))}
            </div>
            <div className="space-y-3">
              <h2 className="font-sans font-bold text-xl text-ink">Duty schedule</h2>
              <DutyPanel userId={user!.id} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
