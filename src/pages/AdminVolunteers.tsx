import { Fragment, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, Copy, Download, CalendarX2, CircleCheck, Hourglass } from 'lucide-react'
import { useVolunteers } from '../hooks/useVolunteers'
import { useAdminClasses } from '../hooks/useAdminClasses'
import { useAppSettings } from '../hooks/useAppSettings'
import { useVolunteerApplications } from '../hooks/useVolunteerApplications'
import { useInterviews } from '../hooks/useInterviews'
import { useSessions, campSessions, formatSessionDates } from '../hooks/useSessions'
import { matchVolunteers, type AssignmentPair } from '../lib/volunteerMatcher'
import { formatCampSlot } from '../lib/denverTime'
import { shortRange } from '../lib/weekRange'
import { telHref } from '../lib/campers'
import Button from '../components/Button'
import { Textarea, Select } from '../components/Field'
import InlineConfirm from '../components/InlineConfirm'
import Segmented from '../components/Segmented'
import StatusWord from '../components/StatusWord'
import AdminPageHead, { pageClass } from '../components/AdminPageHead'
import type { VolunteerWithProfile } from '../hooks/useVolunteers'
import type { ClassWithSections } from '../hooks/useAdminClasses'
import type { VolunteerApplication, ExperienceLevel } from '../types/database'

