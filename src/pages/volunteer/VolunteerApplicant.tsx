import { useState } from 'react'
import { Check, CircleAlert, CircleCheck } from 'lucide-react'
import InterviewSlotPicker from '../../components/InterviewSlotPicker'
import SignBand from '../../components/SignBand'
import { useMyInterview } from '../../hooks/useMyInterview'
import { useOpenInterviewSlots, formatSlot } from '../../hooks/useOpenInterviewSlots'
import { CAMP_TIME_ZONE, formatCampTime } from '../../lib/denverTime'
import { PageHead, h2Cls, linkCls, primaryCls } from './parts'

const CAMP_EMAIL = 'denver@steelcitycodes.org'
const longDay = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso))
const focusSign = () => requestAnimationFrame(() => document.getElementById('interview-h')?.focus())

// No dead ends: whatever the state, the applicant can reach a person.
function Contact() {
  return (
    <p className="mt-10 text-ink-muted">
      Questions? Email the camp at <a href={`mailto:${CAMP_EMAIL}`} className={`${linkCls} text-ink`}>{CAMP_EMAIL}</a>
    </p>
  )
}

// An applicant's page. The one next decision is the interview, so its time is the gold sign; the
// picker opens directly under it. Then where the application stands, as four numbered steps (a real
// sequence). Same data as before: application status and the booking.
export default function VolunteerApplicant({ status, appliedAt }: { status: string | null; appliedAt: string | null }) {
  const { interview, loading, book } = useMyInterview()
  if (status === 'rejected') {
    return (
      <div className="max-w-[640px]">
        <PageHead title="Application not accepted">
          Thank you for applying to volunteer with Steel City Codes. We weren't able to offer you a spot this year — we'd love for you to apply again next summer.
        </PageHead>
        <Contact />
      </div>
    )
  }
  return (
    <div className="max-w-[640px]">
      <PageHead title="Your application" />
      {loading ? <div className="h-36 mt-5 bg-surface-sunken rounded animate-pulse" /> : <InterviewStep interview={interview} book={book} />}
      <h2 className="sr-only" id="steps-h">Application steps</h2>
      <ol aria-labelledby="steps-h" className="mt-8">
        <Step n={1} state="done" title="Application received">
          {appliedAt ? new Date(appliedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null}
        </Step>
        <Step n={2} state="current" title="Interview">{interview ? formatSlot(interview.slot_datetime) : 'Not booked yet'}</Step>
        <Step n={3} state="todo" title="Decision">Your decision shows up here after interviews wrap up.</Step>
        <Step n={4} state="todo" title="Your class">An admin will assign you to a section before camp starts.</Step>
      </ol>
      <Contact />
    </div>
  )
}

// Done is a green check, the current step an ink square, later steps an outlined number.
function Step({ n, state, title, children }: { n: number; state: 'done' | 'current' | 'todo'; title: string; children?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-4 py-3 border-t border-border first:border-t-0" aria-current={state === 'current' ? 'step' : undefined}>
      <span aria-hidden="true" className={`w-8 h-8 rounded grid place-items-center text-sm font-extrabold border-2 ${
        state === 'done' ? 'border-success bg-success-soft text-success'
          : state === 'current' ? 'border-ink bg-ink text-bg'
            : 'border-border-strong text-ink-muted'}`}>
        {state === 'done' ? <Check size={18} strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0">
        <h3 className="text-lg font-bold leading-[1.3] text-ink">
          {title}<span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
        </h3>
        {children && <p className={state === 'current' ? 'text-ink' : 'text-ink-muted'}>{children}</p>}
      </div>
    </li>
  )
}

type Interview = ReturnType<typeof useMyInterview>['interview']

// Pick or move the interview time. The applicant's own slot is booked, so the open list doesn't
// carry it; it is added back, marked "Your time", and pre-selected so nothing moves by accident.
function InterviewStep({ interview, book }: { interview: Interview; book: (slotId: string) => Promise<void> }) {
  const { slots, refetch } = useOpenInterviewSlots()
  const [choosing, setChoosing] = useState(false)
  const [picked, setPicked] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [moved, setMoved] = useState<string | null>(null)

  const current = interview?.slot_id ?? ''
  const value = picked || current
  const options = slots && interview && !slots.some(s => s.id === current)
    ? [...slots, { id: current, slot_datetime: interview.slot_datetime, duration_minutes: interview.duration_minutes }]
    : slots
  const target = options?.find(s => s.id === value && s.id !== current)
  const others = options?.filter(s => s.id !== current).length ?? 0
  const showPicker = choosing || !interview

  function close() { setChoosing(false); setPicked(''); setErr(null); focusSign() }

  async function save() {
    if (!target) return
    setSaving(true); setErr(null)
    try {
      await book(target.id)
      setMoved(interview ? `Moved. Your interview is now ${formatSlot(target.slot_datetime)}.` : `Booked for ${formatSlot(target.slot_datetime)}.`)
      setChoosing(false); setPicked(''); refetch(); focusSign()
    } catch {
      setErr(`Couldn't book ${formatSlot(target.slot_datetime)}. Someone may have just taken it, so the times are refreshed. Pick another.`)
      setPicked(''); refetch()
    } finally { setSaving(false) }
  }

  const time = interview ? formatCampTime(interview.slot_datetime) : ''
  const [figure, unit] = time.split(/\s+/)

  return (
    <div className="mt-5">
      {interview ? (
        <SignBand id="interview" context="Step 2 of 4: your interview" figure={figure} unit={unit}
          message={longDay(interview.slot_datetime)}
          sub={`${interview.duration_minutes} minutes, online. The time is Denver time.`}>
          {!choosing && (
            <button type="button" onClick={() => { setMoved(null); setChoosing(true); requestAnimationFrame(() => document.getElementById('pick-h')?.focus()) }}
              className="ui-btn ui-btn--secondary mt-3 border-brand-on text-brand-on hover:bg-brand-on/10">
              Change time
            </button>
          )}
        </SignBand>
      ) : (
        <SignBand id="interview" context="Step 2 of 4: your interview" message="Pick a time for your interview"
          sub="It's a short online interview. All times are Denver time." />
      )}
      {moved && !choosing && (
        <p role="status" className="mt-3 flex items-start gap-1.5 font-bold text-success">
          <CircleCheck size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />{moved}
        </p>
      )}

      {showPicker && options && (
        <section aria-labelledby="pick-h" className="mt-6">
          <h2 id="pick-h" tabIndex={-1} className={`${h2Cls} scroll-mt-6 focus:outline-none`}>{interview ? 'Pick a new time' : 'Pick a time'}</h2>
          {others === 0 ? (
            // Nothing to pick: the only time listed would be the applicant's own.
            <p className="mt-2 text-ink text-pretty">
              {interview ? 'No other times are open right now.' : 'No interview times are open right now.'} New times show up here, so check back soon.
            </p>
          ) : (
            <div className="mt-2">
              <InterviewSlotPicker slots={options} value={value} onChange={id => { setErr(null); setPicked(id) }} labelledBy="pick-h" currentId={current || undefined} />
            </div>
          )}
          {err && (
            <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm font-bold text-danger">
              <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{err}
            </p>
          )}
          <div className="mt-4">
            {others > 0 && (
              <button type="button" onClick={() => void save()} disabled={saving || !target} aria-busy={saving} className={`${primaryCls} w-full`}>
                {saving ? 'Booking…'
                  : target ? `${interview ? 'Move to' : 'Book'} ${formatSlot(target.slot_datetime)}`
                    : interview ? 'Pick a new time above' : 'Pick a time above'}
              </button>
            )}
            {interview && (
              <button type="button" onClick={close} className={`${linkCls} ${others > 0 ? 'mt-1' : ''}`}>Keep {formatSlot(interview.slot_datetime)}</button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
