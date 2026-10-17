import { useState } from 'react'
import { Users, Clock, CalendarDays, Megaphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAssignedClass } from '../hooks/useAssignedClass'
import { useDutySlots } from '../hooks/useDutyRoles'
import RollCallPanel from '../components/RollCallPanel'
import UpdateComposer from '../components/UpdateComposer'
import UpdatesFeed from '../components/UpdatesFeed'
import { useUpdates } from '../hooks/useUpdates'
import type { AssignedSection } from '../hooks/useAssignedClass'
import { BrandBar } from '../components/Wordmark'
import InterviewSlotPicker from '../components/InterviewSlotPicker'
import { useOpenInterviewSlots, formatSlot } from '../hooks/useOpenInterviewSlots'
import { useMyInterview } from '../hooks/useMyInterview'
import { useSessions } from '../hooks/useSessions'
import { useScheduleItems } from '../hooks/useScheduleItems'
import DailySchedule, { ScheduleHeading } from '../components/DailySchedule'
import { localDateISO, sessionOnDay } from '../lib/campDay'

// Updates visible to this volunteer, plus a composer for each section they lead.
function UpdatesPanel({ leadSections, userId }: { leadSections: AssignedSection[]; userId: string }) {
  const { updates, loading, postUpdate, deleteUpdate } = useUpdates(30)
  const [composing, setComposing] = useState<string | null>(null)
  return (
    <section aria-labelledby="updates-heading" className="bg-surface border border-border rounded-xl shadow-sm p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 id="updates-heading" className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted flex items-center gap-1.5">
          <Megaphone size={13} /> Updates
        </h2>
        {composing === null && leadSections.map(sec => (
          <button key={sec.id} type="button" onClick={() => setComposing(sec.id)}
            className="h-10 px-3.5 rounded-[10px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm shadow-sm transition">
            Post to {sec.class_name} {sec.label}{sec.week ? ` · Week ${sec.week}` : ''} families
          </button>
        ))}
      </div>
      {composing && (() => {
        const sec = leadSections.find(s => s.id === composing)!
        return (
          <div className="border border-brand rounded-[12px] p-3 sm:p-4">
            <UpdateComposer
              mode={{ kind: 'lead', section: { id: sec.id, label: `${sec.class_name} ${sec.label}${sec.week ? ` · Week ${sec.week}` : ''}` } }}
              onPost={async input => { await postUpdate(input) }}
              onCancel={() => setComposing(null)}
            />
          </div>
        )
      })()}
      <UpdatesFeed
        updates={updates}
        loading={loading}
        compact
        canDelete={u => u.author_id === userId}
        onDelete={deleteUpdate}
        canCopyEmails={u => u.audience === 'section' && leadSections.some(s => s.id === u.section_id)}
        emptyText="No updates yet."
      />
    </section>
  )
}

