import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { useClasses } from '../hooks/useClasses'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations } from '../hooks/useRegistrations'
import ClassCard from '../components/ClassCard'

export default function ClassBrowser() {
  const navigate = useNavigate()
  const { classes, loading: classesLoading } = useClasses()
  const { students } = useStudents()
  const { registrations, registerStudent, isRegistered } = useRegistrations()

  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [registeringClassId, setRegisteringClassId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null)

  const selectedStudent = students.find(s => s.id === selectedStudentId)

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.age_group.toLowerCase().includes(search.toLowerCase())
  )

  function showToast(message: string, type: 'success' | 'info') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleRegister(classId: string, currentCount: number, capacity: number) {
    if (!selectedStudentId) return
    setRegisteringClassId(classId)
    try {
      const reg = await registerStudent(selectedStudentId, classId, currentCount, capacity)
      const msg = reg.status === 'waitlisted'
        ? `${selectedStudent?.full_name} added to the waitlist.`
        : `${selectedStudent?.full_name} registered! Pending confirmation.`
      showToast(msg, reg.status === 'waitlisted' ? 'info' : 'success')
    } catch {
      showToast('Something went wrong. Please try again.', 'info')
    } finally {
      setRegisteringClassId(null)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-16 bg-ink-900 flex items-center px-6 gap-4 shadow-sm">
        <button onClick={() => navigate('/parent')} className="text-white/60 hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <span className="font-sans font-bold text-white text-base tracking-tight">Browse classes</span>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Student picker */}
          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition sm:w-64"
          >
            <option value="">Select a camper to enroll…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search classes…"
              className="w-full h-11 pl-9 pr-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition"
            />
          </div>
        </div>

        {!selectedStudentId && (
          <p className="text-sm font-sans text-ink-muted bg-warning-soft text-warning px-4 py-3 rounded-[10px]">
            Select a camper above to register them for a class.
          </p>
        )}

        {classesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-surface border border-border rounded-xl shadow-sm p-5 animate-pulse h-40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-sans text-ink-muted">No classes found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => {
              const existingReg = selectedStudentId
                ? registrations.find(r => r.student_id === selectedStudentId && r.class_id === c.id)
                : undefined

              return (
                <ClassCard
                  key={c.id}
                  classData={c}
                  registrationStatus={existingReg?.status}
                  studentName={selectedStudent?.full_name}
                  onRegister={
                    selectedStudentId && !isRegistered(selectedStudentId, c.id)
                      ? () => handleRegister(c.id, c.registered_count, c.capacity)
                      : undefined
                  }
                  registering={registeringClassId === c.id}
                />
              )
            })}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 max-w-sm px-4 py-3 rounded-xl shadow-lg font-sans text-sm font-semibold border-l-4 ${
          toast.type === 'success'
            ? 'bg-surface-raised border-success text-ink'
            : 'bg-surface-raised border-info text-ink'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
