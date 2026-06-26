import { useState, useMemo } from 'react'
import { Search, Download, X, AlertCircle, UserCheck } from 'lucide-react'
import { useAdminStudents, type AdminStudent } from '../hooks/useAdminStudents'
import { useAdminClasses } from '../hooks/useAdminClasses'
import type { RegistrationStatus } from '../types/database'

const STATUS_BADGE: Record<RegistrationStatus, string> = {
  confirmed:  'bg-success-soft text-success',
  pending:    'bg-warning-soft text-warning',
  waitlisted: 'bg-surface-sunken text-ink-muted border border-border-strong',
  cancelled:  'bg-danger-soft text-danger',
}

function StudentDetailModal({
  student,
  allSections,
  onStatusChange,
  onMoveSection,
  onRemoveReg,
  onClose,
}: {
  student: AdminStudent
  allSections: { id: string; label: string; class_name: string; week: 1 | 2 | null }[]
  onStatusChange: (regId: string, status: RegistrationStatus) => Promise<void>
  onMoveSection: (regId: string, sectionId: string) => Promise<void>
  onRemoveReg: (regId: string) => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setErr(null)
    try { await fn() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-sans font-bold text-lg text-ink">{student.full_name}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5 text-sm font-sans">
          <section className="space-y-1.5">
            <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Student info</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-ink">
              <span className="text-ink-muted">Age</span><span>{student.age}</span>
              <span className="text-ink-muted">Parent</span><span>{student.parent_name}</span>
              {student.medical_info && (
                <>
                  <span className="text-ink-muted">Medical notes</span>
                  <span className="text-danger font-semibold">{student.medical_info}</span>
                </>
              )}
              <span className="text-ink-muted">Added</span>
              <span>{new Date(student.created_at).toLocaleDateString()}</span>
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Registrations</p>
            {student.registrations.length === 0 ? (
              <p className="text-ink-muted text-xs">No registrations yet.</p>
            ) : (
              <div className="space-y-3">
                {student.registrations.map(reg => (
                  <div key={reg.id} className="bg-surface-sunken border border-border rounded-[10px] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-ink">{reg.class_name}</p>
                        <p className="text-xs text-ink-muted">
                          {reg.section_label}{reg.section_week ? ` · Week ${reg.section_week}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[reg.status]}`}>
                        {reg.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['confirmed', 'pending', 'waitlisted', 'cancelled'] as RegistrationStatus[])
                        .filter(s => s !== reg.status)
                        .map(s => (
                          <button
                            key={s}
                            onClick={() => run(`status-${reg.id}-${s}`, () => onStatusChange(reg.id, s))}
                            disabled={!!busy}
                            className="h-7 px-3 rounded-full text-xs font-semibold border transition capitalize bg-surface border-border-strong text-ink hover:bg-surface-sunken disabled:opacity-40"
                          >
                            {busy === `status-${reg.id}-${s}`
                              ? <span className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin inline-block" />
                              : `→ ${s}`}
                          </button>
                        ))}
                      <button
                        onClick={() => run(`move-${reg.id}`, () => onRemoveReg(reg.id))}
                        disabled={!!busy}
                        className="h-7 px-3 rounded-full text-xs font-semibold border transition bg-danger-soft text-danger border-danger/30 hover:bg-danger/10 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-muted shrink-0">Move to:</span>
                      <select
                        className="flex-1 h-7 px-2 rounded-[6px] bg-surface border border-border-strong text-ink font-sans text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                        defaultValue=""
                        disabled={!!busy}
                        onChange={e => {
                          if (!e.target.value) return
                          run(`move-${reg.id}`, () => onMoveSection(reg.id, e.target.value))
                          e.target.value = ''
                        }}
                      >
                        <option value="">Select section…</option>
                        {allSections
                          .filter(s => s.id !== reg.section_id)
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {s.class_name} — {s.label}{s.week ? ` (W${s.week})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {err && (
            <div className="flex items-center gap-2 px-3 py-2 bg-danger-soft text-danger rounded-[8px] text-xs">
              <AlertCircle size={14} /> {err}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function exportStudentCSV(students: AdminStudent[]) {
  const headers = ['Student Name', 'Age', 'Medical Info', 'Parent Name', 'Class', 'Section', 'Week', 'Status']
  const rows: string[][] = []

  for (const s of students) {
    if (s.registrations.length === 0) {
      rows.push([s.full_name, String(s.age), s.medical_info ?? '', s.parent_name, '', '', '', 'unregistered'])
    } else {
      for (const r of s.registrations) {
        rows.push([
          s.full_name,
          String(s.age),
          s.medical_info ?? '',
          s.parent_name,
          r.class_name,
          r.section_label,
          r.section_week ? String(r.section_week) : '',
          r.status,
        ])
      }
    }
  }

  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `student-roster-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type StatusFilter = 'all' | RegistrationStatus | 'unregistered'

export default function AdminStudents() {
  const { students, loading, error, updateRegistrationStatus, moveStudentToSection, removeRegistration } = useAdminStudents()
  const { classes } = useAdminClasses()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<AdminStudent | null>(null)

  const allSections = useMemo(() =>
    classes.flatMap(c => c.sections.map(s => ({
      id: s.id,
      label: s.label,
      class_name: c.name,
      week: s.week,
    }))),
    [classes]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter(s => {
      const matchesSearch = !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'unregistered' && s.registrations.length === 0) ||
        s.registrations.some(r => r.status === statusFilter)

      return matchesSearch && matchesStatus
    })
  }, [students, search, statusFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length, unregistered: 0 }
    for (const s of students) {
      if (s.registrations.length === 0) counts.unregistered++
      for (const r of s.registrations) {
        counts[r.status] = (counts[r.status] ?? 0) + 1
      }
    }
    return counts
  }, [students])

  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-sans font-bold text-2xl text-ink">Students</h1>
          <button
            onClick={() => exportStudentCSV(filtered)}
            className="h-9 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Search by student or parent name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 pl-9 pr-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'confirmed', 'pending', 'waitlisted', 'cancelled', 'unregistered'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`h-8 px-3.5 rounded-full font-sans font-semibold text-xs capitalize border transition ${
                statusFilter === f ? 'bg-brand text-brand-on border-brand' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
              }`}
            >
              {f} ({statusCounts[f] ?? 0})
            </button>
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">⚠ {error}</div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-surface border border-border rounded-[14px] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
            <UserCheck size={28} className="text-ink-muted mx-auto mb-3" />
            <p className="font-sans font-semibold text-ink mb-1">No students found</p>
            <p className="font-sans text-sm text-ink-muted">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-[14px] overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/40">
                  <th className="px-5 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Student</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Age</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Parent</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Registrations</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Medical</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className={`cursor-pointer hover:bg-surface-sunken/50 transition ${idx < filtered.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                          <span className="font-sans font-bold text-xs text-brand">{s.full_name[0]}</span>
                        </div>
                        <span className="font-sans font-semibold text-sm text-ink">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-sans text-sm text-ink">{s.age}</td>
                    <td className="px-4 py-3.5 font-sans text-sm text-ink-muted">{s.parent_name}</td>
                    <td className="px-4 py-3.5">
                      {s.registrations.length === 0 ? (
                        <span className="text-xs text-ink-faint font-sans">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.registrations.map(r => (
                            <span key={r.id} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[r.status]}`}>
                              {r.class_name}{r.section_week ? ` W${r.section_week}` : ''} · {r.status}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {s.medical_info ? (
                        <span className="text-xs font-semibold text-danger">{s.medical_info.slice(0, 40)}{s.medical_info.length > 40 ? '…' : ''}</span>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-2.5 border-t border-border bg-surface-sunken/20">
              <p className="font-sans text-xs text-ink-muted">{filtered.length} student{filtered.length !== 1 ? 's' : ''} shown · click a row to view details</p>
            </div>
          </div>
        )}
      </main>

      {selected && (
        <StudentDetailModal
          student={selected}
          allSections={allSections}
          onStatusChange={async (id, status) => {
            await updateRegistrationStatus(id, status)
            setSelected(s => s ? { ...s, registrations: s.registrations.map(r => r.id === id ? { ...r, status } : r) } : null)
          }}
          onMoveSection={async (regId, sectionId) => {
            await moveStudentToSection(regId, sectionId)
            setSelected(null)
          }}
          onRemoveReg={async (regId) => {
            await removeRegistration(regId)
            setSelected(s => s ? { ...s, registrations: s.registrations.filter(r => r.id !== regId) } : null)
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