// The day's plan for whichever session is running today (or the next one).
function TodaySchedulePanel() {
  const { sessions } = useSessions()
  const { items, loading } = useScheduleItems()
  const today = localDateISO()
  const session = sessionOnDay(sessions, today)
    ?? sessions.filter(s => s.is_active && s.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  if (!session || loading) return null
  const list = items.filter(i => i.session_id === session.id)
  return (
    <section aria-labelledby="today-schedule-heading" className="bg-surface border border-border rounded-xl shadow-sm p-4 sm:p-5">
      <div id="today-schedule-heading">
        <ScheduleHeading>{session.start_date <= today ? "Today's schedule" : `Daily schedule · ${session.name}`}</ScheduleHeading>
      </div>
      <div className="mt-2">
        <DailySchedule items={list} />
      </div>
    </section>
  )
}

function DutyPanel({ userId }: { userId: string }) {
  const { slots, loading, claimSlot, unclaimSlot } = useDutySlots()
  const [busySlotId, setBusySlotId] = useState<string | null>(null)

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [claimError, setClaimError] = useState<string | null>(null)
  const upcoming = slots.filter(s => s.slot_date >= today)

  const grouped = upcoming.reduce<Record<string, typeof slots>>((acc, s) => {
    acc[s.slot_date] = acc[s.slot_date] ?? []
    acc[s.slot_date].push(s)
    return acc
  }, {})

  async function handleClaim(slotId: string) {
    setBusySlotId(slotId)
    setClaimError(null)
    try { await claimSlot(slotId, userId) }
    catch (e) { setClaimError(e instanceof Error ? e.message : "Couldn't sign up for that slot") }
    finally { setBusySlotId(null) }
  }

  async function handleUnclaim(slotId: string) {
    setBusySlotId(slotId)
    setClaimError(null)
    try { await unclaimSlot(slotId, userId) }
    catch (e) { setClaimError(e instanceof Error ? e.message : "Couldn't cancel that sign-up") }
    finally { setBusySlotId(null) }
  }

  if (loading) return (
    <div className="space-y-2">
      {[1, 2].map(i => <div key={i} className="h-12 bg-surface border border-border rounded-[14px] animate-pulse" />)}
    </div>
  )

  if (upcoming.length === 0) return (
    <div className="bg-surface border border-border rounded-xl p-6 text-center">
      <CalendarDays size={20} className="text-ink-muted mx-auto mb-2" />
      <p className="font-sans text-sm text-ink-muted">No upcoming duty slots.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {claimError && <p role="alert" className="font-sans text-sm text-danger">{claimError}</p>}
      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, daySlots]) => (
          <div key={date}>
            <p className="font-sans font-semibold text-sm text-ink-muted mb-1.5">
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {daySlots.map((slot, idx) => {
                const myClaim = slot.assignments?.find(a => a.volunteer_id === userId)
                const isFull = slot.assigned_count >= slot.capacity && !myClaim
                return (
                  <div
                    key={slot.id}
                    className={`flex items-center justify-between px-4 py-3 ${idx < daySlots.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div>
                      <p className="font-sans font-semibold text-sm text-ink">{slot.duty_type?.name ?? '—'}</p>
                      <p className="font-sans text-xs text-ink-muted">{slot.assigned_count}/{slot.capacity} filled</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {myClaim && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success-soft text-success">Signed up</span>
                      )}
                      {!myClaim && isFull && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-sunken text-ink-muted">Full</span>
                      )}
                      {myClaim ? (
                        <button
                          onClick={() => handleUnclaim(slot.id)}
                          disabled={busySlotId === slot.id}
                          className="h-8 px-3 text-xs font-semibold font-sans text-ink-muted bg-surface border border-border-strong rounded-[8px] hover:bg-danger-soft hover:text-danger transition disabled:opacity-50"
                        >
                          {busySlotId === slot.id ? '…' : 'Cancel'}
                        </button>
                      ) : !isFull ? (
                        <button
                          onClick={() => handleClaim(slot.id)}
                          disabled={busySlotId === slot.id}
                          className="h-8 px-3 text-xs font-semibold font-sans bg-brand text-brand-on rounded-[8px] hover:bg-brand-hover transition disabled:opacity-50"
                        >
                          {busySlotId === slot.id ? '…' : 'Sign up'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}

// Pending applicants see their interview time and can pick or change it (SignUpGenius-style).
function InterviewCard() {
  const { interview, loading, book } = useMyInterview()
  const { slots, refetch } = useOpenInterviewSlots()
  const [choosing, setChoosing] = useState(false)
  const [picked, setPicked] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (!picked) { setErr('Pick a time first'); return }
    setSaving(true)
    setErr(null)
    try {
      await book(picked)
      setChoosing(false)
      setPicked('')
      refetch()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      refetch()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-24 bg-surface border border-border rounded-xl animate-pulse" />
  const showPicker = choosing || !interview

  return (
    <section aria-labelledby="interview-heading" className="bg-surface border border-border rounded-xl shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 id="interview-heading" className="font-sans font-semibold text-lg text-ink flex items-center gap-2">
            <CalendarDays size={18} className="text-warning" /> Your interview
          </h2>
          <p className="font-sans text-sm text-ink-muted mt-0.5">
            {interview
              ? <>Booked for <strong className="text-ink">{formatSlot(interview.slot_datetime)}</strong> · {interview.duration_minutes} min, online.</>
              : 'Pick a time for your short online interview.'}
          </p>
        </div>
        {interview && !choosing && (
          <button
            onClick={() => setChoosing(true)}
            className="h-10 px-4 shrink-0 rounded-[10px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition"
          >
            Change time
          </button>
        )}
      </div>

      {showPicker && slots && (
        <div className="space-y-3">
          <InterviewSlotPicker slots={slots} value={picked} onChange={setPicked} labelledBy="interview-heading" />
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          {slots.length > 0 && (
            <div className="flex justify-end gap-2">
              {interview && (
                <button onClick={() => { setChoosing(false); setPicked(''); setErr(null) }}
                  className="h-10 px-4 rounded-[10px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition">
                  Keep my time
                </button>
              )}
              <button onClick={save} disabled={saving || !picked}
                className="h-10 px-4 rounded-[10px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm transition disabled:opacity-50">
                {saving ? 'Booking…' : interview ? 'Move my interview' : 'Book this time'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function VolunteerDashboard() {
  const { profile, signOut, user } = useAuth()
  const { assignedSections, isAccepted, applicationStatus, loading } = useAssignedClass()
  const { sessions } = useSessions()
  const sessionOf = (sessionId: string | null) => sessions.find(s => s.id === sessionId) ?? null

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar */}
      <BrandBar>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-role-volunteer-soft text-role-volunteer">
            <Users size={12} /> Volunteer
          </span>
          <span className="font-sans text-sm text-white/70">{profile?.display_name}</span>
          <button onClick={signOut} className="font-sans text-sm text-white/60 hover:text-white transition">
            Sign out
          </button>
        </div>
      </BrandBar>

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
        ) : !isAccepted && applicationStatus === 'rejected' ? (
          <div className="bg-surface border border-border rounded-xl shadow-sm p-10 text-center">
            <h2 className="font-sans font-semibold text-xl text-ink mb-2">Application not accepted</h2>
            <p className="font-sans text-ink-muted text-base">
              Thank you for applying to volunteer with Steel City Codes. We weren't able to offer you a spot this year — we'd love for you to apply again next summer.
            </p>
          </div>
        ) : !isAccepted ? (
          /* Application pending — volunteer role set but no volunteers row yet */
          <>
          <div className="bg-surface border border-border rounded-xl shadow-sm p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-warning-soft flex items-center justify-center mx-auto mb-4">
              <Clock size={24} className="text-warning" />
            </div>
            <h2 className="font-sans font-semibold text-xl text-ink mb-2">Application under review</h2>
            <p className="font-sans text-ink-muted text-base">
              Your application is being reviewed. You'll be notified once an admin accepts it and assigns you to a section.
            </p>
          </div>
          <InterviewCard />
          </>
        ) : assignedSections.length === 0 ? (
          /* Accepted but not yet assigned to any section */
          <>
            <div className="bg-surface border border-border rounded-xl shadow-sm p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-role-volunteer-soft flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-role-volunteer" />
              </div>
              <h2 className="font-sans font-semibold text-xl text-ink mb-2">No section assigned yet</h2>
              <p className="font-sans text-ink-muted text-base">An admin will assign you to a section before camp starts.</p>
            </div>
            <div className="space-y-3">
              <h2 className="font-sans font-bold text-xl text-ink">Duty schedule</h2>
              <DutyPanel userId={user!.id} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-sans font-bold text-2xl text-ink">My sections</h1>
              <p className="font-sans text-sm text-ink-muted">{today}</p>
            </div>
            <div className="space-y-8">
              {assignedSections.map(sec => (
                <RollCallPanel key={sec.id} section={sec} session={sessionOf(sec.session_id)} />
              ))}
            </div>
            <UpdatesPanel leadSections={assignedSections.filter(sec => sec.is_lead)} userId={user!.id} />
            <TodaySchedulePanel />
            <div className="space-y-3">
              <h2 className="font-sans font-bold text-xl text-ink">Duty schedule</h2>
              <DutyPanel userId={user!.id} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
