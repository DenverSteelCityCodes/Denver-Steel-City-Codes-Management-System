import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search, Lock, CheckCircle, Clock, List, ShieldCheck, Info } from 'lucide-react'
import { useClasses, type SectionWithCount } from '../hooks/useClasses'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations } from '../hooks/useRegistrations'
import { useSessions, activeCampYear } from '../hooks/useSessions'
import CapacityMeter from '../components/CapacityMeter'
import ConfirmOnboardingPanel from '../components/ConfirmOnboardingPanel'
import { useParentProfile } from '../hooks/useParentProfile'
import { useAuth } from '../context/AuthContext'
import { courseConstraint, gradeBlockReason } from '../lib/courseConstraints'
import type { RegistrationStatus, OnboardingConfirmation } from '../types/database'

// ── Section card ──────────────────────────────────────────────

interface SectionCardProps {
  section: SectionWithCount
  studentName?: string
  studentAge?: number
  registrationStatus?: RegistrationStatus
  onRegister?: () => void
  registering?: boolean
  // Course-level grade restriction (#44), e.g. Microcontrollers is rising 7–9 only.
  gradeBlock?: string | null
  // Name of the class this camper already holds a spot in for the same week (one class per week).
  weekClash?: string | null
}

function SectionCard({ section, studentName, studentAge, registrationStatus, onRegister, registering, gradeBlock, weekClash }: SectionCardProps) {
  const ageEligible = studentAge !== undefined
    ? studentAge >= section.age_min && studentAge <= section.age_max
    : true
  // Age range fails first; otherwise a course grade rule may still disqualify the camper.
  const ineligibleReason = !ageEligible
    ? `Ages ${section.age_min}–${section.age_max}`
    : (gradeBlock ?? null)

  const isFull = section.registered_count >= section.capacity

  if (ineligibleReason) {
    return (
      <div className="opacity-70 bg-surface-sunken border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-sans font-semibold text-sm text-ink truncate">{section.label}</span>
          {section.week && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-surface text-ink-muted text-xs font-semibold border border-border-strong">W{section.week}</span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface text-ink-muted text-xs font-semibold border border-border-strong w-fit">
          <Lock size={11} /> {ineligibleReason}
        </span>
        {studentName && (
          <p className="font-sans text-xs text-ink-faint">Not eligible for {studentName}</p>
        )}
        <CapacityMeter registered={section.registered_count} capacity={section.capacity} />
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans font-semibold text-sm text-ink truncate">{section.label}</span>
        {section.week && (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-brand-soft text-warning text-xs font-semibold border border-brand/20">W{section.week}</span>
        )}
      </div>

      {studentName && studentAge !== undefined && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-soft text-success text-xs font-semibold w-fit">
          <CheckCircle size={11} /> Ages {section.age_min}–{section.age_max} · {studentName} fits
        </span>
      )}

      <CapacityMeter registered={section.registered_count} capacity={section.capacity} />

      {registrationStatus ? (
        <div className="flex items-center gap-2 text-sm font-sans font-semibold">
          {registrationStatus === 'confirmed' && <><CheckCircle size={16} className="text-success" /><span className="text-success">Confirmed</span></>}
          {registrationStatus === 'pending' && <><Clock size={16} className="text-warning" /><span className="text-warning">Pending</span></>}
          {registrationStatus === 'waitlisted' && <><List size={16} className="text-info" /><span className="text-info">Waitlisted</span></>}
          {registrationStatus === 'cancelled' && <span className="text-ink-muted">Cancelled</span>}
          {studentName && <span className="text-ink-muted font-normal">· {studentName}</span>}
        </div>
      ) : weekClash && !isFull ? (
        // Campers take one class per week; the waitlist of a full class stays open as a backup.
        <p className="flex items-start gap-1.5 font-sans text-sm text-ink-muted">
          <Info size={15} className="shrink-0 mt-0.5" />
          Already in {weekClash} this week
        </p>
      ) : onRegister ? (
        <button
          onClick={onRegister}
          disabled={registering}
          className="w-full h-10 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {registering
            ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
            : isFull ? 'Join waitlist' : `Register ${studentName ?? 'camper'}`}
        </button>
      ) : null}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function ClassBrowser() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { classes, loading: classesLoading, refetch: refetchClasses } = useClasses()
  const { students, confirmOnboarding } = useStudents()
  const { registrations, registerStudent, isRegistered, getRegistration } = useRegistrations()
  const { sessions } = useSessions()
  const { profile } = useAuth()
  const { profile: parentProfile } = useParentProfile()

  // Pre-select the camper when deep-linked from a StudentCard ("Register for another class").
  const [selectedStudentId, setSelectedStudentId] = useState<string>(searchParams.get('camper') ?? '')
  const [search, setSearch] = useState('')
  const [registeringSectionId, setRegisteringSectionId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null)
  // A section awaiting onboarding confirmation before its registration can proceed (#42).
  const [pendingSection, setPendingSection] = useState<SectionWithCount | null>(null)
  const [confirming, setConfirming] = useState(false)

  const selectedStudent = students.find(s => s.id === selectedStudentId)

  // Active camp year: the year of the open session(s). Campers must have confirmed their
  // onboarding for THIS year before they can register — they re-confirm every summer (#42).
  const campYear = activeCampYear(sessions)
  const needsConfirmation = (student?: typeof selectedStudent) =>
    !!student && student.registration_year !== campYear

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function showToast(message: string, type: 'success' | 'info') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Gate: a camper whose onboarding isn't confirmed for the active year must review & confirm
  // it first. Otherwise register immediately.
  function handleRegister(section: SectionWithCount) {
    if (!selectedStudentId) return
    if (needsConfirmation(selectedStudent)) {
      setPendingSection(section)
      return
    }
    void doRegister(section)
  }

  async function doRegister(section: SectionWithCount) {
    if (!selectedStudentId) return
    setRegisteringSectionId(section.id)
    try {
      const reg = await registerStudent(selectedStudentId, section.id, section.registered_count, section.capacity)
      const msg = reg.status === 'waitlisted'
        ? `${selectedStudent?.full_name} added to the waitlist.`
        : `${selectedStudent?.full_name} registered! Pending confirmation.`
      showToast(msg, reg.status === 'waitlisted' ? 'info' : 'success')
      void refetchClasses()   // fill meters now include this camper
    } catch (err) {
      // The server enforces age range and capacity; show its reason rather than a generic error.
      const reason = err instanceof Error ? err.message : ''
      showToast(reason.includes('duplicate key')
        ? `${selectedStudent?.full_name} is already registered for that section.`
        : reason || 'Something went wrong. Please try again.', 'info')
    } finally {
      setRegisteringSectionId(null)
    }
  }

  // After the parent reviews/edits and attests, persist + stamp the year, then continue the
  // registration that triggered the prompt.
  async function handleConfirmOnboarding(fields: OnboardingConfirmation) {
    if (!selectedStudentId) return
    setConfirming(true)
    try {
      await confirmOnboarding(selectedStudentId, fields, campYear)
      const section = pendingSection
      setPendingSection(null)
      if (section) await doRegister(section)
    } catch {
      showToast('Could not save your confirmation. Please try again.', 'info')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        {/* Contextual back — the shell's top nav owns primary navigation now. */}
        <button
          onClick={() => navigate('/parent')}
          className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-ink-muted hover:text-ink transition"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <label htmlFor="browse-camper" className="sr-only">Camper</label>
          <select
            id="browse-camper"
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition sm:w-64"
          >
            <option value="">Select a camper to enroll…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.full_name} (age {s.age})</option>
            ))}
          </select>

          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <label htmlFor="browse-search" className="sr-only">Search courses</label>
            <input
              id="browse-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search courses…"
              className="w-full h-11 pl-9 pr-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition"
            />
          </div>
        </div>

        {/* Eligibility banner */}
        {selectedStudent && (
          <div className="flex items-center gap-2 px-4 py-3 bg-brand-soft text-warning border border-brand/20 rounded-[10px] font-sans text-sm font-semibold">
            Showing eligibility for {selectedStudent.full_name} (age {selectedStudent.age}) — eligible sections are highlighted in green.
          </div>
        )}

        {/* Per-summer confirmation notice (#42): registering prompts a quick review first. */}
        {selectedStudent && needsConfirmation(selectedStudent) && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-info-soft text-info border border-info/20 rounded-[10px] font-sans text-sm">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">Quick check before you register.</span> Confirm {selectedStudent.full_name}'s
              details are up to date for the {campYear} camp — we'll ask you to review them when you register.
            </span>
          </div>
        )}

        {/* Per-summer onboarding confirmation gate — opens in place, above the classes */}
        {pendingSection && selectedStudent && (
          <ConfirmOnboardingPanel
            key={`${selectedStudent.id}-${pendingSection.id}`}
            student={selectedStudent}
            parentDefaults={{
              parent_name: profile?.display_name,
              parent_phone: parentProfile?.phone,
              emergency_contact_name: parentProfile?.emergency_contact_name,
              emergency_contact_phone: parentProfile?.emergency_contact_phone,
              emergency_contact_relation: parentProfile?.emergency_contact_relation,
            }}
            campYear={campYear}
            submitting={confirming}
            onConfirm={handleConfirmOnboarding}
            onClose={() => setPendingSection(null)}
          />
        )}

        {!selectedStudentId && (
          <p className="text-sm font-sans font-semibold bg-warning-soft text-warning px-4 py-3 rounded-[10px]">
            Select a camper above to see eligibility and register.
          </p>
        )}

        {classesLoading ? (
          <div className="space-y-8">
            {[1, 2].map(i => (
              <div key={i} className="space-y-3">
                <div className="h-7 bg-surface border border-border rounded-lg animate-pulse w-48" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="bg-surface border border-border rounded-xl h-36 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-sans text-ink-muted">No classes found.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map(cls => {
              const constraint = courseConstraint(cls.name)
              const gradeBlock = gradeBlockReason(constraint, selectedStudent?.grade)
              return (
              <div key={cls.id} className="space-y-4">
                {/* Course header */}
                <div>
                  <h2 className="font-slab font-bold text-xl text-ink">{cls.name}</h2>
                  {cls.description && (
                    <p className="font-sans text-ink-muted text-sm mt-1">{cls.description}</p>
                  )}
                  {constraint?.requirementNote && (
                    <p className="mt-2 inline-flex items-start gap-1.5 font-sans text-xs font-semibold bg-info-soft text-info px-2.5 py-1.5 rounded-[8px]">
                      <Info size={13} className="shrink-0 mt-0.5" /> {constraint.requirementNote}
                    </p>
                  )}
                </div>

                {cls.sections.length === 0 ? (
                  <p className="font-sans text-sm text-ink-faint">No sections available yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cls.sections.map(sec => {
                      const existingReg = selectedStudentId
                        ? getRegistration(selectedStudentId, sec.id)
                        : null
                      const alreadyRegistered = selectedStudentId
                        ? isRegistered(selectedStudentId, sec.id)
                        : false

                      // One held spot per camper per week (also enforced by the database).
                      const weekClash = selectedStudentId
                        ? registrations.find(r =>
                            r.student_id === selectedStudentId &&
                            r.section_id !== sec.id &&
                            (r.status === 'pending' || r.status === 'confirmed') &&
                            r.year === campYear &&
                            r.sections?.week != null && r.sections.week === sec.week,
                          )?.sections?.classes?.name ?? null
                        : null

                      return (
                        <SectionCard
                          key={sec.id}
                          weekClash={weekClash}
                          section={sec}
                          studentName={selectedStudent?.full_name}
                          studentAge={selectedStudent?.age}
                          registrationStatus={existingReg?.status}
                          onRegister={
                            selectedStudentId && !alreadyRegistered
                              ? () => handleRegister(sec)
                              : undefined
                          }
                          registering={registeringSectionId === sec.id}
                          gradeBlock={gradeBlock}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className={`fixed bottom-6 right-6 left-6 sm:left-auto max-w-sm px-4 py-3 rounded-xl shadow-lg font-sans text-sm font-semibold border-l-4 ${
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
