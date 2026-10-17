import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations, type RegistrationWithSection } from '../hooks/useRegistrations'
import StudentCard from '../components/StudentCard'
import ThisWeekCard from '../components/ThisWeekCard'
import RollCallStatus from '../components/RollCallStatus'
import { useMyRollCalls } from '../hooks/useMyRollCalls'
import { useUpdates } from '../hooks/useUpdates'
import UpdatesFeed from '../components/UpdatesFeed'
import { Megaphone } from 'lucide-react'
import { localDateISO } from '../lib/campDay'
import { useSessions, activeCampYear } from '../hooks/useSessions'
import { useSeasonSettings } from '../hooks/useSeasonSettings'
import RegistrationCountdown from '../components/RegistrationCountdown'
import { listDrafts, clearDraft } from '../lib/registrationDraft'
import { useMyChanges } from '../hooks/useMyChanges'
import ContactDetailsCard from '../components/ContactDetailsCard'
import type { Student } from '../types/database'

// Status-aware subhead (§3 / DS §10): a warm, one-line rollup of real enrollment status.
function buildSubhead(students: Student[], registrations: RegistrationWithSection[]): string {
  if (students.length === 0) return 'Add your first camper to get started.'

  const active = registrations.filter(r => r.status !== 'cancelled')
  if (active.length === 0) {
    return students.length === 1
      ? "Your camper isn't signed up yet — browse classes to find a fit."
      : 'No sign-ups yet — browse classes to find a fit for your campers.'
  }

  // A waitlist offer needs the parent first (spec 10).
  const offered = active.find(r => r.status === 'offered')
  if (offered) {
    const who = students.find(s => s.id === offered.student_id)
    return `A spot opened up for ${who ? (who.first_name ?? who.full_name.split(' ')[0]) : 'your camper'}! Claim it below before the offer ends.`
  }
  // Registrations auto-confirm (spec 14); a legacy 'pending' row counts as confirmed.
  const waitlisted = active.filter(r => r.status === 'waitlisted').length
  const confirmedIds = new Set(active.filter(r => r.status === 'confirmed' || r.status === 'pending').map(r => r.student_id))
  const unenrolled = students.filter(s => !active.some(r => r.student_id === s.id))
  const firstName = (s: Student) => s.first_name ?? s.full_name.split(' ')[0]

  const subject = students.length === 1 ? 'Your camper is' : 'Your campers are'
  const waitNote = waitlisted > 0 ? ` ${waitlisted === 1 ? 'One spot is' : `${waitlisted} spots are`} on a waitlist.` : ''
  const unenrolledNote = unenrolled.length === 0 ? ''
    : unenrolled.length === 1 ? ` ${firstName(unenrolled[0])} isn't signed up yet.`
    : ` ${unenrolled.length} campers aren't signed up yet.`

  if (confirmedIds.size === 0) return `${subject} on a waitlist — we'll reach out if a spot opens.${unenrolledNote}`
  // Only say "all set" for the campers who actually have a confirmed spot.
  const lead = confirmedIds.size === students.length
    ? `${subject} all set for camp.`
    : confirmedIds.size === 1
      ? `${firstName(students.find(s => confirmedIds.has(s.id))!)} is all set for camp.`
      : `${confirmedIds.size} of your campers are all set for camp.`
  return `${lead}${waitNote}${unenrolledNote}`
}

