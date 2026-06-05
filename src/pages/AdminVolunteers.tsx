import { useState } from 'react'
import { ArrowLeft, Wand2, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useVolunteers } from '../hooks/useVolunteers'
import { useAdminClasses } from '../hooks/useAdminClasses'
import { matchVolunteers, type AssignmentPair } from '../lib/volunteerMatcher'
import DataTable from '../components/DataTable'
import type { VolunteerWithProfile } from '../hooks/useVolunteers'

export default function AdminVolunteers() {
  const navigate = useNavigate()
  const { volunteers, loading: vLoading } = useVolunteers()
  const { classes, updateClass, refetch: refetchClasses } = useAdminClasses()

  const [week, setWeek] = useState<1 | 2>(1)
  const [preview, setPreview] = useState<AssignmentPair[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  function runMatcher() {
    setApplied(false)
    setPreview(matchVolunteers(volunteers, classes, week))
  }

  async function applyAssignments() {
    if (!preview) return
    setApplying(true)
    try {
      await Promise.all(
        preview
          .filter(p => p.lead || p.support)
          .map(p =>
            updateClass(p.classId, {
              ...(p.lead ? { lead_id: p.lead.id } : {}),
              ...(p.support ? { support_id: p.support.id } : {}),
            })
          )
      )
      await refetchClasses()
      setApplied(true)
      setPreview(null)
    } finally {
      setApplying(false)
    }
  }

  const volunteerColumns = [
    {
      header: 'Name',
      accessor: (v: VolunteerWithProfile) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{v.profiles.display_name}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            v.experience_level === 'senior'
              ? 'bg-brand-soft text-warning'
              : 'bg-surface-sunken text-ink-muted border border-border-strong'
          }`}>
            {v.experience_level}
          </span>
        </div>
      ),
    },
    {
      header: 'Week 1',
      accessor: (v: VolunteerWithProfile) => v.availability_week_1
        ? <Check size={16} className="text-success" />
        : <span className="text-ink-faint">—</span>,
    },
    {
      header: 'Week 2',
      accessor: (v: VolunteerWithProfile) => v.availability_week_2
        ? <Check size={16} className="text-success" />
        : <span className="text-ink-faint">—</span>,
    },
    {
      header: 'Notes',
      accessor: (v: VolunteerWithProfile) => (
        <span className="text-ink-muted text-xs truncate max-w-xs block">{v.interview_notes ?? '—'}</span>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-16 bg-ink-900 flex items-center px-6 gap-4 shadow-sm">
        <button onClick={() => navigate('/admin')} className="text-white/60 hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <span className="font-sans font-bold text-white text-base tracking-tight">Volunteers</span>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-10">

        {/* Roster */}
        <section className="space-y-4">
          <h1 className="font-sans font-bold text-2xl text-ink">Volunteer roster</h1>
          <DataTable
            columns={volunteerColumns}
            rows={volunteers}
            keyFn={v => v.id}
            loading={vLoading}
            emptyMessage="No volunteers registered yet."
          />
        </section>

        {/* Matcher */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans font-bold text-xl text-ink">Auto-assign volunteers</h2>
              <p className="font-sans text-sm text-ink-muted mt-0.5">Pairs one senior + one junior per class based on week availability.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-[10px] border border-border-strong overflow-hidden">
                {([1, 2] as const).map(w => (
                  <button
                    key={w}
                    onClick={() => { setWeek(w); setPreview(null); setApplied(false) }}
                    className={`h-9 px-4 font-sans font-semibold text-sm transition ${
                      week === w ? 'bg-brand text-brand-on' : 'bg-surface text-ink hover:bg-surface-sunken'
                    }`}
                  >
                    Week {w}
                  </button>
                ))}
              </div>
              <button
                onClick={runMatcher}
                className="h-9 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition"
              >
                <Wand2 size={15} /> Preview matches
              </button>
            </div>
          </div>

          {applied && (
            <div className="flex items-center gap-2 px-4 py-3 bg-success-soft text-success rounded-[10px] font-sans font-semibold text-sm">
              <Check size={16} /> Assignments applied successfully.
            </div>
          )}

          {preview && (
            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="bg-surface-sunken border-b border-border px-4 py-3 flex items-center justify-between">
                <p className="font-sans font-semibold text-sm text-ink">Week {week} preview — review before applying</p>
                <button
                  onClick={applyAssignments}
                  disabled={applying}
                  className="h-9 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                >
                  {applying
                    ? <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
                    : <Check size={14} />}
                  {applying ? 'Applying…' : 'Apply assignments'}
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Class</th>
                    <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Lead (senior)</th>
                    <th className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Support (junior)</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(p => (
                    <tr key={p.classId} className="border-b border-border last:border-0 hover:bg-surface-sunken/60 transition">
                      <td className="px-4 py-3.5 font-sans font-semibold text-ink">{p.className}</td>
                      <td className="px-4 py-3.5 font-sans text-ink">
                        {p.lead ? p.lead.profiles.display_name : <span className="text-ink-faint">No senior available</span>}
                      </td>
                      <td className="px-4 py-3.5 font-sans text-ink">
                        {p.support ? p.support.profiles.display_name : <span className="text-ink-faint">No junior available</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