function exportVolunteerCSV(volunteers: VolunteerWithProfile[], classes: ClassWithSections[]) {
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

function exportApplicationsCSV(apps: VolunteerApplication[]) {
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

type Tab = 'applications' | 'crew'
type AppFilter = 'all' | 'pending' | 'accepted' | 'rejected'

const weeksText = (w1: boolean, w2: boolean) =>
  w1 && w2 ? 'Weeks 1, 2' : w1 ? 'Week 1' : w2 ? 'Week 2' : 'No weeks picked'

function appliedAgo(iso: string, now = Date.now()) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'applied today'
  if (days === 1) return 'applied yesterday'
  if (days < 30) return `applied ${days} days ago`
  return `applied ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// The full application, shown under its row: facts as a two-column list with plain labels, the
// applicant's own words beside them, then the decision. Accept is the view's primary; Reject is a
// text action that asks first, with an optional reason.
function ApplicationReview({
  app,
  weekLabels,
  onAccept,
  onReject,
}: {
  app: VolunteerApplication
  weekLabels: [string, string]
  onAccept: (app: VolunteerApplication, expLevel: ExperienceLevel) => Promise<void>
  onReject: (appId: string, notes?: string) => Promise<void>
}) {
  const [expLevel, setExpLevel] = useState<ExperienceLevel>('junior')
  const [rejecting, setRejecting] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const rejectButton = useRef<HTMLButtonElement>(null)

  async function handleAccept() {
    setBusy('accept')
    setActionError(null)
    try {
      await onAccept(app, expLevel)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function handleReject() {
    setBusy('reject')
    setActionError(null)
    try {
      await onReject(app.id, rejectNotes || undefined)
      setRejecting(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  function cancelReject() {
    setRejecting(false)
    requestAnimationFrame(() => rejectButton.current?.focus())
  }

  const skills = [
    { label: 'Python', value: app.skill_python },
    { label: 'Java', value: app.skill_java },
    { label: 'HTML', value: app.skill_html },
    { label: 'CSS', value: app.skill_css },
    { label: 'JavaScript', value: app.skill_javascript },
    { label: 'Microcontrollers', value: app.skill_microcontrollers },
  ].filter(s => s.value !== null)
  const weeks = [app.availability_week_1 && weekLabels[0], app.availability_week_2 && weekLabels[1]].filter(Boolean)
  const name = `${app.first_name} ${app.last_name}`

  const facts: [string, React.ReactNode][] = [
    ['Email', app.email],
    ['Phone', <a key="tel" href={telHref(app.phone)} className="font-bold underline underline-offset-[3px]">{app.phone}</a>],
    ['Age', String(app.age)],
    ['Grade', app.grade],
    ['School', app.school],
    ['Shirt size', app.shirt_size],
    ['Weeks', weeks.length ? weeks.join(' and ') : 'Neither week'],
    ['Courses', `1st ${app.course_first_choice} · 2nd ${app.course_second_choice}`],
    ...(app.other_curricula ? [['Other curricula', app.other_curricula] as [string, React.ReactNode]] : []),
    ['Languages', app.cs_languages.length ? app.cs_languages.join(', ') : 'None listed'],
    ...(app.cs_classes ? [['CS classes', app.cs_classes] as [string, React.ReactNode]] : []),
    ...(skills.length ? [['Skill levels', skills.map(s => `${s.label} ${s.value}/5`).join(' · ')] as [string, React.ReactNode]] : []),
    ['Volunteered before', app.previous_scc_volunteer ? 'Yes' : 'No'],
    ['Signatures', app.guardian_signature ? `${app.volunteer_signature} and ${app.guardian_signature} (guardian)` : app.volunteer_signature],
    ['Signed up for an interview', app.interview_confirmed ? 'Yes' : 'No'],
  ]

  return (
    <div className="pb-6">
      <div className="grid gap-x-8 gap-y-6 min-[1100px]:grid-cols-[5fr_7fr]">
        <dl className="grid grid-cols-1 min-[480px]:grid-cols-[minmax(8rem,max-content)_1fr] gap-x-4 gap-y-1 min-[480px]:gap-y-2 items-baseline">
          {facts.map(([dt, dd]) => (
            <Fragment key={dt}>
              <dt className="text-sm font-bold text-ink-muted">{dt}</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere] max-[479px]:mb-2">{dd}</dd>
            </Fragment>
          ))}
        </dl>
        <div className="space-y-5 min-w-0">
          <div>
            <p className="font-bold">Why {app.first_name} wants to volunteer</p>
            <p className="mt-1 max-w-[68ch] text-pretty whitespace-pre-line">{app.why_volunteer}</p>
          </div>
          {app.experience_children && (
            <div>
              <p className="font-bold">Experience with children</p>
              <p className="mt-1 max-w-[68ch] text-pretty whitespace-pre-line">{app.experience_children}</p>
            </div>
          )}
          {app.admin_notes && (
            <div>
              <p className="font-bold">Admin notes</p>
              <p className="mt-1 max-w-[68ch] text-pretty whitespace-pre-line">{app.admin_notes}</p>
            </div>
          )}
        </div>
      </div>

      {app.status === 'pending' && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div>
              <p className="font-bold mb-1.5" aria-hidden="true">Accept as</p>
              <Segmented
                label={`Accept ${name} as`}
                value={expLevel}
                onChange={setExpLevel}
                disabled={busy !== null}
                options={[{ value: 'junior', label: 'Junior' }, { value: 'senior', label: 'Senior' }]}
              />
            </div>
            <Button variant="primary" onClick={handleAccept} disabled={busy !== null} aria-busy={busy === 'accept'}>
              {busy === 'accept'
                ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
              {busy === 'accept' ? 'Accepting…' : `Accept ${app.first_name} as ${expLevel}`}
            </Button>
            {!rejecting && (
              <Button ref={rejectButton} variant="text" onClick={() => { setActionError(null); setRejecting(true) }} disabled={busy !== null}>
                Reject
              </Button>
            )}
          </div>

          {rejecting && (
            <div role="group" aria-labelledby={`reject-${app.id}-q`} onKeyDown={e => { if (e.key === 'Escape') cancelReject() }}
              className="mt-4 p-4 rounded border-2 border-danger max-w-[640px]">
              <p id={`reject-${app.id}-q`} className="font-bold text-pretty">Reject {name}'s application? It moves to the Rejected list.</p>
              <label htmlFor={`reject-${app.id}-notes`} className="block mt-3 mb-1.5 font-bold">
                Reason or notes <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <Textarea id={`reject-${app.id}-notes`} rows={2} className="resize-y"
                placeholder="For example, didn't come to the interview"
                value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} />
              <div className="flex flex-wrap gap-2 mt-3">
                <Button autoFocus onClick={cancelReject}>Keep it pending</Button>
                <Button variant="danger" onClick={handleReject} disabled={busy !== null} aria-busy={busy === 'reject'}>
                  {busy === 'reject' && <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                  Reject {app.first_name}
                </Button>
              </div>
            </div>
          )}

          {actionError && <p role="alert" className="mt-3 text-sm font-bold text-danger text-pretty">{actionError}</p>}
        </div>
      )}
    </div>
  )
}

export default function AdminVolunteers() {
  const { volunteers, loading: vLoading, error: vError, refetch: refetchVolunteers } = useVolunteers()
  const { classes, updateSection, refetch: refetchClasses } = useAdminClasses()
  const { settings, loading: settingsLoading, error: settingsReadError, updateSetting } = useAppSettings()
  const { applications, loading: appsLoading, acceptApplication, rejectApplication } = useVolunteerApplications()
  const { slots, error: slotsError } = useInterviews()

  // The tab lives in the URL (?tab=applications | crew), so the sub-tab links, the top-bar search
  // and the To do links all land on the right one. ?tab=roster is the old name for Crew.
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'crew' || params.get('tab') === 'roster' ? 'crew' : 'applications'

  const [week, setWeek] = useState<1 | 2>(1)
  const [preview, setPreview] = useState<AssignmentPair[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [appFilter, setAppFilter] = useState<AppFilter>('pending')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [settingError, setSettingError] = useState<string | null>(null)
  const [closingApps, setClosingApps] = useState(false)
  const [settingBusy, setSettingBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notesOpen, setNotesOpen] = useState<string | null>(null)
  // When the confirm closes (cancel, Escape or done), focus goes back to the Close/Open button.
  const appsButton = useRef<HTMLButtonElement>(null)
  const refocusApps = useRef(false)
  useEffect(() => {
    if (refocusApps.current && !closingApps && !settingBusy) {
      refocusApps.current = false
      appsButton.current?.focus()
    }
  }, [closingApps, settingBusy])
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 3000)
    return () => window.clearTimeout(t)
  }, [copied])
  const { sessions } = useSessions()
  const weeks = campSessions(sessions)
  const weekLabels: [string, string] = [0, 1].map(i =>
    weeks[i] ? `${weeks[i].name} (${formatSessionDates(weeks[i], false)})` : `Week ${i + 1}`,
  ) as [string, string]
  const weekHeads = [0, 1].map(i => weeks[i] ? `${weeks[i].name} · ${shortRange(weeks[i].start_date, weeks[i].end_date)}` : `Week ${i + 1}`)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const applicationsOpen = settings['volunteer_applications_open'] === 'true'

  async function setApplicationsOpen(open: boolean) {
    setSettingBusy(true); setSettingError(null)
    try {
      await updateSetting('volunteer_applications_open', open ? 'true' : 'false')
      if (closingApps) refocusApps.current = true
      setClosingApps(false)
    } catch (e) {
      setSettingError(`Couldn't ${open ? 'open' : 'close'} applications: ${e instanceof Error ? e.message : 'unknown error'}. Try again.`)
    } finally {
      setSettingBusy(false)
    }
  }
  const counts = {
    pending: applications.filter(a => a.status === 'pending').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    all: applications.length,
  }
  const filteredApps = appFilter === 'all' ? applications : applications.filter(a => a.status === appFilter)

  // Each application's booked interview, from the slots (a booking row is what makes it booked).
  const interviewOf = new Map(slots.filter(s => s.booking).map(s => [s.booking!.application_id, s.slot_datetime]))

  function runMatcher() {
    setApplied(false)
    const allSections = classes.flatMap(c => c.sections)
    setPreview(matchVolunteers(volunteers, allSections, week))
  }

  async function applyAssignments() {
    if (!preview) return
    setApplying(true)
    setAssignError(null)
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
    } catch (e) {
      setAssignError(`Some assignments couldn't be saved: ${e instanceof Error ? e.message : 'unknown error'}. Refresh to see what was applied.`)
    } finally {
      setApplying(false)
    }
  }

  // Open spots the matcher would try to fill: a missing lead, a missing support, per section that
  // runs that week (a section with no week runs both). A cancelled section needs nobody.
  const allSections = classes.flatMap(c => c.sections)
  const openSpots = (w: 1 | 2) => allSections
    .filter(s => (s.week === w || s.week === null) && !s.cancelled_at)
    .reduce((n, s) => n + (s.lead_id ? 0 : 1) + (s.supports.length ? 0 : 1), 0)

  // What each volunteer does each week: "PY-A lead". A section with no week holds both weeks.
  const crewOf = new Map<string, { 1: string[]; 2: string[] }>()
  for (const sec of allSections) {
    const people: [string, string][] = [
      ...(sec.lead_id ? [[sec.lead_id, 'lead'] as [string, string]] : []),
      ...sec.supports.map(x => [x.id, 'support'] as [string, string]),
    ]
    for (const [id, role] of people) {
      const entry = crewOf.get(id) ?? { 1: [], 2: [] }
      for (const w of (sec.week === null ? [1, 2] : [sec.week]) as (1 | 2)[]) entry[w].push(`${sec.label} ${role}`)
      crewOf.set(id, entry)
    }
  }
  const seniors = volunteers.filter(v => v.experience_level === 'senior').length

  const weekCell = (v: VolunteerWithProfile, w: 1 | 2) => {
    const spots = crewOf.get(v.id)?.[w] ?? []
    if (spots.length) return <b className="font-bold">{spots.join(', ')}</b>
    const available = w === 1 ? v.availability_week_1 : v.availability_week_2
    return available ? 'Free' : <span className="text-ink-muted">Not available</span>
  }

  const th = 'px-3 py-2.5 text-left text-sm font-bold text-ink-muted border-b border-ink whitespace-nowrap'
  const td = 'px-3 py-2 align-middle max-md:p-0 max-md:py-0.5'
  const mobileLabel = 'md:hidden text-sm font-bold text-ink-muted'

  return (
    <div className={pageClass}>
      <AdminPageHead
        title="Volunteers"
        tabs
        actions={tab === 'applications'
          ? <Button onClick={() => exportApplicationsCSV(applications)} disabled={appsLoading}>
              <Download size={18} aria-hidden="true" /> Export CSV<span className="sr-only"> of applications</span>
            </Button>
          : <Button onClick={() => exportVolunteerCSV(volunteers, classes)} disabled={vLoading}>
              <Download size={18} aria-hidden="true" /> Export CSV<span className="sr-only"> of the crew</span>
            </Button>}
      />
      {/* Two views of this page, kept in the URL (?tab=). The shell links Interviews and Duties as
          their own pages, so these are tabs over panels, not navigation. */}
      <Segmented
        mode="tabs"
        idBase="vol"
        label="Volunteers"
        className="mb-6"
        value={tab}
        onChange={t => setParams({ tab: t }, { replace: true })}
        options={[
          { value: 'applications', label: 'Applications', count: appsLoading || counts.pending === 0 ? undefined : counts.pending, srLabel: appsLoading || counts.pending === 0 ? undefined : ' pending' },
          { value: 'crew', label: 'Crew' },
        ]}
      />

      {/* ── Applications ── */}
      {tab === 'applications' && (
        <div role="tabpanel" id="vol-panel-applications" aria-labelledby="vol-tab-applications">
          {/* The one open/close control for the form at /apply (issue #171). Closing asks first. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3 border-b-2 border-ink">
            <p className="flex-1 min-w-[min(100%,16rem)] text-pretty">
              {settingsLoading
                ? 'Checking whether applications are open…'
                : settingsReadError
                  ? <b title={settingsReadError} className="font-extrabold text-danger">Couldn't check whether applications are open. Reload the page to try again.</b>
                : applicationsOpen
                  ? <><b className="font-extrabold">Applications are open</b> at <a href="/apply" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-[3px]">{window.location.host}/apply</a></>
                  : <><b className="font-extrabold">Applications are closed.</b> The form at /apply isn't taking new applications.</>}
            </p>
            {applicationsOpen && (
              <Button variant="text" onClick={() => {
                void navigator.clipboard?.writeText(`${window.location.origin}/apply`).then(() => setCopied(true), () => {})
              }}>
                <Copy size={16} aria-hidden="true" /> Copy link
              </Button>
            )}
            <span role="status" className="text-sm font-bold text-success empty:hidden">{copied ? 'Link copied' : ''}</span>
            {!settingsReadError && <Button
              ref={appsButton}
              disabled={settingsLoading || settingBusy}
              aria-expanded={applicationsOpen ? closingApps : undefined}
              onClick={() => { if (applicationsOpen) setClosingApps(true); else void setApplicationsOpen(true) }}
            >
              {applicationsOpen ? 'Close applications' : 'Open applications'}
            </Button>}
          </div>
          {closingApps && applicationsOpen && (
            <div className="mt-3">
              <InlineConfirm
                frame
                message={`Close volunteer applications? The form at /apply stops taking new applications until you open it again. The ${applications.length} already in stay as they are.`}
                confirmLabel="Close applications"
                cancelLabel="Keep them open"
                busy={settingBusy}
                onConfirm={() => { void setApplicationsOpen(false) }}
                onCancel={() => { refocusApps.current = true; setClosingApps(false) }}
              />
            </div>
          )}

          {settingError && <p role="alert" className="mt-3 text-sm font-bold text-danger">{settingError}</p>}

          <div className="mt-5 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Segmented
              label="Show applications"
              value={appFilter}
              onChange={f => { setAppFilter(f); setExpandedId(null) }}
              options={(['pending', 'accepted', 'rejected', 'all'] as AppFilter[]).map(f => ({
                value: f, label: cap(f), count: appsLoading ? undefined : counts[f],
              }))}
            />
            <span className="text-sm text-ink-muted">Newest first</span>
          </div>

          {appsLoading ? (
            <ul aria-busy="true" aria-label="Loading applications" className="border-y-2 border-ink">
              {[1, 2, 3].map(i => (
                <li key={i} className="py-4 border-t border-border first:border-t-0">
                  <div className="h-5 w-48 rounded bg-surface-sunken animate-pulse" />
                  <div className="mt-2 h-4 w-72 max-w-full rounded bg-surface-sunken animate-pulse" />
                </li>
              ))}
            </ul>
          ) : filteredApps.length === 0 ? (
            <p className="py-4 border-y-2 border-ink text-lg font-bold">
              {appFilter === 'pending' ? 'No applications waiting for a decision.' : `No ${appFilter === 'all' ? '' : `${appFilter} `}applications yet.`}
            </p>
          ) : (
            <ul className="border-y-2 border-ink">
              {filteredApps.map(app => {
                const open = expandedId === app.id
                const interview = interviewOf.get(app.id)
                return (
                  <li key={app.id} className="border-t border-border first:border-t-0">
                    <button
                      type="button"
                      className="group w-full flex flex-wrap items-center gap-x-4 gap-y-1 min-h-14 py-3 text-left cursor-pointer"
                      onClick={() => setExpandedId(open ? null : app.id)}
                      aria-expanded={open}
                      aria-controls={`app-${app.id}`}
                    >
                      <span className="flex-[1_1_16rem] min-w-0">
                        <span className="block text-lg font-bold leading-[1.3] group-hover:underline underline-offset-[3px]">{app.first_name} {app.last_name}</span>
                        <span className="block text-sm text-ink-muted text-pretty">
                          {app.school} · {app.grade} · {weeksText(app.availability_week_1, app.availability_week_2)} · {appliedAgo(app.created_at)}
                        </span>
                      </span>
                      {appFilter === 'all' && (
                        app.status === 'accepted' ? <StatusWord tone="ok" icon={CircleCheck}>Accepted</StatusWord>
                          : app.status === 'rejected' ? <StatusWord tone="plain">Rejected</StatusWord>
                          : <StatusWord tone="waiting" icon={Hourglass}>Pending</StatusWord>
                      )}
                      {app.status === 'pending' && !slotsError && (
                        interview
                          ? <span className="text-pretty">Interview {formatCampSlot(interview)}</span>
                          : <span className="inline-flex items-center gap-1.5 font-extrabold">
                              <CalendarX2 size={16} strokeWidth={2.5} aria-hidden="true" /> No interview yet
                            </span>
                      )}
                      <ChevronDown size={20} aria-hidden="true" className={`shrink-0 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {open && (
                      <div id={`app-${app.id}`}>
                        <ApplicationReview
                          app={app}
                          weekLabels={weekLabels}
                          onAccept={async (app, level) => {
                            await acceptApplication(app, level)
                            // The new volunteer row should show on the Crew tab and in auto-assign now.
                            await refetchVolunteers()
                          }}
                          onReject={rejectApplication}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Crew ── */}
      {tab === 'crew' && (
        <div role="tabpanel" id="vol-panel-crew" aria-labelledby="vol-tab-crew">
          <form
            onSubmit={e => { e.preventDefault(); runMatcher() }}
            aria-labelledby="fill-heading"
            className="flex flex-wrap items-end gap-x-4 gap-y-3 mb-4"
          >
            <div className="flex-[1_1_18rem] min-w-0">
              <h2 id="fill-heading" className="text-lg font-bold leading-[1.3]">Fill open spots</h2>
              <p className="text-sm text-ink-muted text-pretty">Pairs a free senior lead and a free junior support for each open spot. Existing assignments are kept.</p>
            </div>
            <div>
              <label htmlFor="fill-week" className="block font-bold mb-1.5">Week</label>
              <Select id="fill-week" value={week} className="w-auto min-w-[14rem]"
                onChange={e => { setWeek(Number(e.target.value) as 1 | 2); setPreview(null); setApplied(false) }}>
                {([1, 2] as const).map(w => {
                  const n = openSpots(w)
                  return <option key={w} value={w}>Week {w} · {n === 0 ? 'no open spots' : `${n} open spot${n === 1 ? '' : 's'}`}</option>
                })}
              </Select>
            </div>
            <Button type="submit">Preview matches</Button>
          </form>

          {assignError && <p role="alert" className="mb-4 text-sm font-bold text-danger text-pretty">{assignError}</p>}
          {applied && (
            <p role="status" className="mb-4 inline-flex items-center gap-1.5 font-bold text-success">
              <Check size={18} strokeWidth={2.5} aria-hidden="true" /> Assignments applied.
            </p>
          )}

          {preview && (
            <section aria-labelledby="preview-heading" className="mb-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 id="preview-heading" className="text-lg font-bold leading-[1.3]">
                  Week {week} matches{preview.some(p => p.lead || p.support) ? '' : ': nothing new to assign'}
                </h2>
                <Button variant="primary" onClick={applyAssignments} disabled={applying || !preview.some(p => p.lead || p.support)} aria-busy={applying}>
                  {applying
                    ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
                  {applying ? 'Applying…' : 'Apply assignments'}
                </Button>
              </div>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px] bg-surface border-y-2 border-ink">
                  <caption className="sr-only">Proposed crew for Week {week}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={th}>Section</th>
                      <th scope="col" className={th}>Lead (senior)</th>
                      <th scope="col" className={th}>Support (junior)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(p => {
                      const cls = classes.find(c => c.id === p.classId)
                      const sec = cls?.sections.find(x => x.id === p.sectionId)
                      const cell = (proposed: VolunteerWithProfile | null, current: string | null, missing: string) =>
                        proposed ? <><b className="font-bold">{proposed.profiles.display_name}</b> <span className="text-sm text-ink-muted">new</span></>
                          : current ? <>{current} <span className="text-sm text-ink-muted">already on it</span></>
                          : <span className="text-ink-muted">{missing}</span>
                      return (
                        <tr key={p.sectionId} className="border-t border-border first:border-t-0">
                          <td className="px-3 py-3">
                            <b className="font-bold">{p.sectionLabel}</b>{p.week ? ` · Week ${p.week}` : ''}
                            <span className="block text-sm text-ink-muted">{cls?.name ?? 'Class'}</span>
                          </td>
                          <td className="px-3 py-3">{cell(p.lead, sec?.lead?.display_name ?? null, 'No senior free')}</td>
                          <td className="px-3 py-3">{cell(p.support, sec?.supports.map(x => x.display_name).join(', ') || null, 'No junior free')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {vError ? (
            <p role="alert" title={vError} className="py-4 border-y-2 border-ink font-bold text-danger">
              Couldn't load the crew. Check your connection, then reload the page.
            </p>
          ) : vLoading && volunteers.length === 0 ? (
            <div aria-busy="true" aria-label="Loading the crew" className="border-y-2 border-ink">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 my-1 rounded bg-surface-sunken animate-pulse" />)}
            </div>
          ) : volunteers.length === 0 ? (
            <p className="py-4 border-y-2 border-ink text-lg font-bold">No volunteers yet. Accept applications to build the crew.</p>
          ) : (
            <>
              <table className="w-full bg-surface border-y-2 border-ink max-md:block max-md:bg-transparent">
                <caption className="sr-only">Accepted volunteers and their assignment each week</caption>
                <thead className="max-md:sr-only">
                  <tr>
                    <th scope="col" className={th}>Name</th>
                    <th scope="col" className={th}>Level</th>
                    <th scope="col" className={th}>{weekHeads[0]}</th>
                    <th scope="col" className={th}>{weekHeads[1]}</th>
                  </tr>
                </thead>
                <tbody className="max-md:block">
                  {volunteers.map(v => {
                    const open = notesOpen === v.id
                    return (
                      <Fragment key={v.id}>
                        <tr className="border-t border-border first:border-t-0 hover:bg-ink/[0.03] max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:py-2">
                          <td className={td}>
                            {v.interview_notes ? (
                              <button type="button" onClick={() => setNotesOpen(open ? null : v.id)}
                                aria-expanded={open} aria-controls={`notes-${v.id}`}
                                className="inline-flex items-center gap-1.5 min-h-11 font-bold text-left cursor-pointer hover:underline underline-offset-[3px]">
                                {v.profiles.display_name}
                                <span className="sr-only">, interview notes</span>
                                <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                              </button>
                            ) : <b className="font-bold">{v.profiles.display_name}</b>}
                          </td>
                          <td className={`${td} max-md:self-center max-md:text-right`}><span className="sr-only md:hidden">Level </span>{cap(v.experience_level)}</td>
                          <td className={td}><span className={`${mobileLabel} block`}>Week 1</span>{weekCell(v, 1)}</td>
                          <td className={td}><span className={`${mobileLabel} block`}>Week 2</span>{weekCell(v, 2)}</td>
                        </tr>
                        {open && (
                          <tr id={`notes-${v.id}`} className="max-md:block max-md:pb-2">
                            <td colSpan={4} className="px-3 pb-4 pt-1 max-md:block max-md:px-0">
                              <p className="text-sm font-bold text-ink-muted">Interview notes</p>
                              <p className="mt-1 max-w-[68ch] text-pretty whitespace-pre-line">{v.interview_notes}</p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-sm text-ink-muted">
                {volunteers.length} accepted volunteer{volunteers.length === 1 ? '' : 's'} · {seniors} senior{seniors === 1 ? '' : 's'}, {volunteers.length - seniors} junior{volunteers.length - seniors === 1 ? '' : 's'}. Volunteers set their own weeks; only admins assign sections.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
