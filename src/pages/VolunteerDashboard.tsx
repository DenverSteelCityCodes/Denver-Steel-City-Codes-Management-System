import { useState } from 'react'
import { Users, CheckCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAssignedClass } from '../hooks/useAssignedClass'
import { useAttendance } from '../hooks/useAttendance'
import AttendanceRow from '../components/AttendanceRow'
import type { AttendanceAction } from '../types/database'

export default function VolunteerDashboard() {
  const { profile, signOut } = useAuth()
  const { assignedClass, loading: classLoading } = useAssignedClass()
  const { getStatus, logAction, loading: attendanceLoading } = useAttendance(assignedClass?.id)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const students = assignedClass?.students ?? []
  const presentCount = students.filter(s => getStatus(s.id) === 'check_in').length

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function handleAction(studentId: string, studentName: string, action: AttendanceAction) {
    setBusyId(studentId)
    try {
      await logAction(studentId, assignedClass!.id, action)
      showToast(
        action === 'check_in'
          ? `${studentName} checked in`
          : `${studentName} checked out`
      )
    } catch {
      showToast('Something went wrong — try again')
    } finally {
      setBusyId(null)
    }
  }

  async function markAllPresent() {
    for (const student of students) {
      if (getStatus(student.id) !== 'check_in') {
        await handleAction(student.id, student.full_name, 'check_in')
      }
    }
  }

  const loading = classLoading || attendanceLoading

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
        ) : !assignedClass ? (
          <div className="bg-surface border border-border rounded-xl shadow-sm p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-role-volunteer-soft flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-role-volunteer" />
            </div>
            <h2 className="font-sans font-semibold text-xl text-ink mb-2">No class assigned yet</h2>
            <p className="font-slab text-ink-muted text-base">An admin will assign you to a class before camp starts.</p>
          </div>
        ) : (
          <>
            {/* Sticky class header */}
            <div className="bg-surface border border-border rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
              <div>
                <h1 className="font-sans font-bold text-xl text-ink">{assignedClass.name}</h1>
                <p className="font-sans text-sm text-ink-muted mt-0.5">{today}</p>
              </div>
              <div className="text-right">
                <p className="font-sans font-bold text-3xl text-ink tabular-nums leading-none">
                  {presentCount}<span className="text-ink-muted font-normal text-xl">/{students.length}</span>
                </p>
                <p className="font-sans text-xs text-ink-muted mt-0.5">present</p>
              </div>
            </div>

            {/* Mark all button */}
            {presentCount < students.length && (
              <button
                onClick={markAllPresent}
                disabled={busyId !== null}
                className="w-full h-11 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center justify-center gap-2 hover:bg-success-soft hover:text-success hover:border-success/30 transition disabled:opacity-50"
              >
                <CheckCheck size={16} />
                Mark all present
              </button>
            )}

            {/* Roster */}
            {students.length === 0 ? (
              <div className="bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
                <p className="font-sans text-ink-muted text-sm">No students enrolled in this class yet.</p>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                {students.map(student => (
                  <AttendanceRow
                    key={student.id}
                    student={student}
                    status={getStatus(student.id)}
                    onAction={(action) => handleAction(student.id, student.full_name, action)}
                    busy={busyId === student.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 max-w-xs px-4 py-3 bg-surface-raised border-l-4 border-success rounded-xl shadow-lg font-sans text-sm font-semibold text-ink">
          {toast}
        </div>
      )}
    </div>
  )
}
