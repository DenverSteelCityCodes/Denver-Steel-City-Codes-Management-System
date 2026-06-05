import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Plus, GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations } from '../hooks/useRegistrations'
import StudentCard from '../components/StudentCard'
import AddStudentForm from '../components/AddStudentForm'
import type { Student } from '../types/database'

export default function ParentDashboard() {
  const { profile, signOut } = useAuth()
  const { students, loading, addStudent } = useStudents()
  const { registrations } = useRegistrations()
  const [showAddForm, setShowAddForm] = useState(false)

  async function handleAddStudent(payload: Pick<Student, 'full_name' | 'age' | 'medical_info'>) {
    await addStudent(payload)
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-16 bg-ink-900 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
            <span className="font-sans font-bold text-brand-on text-sm">S</span>
          </div>
          <span className="font-sans font-bold text-white text-base tracking-tight">Steel City Codes</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-role-parent-soft text-role-parent">
            <Heart size={12} /> Parent
          </span>
          <span className="font-sans text-sm text-white/70">{profile?.display_name}</span>
          <button onClick={signOut} className="font-sans text-sm text-white/60 hover:text-white transition">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-sans font-bold text-3xl text-ink mb-1">
              Welcome, {profile?.display_name?.split(' ')[0]}
            </h1>
            <p className="font-slab text-ink-muted text-lg">Manage your camper's enrollment.</p>
          </div>

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
              />
            ))}
          </div>
        )}
      </main>

      {showAddForm && (
        <AddStudentForm
          onAdd={handleAddStudent}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}
