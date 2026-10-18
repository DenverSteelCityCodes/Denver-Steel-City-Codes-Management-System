import { useState } from 'react'
import { Check } from 'lucide-react'
import InterviewSlotPicker from '../../components/InterviewSlotPicker'
import { useMyInterview } from '../../hooks/useMyInterview'
import { useOpenInterviewSlots, formatSlot } from '../../hooks/useOpenInterviewSlots'
import { PageHead, btnCls, primaryCls } from './parts'

// An applicant's page: where the application stands as four steps (a real sequence, so numbered),
// with the interview picker inside step 2. Same data as before: application status and booking.
export default function VolunteerApplicant({ status, appliedAt }: { status: string | null; appliedAt: string | null }) {
  if (status === 'rejected') {
    return (
      <div className="max-w-[640px]">
        <PageHead title="Application not accepted">
          Thank you for applying to volunteer with Steel City Codes. We weren't able to offer you a spot this year — we'd love for you to apply again next summer.
        </PageHead>
      </div>
    )
  }
  return (
    <div className="max-w-[640px]">
      <PageHead title="Your application">Here's where everything stands.</PageHead>
      <ol className="mt-7">
        <Step n={1} state="done" title="Application received">
          {appliedAt ? new Date(appliedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null}
        </Step>
        <Step n={2} state="current" title="Interview"><InterviewStep /></Step>
        <Step n={3} state="todo" title="Decision">We email everyone after interviews wrap up.</Step>
        <Step n={4} state="todo" title="Your class" last>An admin will assign you to a section before camp starts.</Step>
      </ol>
    </div>
  )
}

function Step({ n, state, title, last = false, children }: { n: number; state: 'done' | 'current' | 'todo'; title: string; last?: boolean; children?: React.ReactNode }) {
  return (
    <li className={`relative grid grid-cols-[2rem_1fr] gap-3.5 ${last ? '' : 'pb-6'}`} aria-current={state === 'current' ? 'step' : undefined}>
      {!last && <span aria-hidden="true" className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${state === 'done' ? 'bg-success' : 'bg-border-strong'}`} />}
      <span aria-hidden="true" className={`w-8 h-8 rounded-full grid place-items-center font-sans font-bold text-[15px] border-2 ${
        state === 'done' ? 'bg-success border-success text-surface'
          : state === 'current' ? 'bg-brand border-brand text-brand-on'
            : 'bg-bg border-border-strong text-ink-muted'}`}>
        {state === 'done' ? <Check size={16} /> : n}
      </span>
      <div className="min-w-0 pt-1">
        <h2 className="font-sans font-bold text-[17px] text-ink leading-snug">
          {title}<span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
        </h2>
        {children && <div className="font-sans text-[15px] text-ink-muted mt-0.5">{children}</div>}
      </div>
    </li>
  )
}

// Pick or move the interview time (moved here from the old dashboard's interview card).
function InterviewStep() {
  const { interview, loading, book } = useMyInterview()
  const { slots, refetch } = useOpenInterviewSlots()
  const [choosing, setChoosing] = useState(false)
  const [picked, setPicked] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (!picked) { setErr('Pick a time first'); return }
    setSaving(true); setErr(null)
    try { await book(picked); setChoosing(false); setPicked(''); refetch() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong'); refetch() }
    finally { setSaving(false) }
  }

  if (loading) return <div className="h-16 mt-2 bg-surface-sunken rounded-[10px] animate-pulse" />
  const showPicker = choosing || !interview

  return (
    <div>
      {interview ? (
        <>
          <p className="font-sans font-bold text-2xl text-ink leading-tight mt-1.5" id="interview-time">{formatSlot(interview.slot_datetime)}</p>
          <p>{interview.duration_minutes} minutes, online.</p>
        </>
      ) : (
        <p id="interview-time">Pick a time for your short online interview.</p>
      )}
      {interview && !choosing && (
        <button type="button" onClick={() => setChoosing(true)} className={`${btnCls} mt-3`}>Change time</button>
      )}
      {showPicker && slots && (
        <div className="mt-3 space-y-3">
          <InterviewSlotPicker slots={slots} value={picked} onChange={setPicked} labelledBy="interview-time" />
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          {slots.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {interview && (
                <button type="button" onClick={() => { setChoosing(false); setPicked(''); setErr(null) }} className={btnCls}>Keep my time</button>
              )}
              <button type="button" onClick={save} disabled={saving || !picked} className={primaryCls}>
                {saving ? 'Booking…' : interview ? 'Move my interview' : 'Book this time'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