export default function ParentDashboard() {
  const { profile, user } = useAuth()
  const { students, loading, updateStudent } = useStudents()
  const { registrations, refetch: refetchRegistrations } = useRegistrations()
  const myChanges = useMyChanges(students.length > 0)
  const changes = {
    ...myChanges,
    cancelSpot: async (id: string) => { await myChanges.cancelSpot(id); await refetchRegistrations() },
    acceptOffer: async (id: string) => { await myChanges.acceptOffer(id); await refetchRegistrations() },
    declineOffer: async (id: string) => { await myChanges.declineOffer(id); await refetchRegistrations() },
    swapSpot: async (id: string, sectionId: string) => { await myChanges.swapSpot(id, sectionId); await refetchRegistrations() },
  }
  const todayMarks = useMyRollCalls(localDateISO())
  const { updates: posts, loading: postsLoading } = useUpdates(20)
  const { sessions } = useSessions()
  const { settings: season } = useSeasonSettings(sessions.length > 0 ? activeCampYear(sessions) : null)

  const subhead = buildSubhead(students, registrations)
  // Unfinished registrations saved on this device (spec 16).
  const [drafts, setDrafts] = useState(() => (user ? listDrafts(user.id) : []))

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-sans text-[32px] leading-[38px] sm:text-[40px] sm:leading-[46px] font-bold tracking-[-0.01em] text-ink mb-1">
              Welcome, {profile?.display_name?.split(' ')[0]}
            </h1>
            <p className="font-slab text-ink-muted text-lg">{subhead}</p>
          </div>

          {/* Action hierarchy (§3): one secondary (Browse classes) + one gold primary (Add camper).
              The per-camper Register action now lives on each StudentCard footer. */}
          <div className="flex flex-wrap gap-3">
            <Link
              to="/parent/classes"
              className="h-11 px-4 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition shadow-sm"
            >
              <GraduationCap size={16} />
              Browse classes
            </Link>
            {/* New campers go through the full registration (waiver + emergency contact), not a quick add. */}
            <Link
              to="/parent/register"
              className="h-11 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 transition shadow-sm"
            >
              <Plus size={16} />
              Add camper
            </Link>
          </div>
        </div>

        <RegistrationCountdown opensAt={season?.registration_opens_at} />

        {drafts.map(({ key, studentId, draft }) => (
          <div key={key} className="bg-surface border border-brand/40 rounded-xl shadow-sm px-4 sm:px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1 font-sans text-sm text-ink">
              <span className="font-semibold">Finish registering {draft.name || 'your new camper'}.</span>{' '}
              <span className="text-ink-muted">You're on step {draft.step} of 5. Your answers are saved on this device.</span>
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { clearDraft(key); setDrafts(d => d.filter(x => x.key !== key)) }}
                className="h-10 px-3 rounded-[10px] font-sans font-semibold text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken transition"
              >
                Discard
              </button>
              <Link
                to={`/parent/register?${studentId ? `studentId=${studentId}&` : ''}step=${draft.step}`}
                className="h-10 px-4 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center transition shadow-sm"
              >
                Continue
              </Link>
            </div>
          </div>
        ))}

        <ThisWeekCard
          students={students}
          registrations={registrations}
          renderStatus={(st, reg) => <RollCallStatus marks={todayMarks.filter(m => m.student_id === st.id && m.section_id === reg.section_id)} />}
        />

        <section id="updates" aria-labelledby="updates-heading" className="bg-surface border border-border rounded-xl shadow-sm px-4 sm:px-5 py-4 mb-8">
          <h2 id="updates-heading" className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted flex items-center gap-1.5 mb-1">
            <Megaphone size={13} /> Updates from camp
          </h2>
          <UpdatesFeed updates={posts} loading={postsLoading} compact emptyText="Nothing from camp yet — updates from the admin and your camper's lead will show here." />
        </section>

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
            <Link
              to="/parent/register"
              className="h-11 px-5 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] inline-flex items-center gap-2 transition shadow-sm"
            >
              <Plus size={16} /> Register a camper
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map(student => (
              <StudentCard
                key={student.id}
                student={student}
                registrations={registrations.filter(r => r.student_id === student.id)}
                onSave={async (id, patch) => { await updateStudent(id, patch) }}
                changes={changes}
              />
            ))}
          </div>
        )}

        <div className="mt-8">
          <ContactDetailsCard />
        </div>
    </div>
  )
}
