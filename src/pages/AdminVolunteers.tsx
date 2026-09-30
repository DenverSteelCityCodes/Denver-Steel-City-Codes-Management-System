import { useState } from 'react'
import { Wand2, Check, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Download } from 'lucide-react'
import { useVolunteers } from '../hooks/useVolunteers'
import { useAdminClasses } from '../hooks/useAdminClasses'
import { useAppSettings } from '../hooks/useAppSettings'
import { useVolunteerApplications } from '../hooks/useVolunteerApplications'
import { matchVolunteers, type AssignmentPair } from '../lib/volunteerMatcher'
import DataTable from '../components/DataTable'
import type { VolunteerWithProfile } from '../hooks/useVolunteers'
import type { VolunteerApplication, ExperienceLevel } from '../types/database'

function exportVolunteerCSV(
  volunteers: import('../hooks/useVolunteers').VolunteerWithProfile[],
  classes: import('../hooks/useAdminClasses').ClassWithSections[]
) {
  const headers = ['Name', 'Experience Level', 'Week 1', 'Week 2', 'Assigned Class', 'Section', 'Role', 'Interview Notes']
  const rows: string[][] = []

  const allSections = classes.flatMap(c => c.sections.map(s => ({ ...s, className: c.name })))

  for (const v of volunteers) {
    const leadSections = allSections.filter(s => s.lead_id === v.id)
    const supportSections = allSections.filter(s => s.supports.some(sup => sup.id === v.id))

    const assignments = [
      ...leadSections.map(s => ({ className: s.className, label: s.label, role: 'lead' })),
      ...supportSections.map(s => ({ className: s.className, label: s.label, role: 'support' })),
    ]

    if (assignments.length === 0) {
      rows.push([
        v.profiles.display_name,
        v.experience_level,
        v.availability_week_1 ? 'Yes' : 'No',
        v.availability_week_2 ? 'Yes' : 'No',
        '', '', '', v.interview_notes ?? '',
      ])
    } else {
      for (const a of assignments) {
        rows.push([
          v.profiles.display_name,
          v.experience_level,
          v.availability_week_1 ? 'Yes' : 'No',
          v.availability_week_2 ? 'Yes' : 'No',
          a.className,
          a.label,
          a.role,
          v.interview_notes ?? '',
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
  a.download = `volunteers-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportApplicationsCSV(apps: import('../types/database').VolunteerApplication[]) {
  const headers = [
    'Name', 'Email', 'Phone', 'Age', 'Grade', 'School', 'Shirt Size',
    'Week 1', 'Week 2', 'Status', '1st Choice', '2nd Choice', 'CS Languages', 'Interview Notes'
  ]
  const rows = apps.map(a => [
    `${a.first_name} ${a.last_name}`,
    a.email, a.phone, String(a.age), a.grade, a.school, a.shirt_size,
    a.availability_week_1 ? 'Yes' : 'No',
    a.availability_week_2 ? 'Yes' : 'No',
    a.status,
    a.course_first_choice,
    a.course_second_choice,
    a.cs_languages.join('; '),
    a.admin_notes ?? '',
  ])

  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `volunteer-applications-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type Tab = 'roster' | 'applications'
type AppFilter = 'all' | 'pending' | 'accepted' | 'rejected'

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-warning-soft text-warning',
  accepted: 'bg-success-soft text-success',
  rejected: 'bg-danger-soft text-danger',
}

function ApplicationReviewModal({
  app,
  onAccept,
  onReject,
  onClose,
}: {
  app: VolunteerApplication
  onAccept: (app: VolunteerApplication, expLevel: ExperienceLevel) => Promise<void>
  onReject: (appId: string, notes?: string) => Promise<void>
  onClose: () => void
}) {
  const [mode, setMode] = useState<'view' | 'accept' | 'reject'>('view')
  const [expLevel, setExpLevel] = useState<ExperienceLevel>('junior')
  const [rejectNotes, setRejectNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleAccept() {
    setBusy(true)
    setActionError(null)
    try {
      await onAccept(app, expLevel)
      onClose()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    setBusy(true)
    setActionError(null)
    try {
      await onReject(app.id, rejectNotes || undefined)
      onClose()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const skills: { label: string; value: number | null }[] = [
    { label: 'Python', value: app.skill_python },
    { label: 'Java', value: app.skill_java },
    { label: 'HTML', value: app.skill_html },
    { label: 'CSS', value: app.skill_css },
    { label: 'JavaScript', value: app.skill_javascript },
    { label: 'Microcontrollers', value: app.skill_microcontrollers },
  ].filter(s => s.value !== null)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-sans font-bold text-lg text-ink">
              {app.first_name} {app.last_name}
            </h2>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[app.status] ?? ''}`}>
              {app.status}
            </span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition">
            <X size={20} />
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5 text-sm font-sans">

          {/* Personal */}
          <section className="space-y-2">
            <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Contact</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-ink">
              <span className="text-ink-muted">Email</span><span>{app.email}</span>
              <span className="text-ink-muted">Phone</span><span>{app.phone}</span>
              <span className="text-ink-muted">Age</span><span>{app.age}</span>
              <span className="text-ink-muted">Grade</span><span>{app.grade}</span>
              <span className="text-ink-muted">School</span><span>{app.school}</span>
              <span className="text-ink-muted">Shirt size</span><span>{app.shirt_size}</span>
            </div>
          </section>

          {/* Availability */}
          <section className="space-y-2">
            <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Availability</p>
            <div className="flex gap-3">
              {[
                { label: 'Session 1 (Jun 1–5)', v: app.availability_week_1 },
                { label: 'Session 2 (Jun 8–12)', v: app.availability_week_2 },
              ].map(({ label, v }) => (
                <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  v ? 'bg-success-soft text-success' : 'bg-surface-sunken text-ink-muted border border-border-strong'
                }`}>
                  {v ? <Check size={12} /> : <X size={12} />} {label}
                </span>
              ))}
            </div>
          </section>

          {/* Qualifications */}
          <section className="space-y-2">
            <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Qualifications</p>
            <div className="space-y-3">
              <div>
                <p className="text-ink-muted text-xs mb-1">Why they want to volunteer</p>
                <p className="text-ink bg-surface-sunken rounded-[10px] p-3">{app.why_volunteer}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-ink">
                <span className="text-ink-muted">Previous SCC volunteer</span>
                <span>{app.previous_scc_volunteer ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <p className="text-ink-muted text-xs mb-1">CS languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {app.cs_languages.map(l => (
                    <span key={l} className="px-2.5 py-1 rounded-full bg-surface-sunken border border-border-strong text-xs font-semibold text-ink">{l}</span>
                  ))}
                </div>
              </div>
              {app.cs_classes && (
                <div>
                  <p className="text-ink-muted text-xs mb-1">CS classes taken</p>
                  <p className="text-ink">{app.cs_classes}</p>
                </div>
              )}
              {app.experience_children && (
                <div>
                  <p className="text-ink-muted text-xs mb-1">Experience with children</p>
                  <p className="text-ink bg-surface-sunken rounded-[10px] p-3 whitespace-pre-line">{app.experience_children}</p>
                </div>
              )}
            </div>
          </section>

          {/* Skills */}
          {skills.length > 0 && (
            <section className="space-y-2">
              <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Skill levels</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-ink">
                {skills.map(({ label, value }) => (
                  <>
                    <span key={label + 'l'} className="text-ink-muted">{label}</span>
                    <span key={label + 'v'} className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={`w-3 h-3 rounded-full ${i < (value ?? 0) ? 'bg-brand' : 'bg-border-strong'}`} />
                      ))}
                      <span className="ml-1 text-ink-muted text-xs">{value}/5</span>
                    </span>
                  </>
                ))}
              </div>
            </section>
          )}

          {/* Course preferences */}
          <section className="space-y-2">
            <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Course preferences</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-ink">
              <span className="text-ink-muted">First choice</span><span>{app.course_first_choice}</span>
              <span className="text-ink-muted">Second choice</span><span>{app.course_second_choice}</span>
              {app.other_curricula && (
                <><span className="text-ink-muted">Other curricula</span><span>{app.other_curricula}</span></>
              )}
            </div>
          </section>

          {/* Waiver */}
          <section className="space-y-1">
            <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted">Waiver</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-ink">
              <span className="text-ink-muted">Volunteer signature</span><span className="italic">{app.volunteer_signature}</span>
              {app.guardian_signature && (
                <><span className="text-ink-muted">Guardian signature</span><span className="italic">{app.guardian_signature}</span></>
              )}
              <span className="text-ink-muted">Interview confirmed</span>
              <span className={app.interview_confirmed ? 'text-success' : 'text-danger'}>
                {app.interview_confirmed ? 'Yes' : 'No'}
              </span>
            </div>
          </section>

          {app.admin_notes && (
            <section className="bg-surface-sunken border border-border rounded-[10px] p-3">
              <p className="font-semibold text-xs uppercase tracking-widest text-ink-muted mb-1">Admin notes</p>
              <p className="text-ink">{app.admin_notes}</p>
            </section>
          )}
        </div>

        {/* Modal footer — actions */}
        {app.status === 'pending' && (
          <div className="px-6 py-4 border-t border-border shrink-0 space-y-3">
            {actionError && (
              <p className="text-danger text-sm font-sans">⚠ {actionError}</p>
            )}

            {mode === 'view' && (
              <div className="flex gap-3">
                <button onClick={() => setMode('accept')}
                  className="flex-1 h-10 bg-success-soft text-success font-sans font-semibold text-sm rounded-[10px] border border-success/30 hover:bg-success/10 transition">
                  Accept
                </button>
                <button onClick={() => setMode('reject')}
                  className="flex-1 h-10 bg-danger-soft text-danger font-sans font-semibold text-sm rounded-[10px] border border-danger/30 hover:bg-danger/10 transition">
                  Reject
                </button>
              </div>
            )}

            {mode === 'accept' && (
              <div className="space-y-3">
                <div>
                  <label className="block font-sans font-semibold text-sm text-ink mb-1.5">Experience level</label>
                  <div className="flex gap-3">
                    {(['junior', 'senior'] as const).map(l => (
                      <button key={l} type="button" onClick={() => setExpLevel(l)}
                        className={`flex-1 h-10 rounded-[10px] font-sans font-semibold text-sm border capitalize transition ${
                          expLevel === l ? 'bg-brand text-brand-on border-brand' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
                        }`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setMode('view')} className="h-10 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition">
                    Cancel
                  </button>
                  <button onClick={handleAccept} disabled={busy}
                    className="flex-1 h-10 bg-success-soft text-success font-sans font-semibold text-sm rounded-[10px] border border-success/30 hover:bg-success/10 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {busy ? <span className="w-3.5 h-3.5 rounded-full border-2 border-success border-t-transparent animate-spin" /> : <Check size={14} />}
                    Confirm accept as {expLevel}
                  </button>
                </div>
              </div>
            )}

            {mode === 'reject' && (
              <div className="space-y-3">
                <div>
                  <label className="block font-sans font-semibold text-sm text-ink mb-1.5">Reason / notes <span className="font-normal text-ink-muted">(optional)</span></label>
                  <textarea
                    className="w-full px-3.5 py-2.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition resize-none"
                    rows={2} placeholder="e.g. Didn't attend interview…"
                    value={rejectNotes} onChange={e => setRejectNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setMode('view')} className="h-10 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition">
                    Cancel
                  </button>
                  <button onClick={handleReject} disabled={busy}
                    className="flex-1 h-10 bg-danger-soft text-danger font-sans font-semibold text-sm rounded-[10px] border border-danger/30 hover:bg-danger/10 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {busy ? <span className="w-3.5 h-3.5 rounded-full border-2 border-danger border-t-transparent animate-spin" /> : <X size={14} />}
                    Confirm reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminVolunteers() {
  const { volunteers, loading: vLoading } = useVolunteers()
  const { classes, updateSection, refetch: refetchClasses } = useAdminClasses()
  const { settings, loading: settingsLoading, updateSetting } = useAppSettings()
  const { applications, loading: appsLoading, acceptApplication, rejectApplication } = useVolunteerApplications()

  const [tab, setTab] = useState<Tab>('roster')
  const [week, setWeek] = useState<1 | 2>(1)
  const [preview, setPreview] = useState<AssignmentPair[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [appFilter, setAppFilter] = useState<AppFilter>('pending')
  const [reviewApp, setReviewApp] = useState<VolunteerApplication | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const applicationsOpen = settings['volunteer_applications_open'] === 'true'
  const pendingCount = applications.filter(a => a.status === 'pending').length
  const filteredApps = appFilter === 'all' ? applications : applications.filter(a => a.status === appFilter)

  function runMatcher() {
    setApplied(false)
    const allSections = classes.flatMap(c => c.sections)
    setPreview(matchVolunteers(volunteers, allSections, week))
  }

  async function applyAssignments() {
    if (!preview) return
    setApplying(true)
    try {
      await Promise.all(
        preview
          .filter(p => p.lead || p.support)
          .map(p =>
            updateSection(
              p.sectionId,
              p.lead ? { lead_id: p.lead.id } : {},
              p.support ? [p.support.id] : undefined,
            )
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
      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">

        {/* Tab bar */}
        <div className="flex rounded-xl border border-border-strong overflow-hidden w-fit">
          {([
            { key: 'roster', label: 'Roster' },
            { key: 'applications', label: `Applications${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`h-10 px-5 font-sans font-semibold text-sm transition ${
                tab === key ? 'bg-brand text-brand-on' : 'bg-surface text-ink hover:bg-surface-sunken'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Roster tab ── */}
        {tab === 'roster' && (
          <div className="space-y-10">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="font-sans font-bold text-2xl text-ink">Volunteer roster</h1>
                <button
                  onClick={() => exportVolunteerCSV(volunteers, classes)}
                  className="h-9 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition"
                >
                  <Download size={15} /> Export CSV
                </button>
              </div>
              <DataTable
                columns={volunteerColumns}
                rows={volunteers}
                keyFn={v => v.id}
                loading={vLoading}
                emptyMessage="No volunteers registered yet."
              />
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-sans font-bold text-xl text-ink">Auto-assign volunteers</h2>
                  <p className="font-sans text-sm text-ink-muted mt-0.5">Pairs one senior + one junior per section based on week availability.</p>
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
                      {preview.map(p => {
                        const cls = classes.find(c => c.id === p.classId)
                        return (
                          <tr key={p.sectionId} className="border-b border-border last:border-0 hover:bg-surface-sunken/60 transition">
                            <td className="px-4 py-3.5 font-sans text-ink">
                              <span className="font-semibold">{cls?.name ?? '—'}</span>
                              <span className="text-ink-muted ml-1.5 text-xs">· {p.sectionLabel}{p.week ? ` W${p.week}` : ''}</span>
                            </td>
                            <td className="px-4 py-3.5 font-sans text-ink">
                              {p.lead ? p.lead.profiles.display_name : <span className="text-ink-faint">No senior available</span>}
                            </td>
                            <td className="px-4 py-3.5 font-sans text-ink">
                              {p.support ? p.support.profiles.display_name : <span className="text-ink-faint">No junior available</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Applications tab ── */}
        {tab === 'applications' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-sans font-bold text-2xl text-ink">Volunteer applications</h1>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportApplicationsCSV(applications)}
                  className="h-9 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition"
                >
                  <Download size={15} /> Export CSV
                </button>
                <button
                  onClick={() => updateSetting('volunteer_applications_open', applicationsOpen ? 'false' : 'true')}
                  disabled={settingsLoading}
                  className={`flex items-center gap-2 h-10 px-4 rounded-[10px] font-sans font-semibold text-sm border transition disabled:opacity-50 ${
                    applicationsOpen
                      ? 'bg-success-soft text-success border-success/30 hover:bg-success/10'
                      : 'bg-surface border-border-strong text-ink-muted hover:bg-surface-sunken'
                  }`}
                >
                  {applicationsOpen
                    ? <><ToggleRight size={18} /> Applications open</>
                    : <><ToggleLeft size={18} /> Applications closed</>}
                </button>
              </div>
            </div>

            {applicationsOpen && (
              <div className="flex items-center gap-2 text-xs font-sans text-success bg-success-soft border border-success/20 rounded-[10px] px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Application form at <span className="font-semibold ml-1">/apply</span> is live — share this link or a QR code to advertise.
              </div>
            )}

            {/* Filter pills */}
            <div className="flex gap-2">
              {(['all', 'pending', 'accepted', 'rejected'] as AppFilter[]).map(f => {
                const count = f === 'all' ? applications.length : applications.filter(a => a.status === f).length
                return (
                  <button key={f} onClick={() => setAppFilter(f)}
                    className={`h-8 px-3.5 rounded-full font-sans font-semibold text-xs capitalize border transition ${
                      appFilter === f ? 'bg-brand text-brand-on border-brand' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
                    }`}>
                    {f} ({count})
                  </button>
                )
              })}
            </div>

            {/* Applications list */}
            {appsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-surface border border-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="bg-surface border border-border rounded-xl p-10 text-center">
                <p className="font-sans text-ink-muted text-sm">No {appFilter === 'all' ? '' : appFilter} applications yet.</p>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                {filteredApps.map((app, idx) => (
                  <div key={app.id} className={idx < filteredApps.length - 1 ? 'border-b border-border' : ''}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-sunken/60 transition text-left"
                      onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                          <span className="font-sans font-bold text-sm text-brand">
                            {app.first_name[0]}{app.last_name[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-sans font-semibold text-sm text-ink truncate">
                            {app.first_name} {app.last_name}
                          </p>
                          <p className="font-sans text-xs text-ink-muted truncate">{app.school} · {app.grade}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <div className="flex gap-1.5 text-xs font-sans text-ink-muted">
                          {app.availability_week_1 && <span className="px-1.5 py-0.5 bg-success-soft text-success rounded font-semibold">W1</span>}
                          {app.availability_week_2 && <span className="px-1.5 py-0.5 bg-success-soft text-success rounded font-semibold">W2</span>}
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[app.status] ?? ''}`}>
                          {app.status}
                        </span>
                        {expandedId === app.id ? <ChevronUp size={16} className="text-ink-muted" /> : <ChevronDown size={16} className="text-ink-muted" />}
                      </div>
                    </button>

                    {expandedId === app.id && (
                      <div className="px-4 pb-4 pt-1 border-t border-border bg-surface-sunken/40">
                        <div className="flex flex-wrap gap-4 text-sm font-sans mb-3">
                          <span className="text-ink-muted">Email: <span className="text-ink">{app.email}</span></span>
                          <span className="text-ink-muted">Age: <span className="text-ink">{app.age}</span></span>
                          <span className="text-ink-muted">1st choice: <span className="text-ink">{app.course_first_choice}</span></span>
                          <span className="text-ink-muted">2nd choice: <span className="text-ink">{app.course_second_choice}</span></span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {app.cs_languages.map(l => (
                            <span key={l} className="px-2 py-0.5 rounded-full bg-surface border border-border-strong text-xs font-semibold text-ink">{l}</span>
                          ))}
                        </div>
                        <button
                          onClick={() => setReviewApp(app)}
                          className="h-8 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-xs rounded-[10px] hover:bg-surface-sunken transition"
                        >
                          Full review
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {reviewApp && (
        <ApplicationReviewModal
          app={reviewApp}
          onAccept={acceptApplication}
          onReject={rejectApplication}
          onClose={() => setReviewApp(null)}
        />
      )}
    </div>
  )
}
