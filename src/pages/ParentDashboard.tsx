import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations, type RegistrationWithSection } from '../hooks/useRegistrations'
import StudentCard from '../components/StudentCard'
import AddStudentForm from '../components/AddStudentForm'
import SessionStrip from '../components/SessionStrip'
import type { Student } from '../types/database'

// Status-aware subhead (§3 / DS §10): a warm, one-line rollup of real enrollment status.
function buildSubhead(students: Student[], registrations: RegistrationWithSection[]): string {
  if (students.length === 0) return 'Add your first camper to get started.'

  const active = registrations.filter(r => r.status !== 'cancelled')
  const pending = active.filter(r => r.status === 'pending' || r.status === 'waitlisted').length
  const subject = students.length === 1 ? 'Your camper is' : 'Your campers are'

  if (active.length === 0) {
    return students.length === 1
      ? "Your camper isn't signed up yet — browse classes to find a fit."
      : 'No sign-ups yet — browse classes to find a fit for your campers.'
  }
  if (pending > 0) {
    const spots = pending === 1 ? 'one spot still to confirm' : `${pending} spots still to confirm`
    return `${subject} signed up — ${spots}.`
  }
  return `${subject} all set for camp.`
}

export default function ParentDashboard() {
  const { profile } = useAuth()
  const { students, loading, addStudent, updateStudent } = useStudents()
  const { registrations } = useRegistrations()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  async function handleSubmitStudent(payload: Pick<Student, 'full_name' | 'age' | 'medical_info'>) {
    if (editingStudent) await updateStudent(editingStudent.id, payload)
    else await addStudent(payload)
  }

  const subhead = buildSubhead(students, registrations)

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-sans text-[40px] leading-[46px] font-bold tracking-[-0.01em] text-ink mb-1">
              Welcome, {profile?.display_name?.split(' ')[0]}
            </h1>
            <p className="font-slab text-ink-muted text-lg">{subhead}</p>
          </div>

          {/* Action hierarchy (§3): one secondary (Browse classes) + one gold primary (Add camper).
              The per-camper Register action now lives on each StudentCard footer. */}
          <div className="flex gap-3">
            <Link
              to="/parent/classes"
              className="h-11 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition shadow-sm"
            >
              <GraduationCap size={16} />
              Browse classes
            </Link>
            <button
              onClick={() => setShowAddForm(true)}
              className="h-11 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 transition shadow-sm"
            >
              <Plus size={16} />
              Add camper
            </button>
          </div>
        </div>

        <SessionStrip />

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-surface border border-border rounded-xl shadow-sm p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={24} className="text-warning" />
            </div>
            <h2 className="font-sans font-semibold text-xl text-ink mb-2">No campers yet</h2>
            <p className="font-slab text-ink-muted mb-6">Add your first camper to get started.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="h-11 px-5 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] inline-flex items-center gap-2 transition shadow-sm"
            >
              <Plus size={16} /> Add camper
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map(student => (
              <StudentCard
                key={student.id}
                student={student}
                registrations={registrations.filter(r => r.student_id === student.id)}
                onEdit={setEditingStudent}
              />
            ))}
          </div>
        )}

      {(showAddForm || editingStudent) && (
        <AddStudentForm
          student={editingStudent}
          onSubmit={handleSubmitStudent}
          onClose={() => {
            setShowAddForm(false)
            setEditingStudent(null)
          }}
        />
      )}
    </div>
  )
}
