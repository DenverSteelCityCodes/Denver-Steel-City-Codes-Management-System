import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, Printer } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { buttonClass } from '../lib/ui'
import { letterSentence, todayInDenver, type HoursWeek } from '../lib/volunteerHours'

// Service-hour letters (spec B2), laid out like the 2026 hand-made ones, one per printed page. A
// volunteer gets their own letter for the week; an admin gets every ready letter for the week, or
// one with ?volunteer=<id>. "Print" is also how to save it as a PDF.

type Letter = HoursWeek & { volunteer_id?: string }
// admin_volunteer_hours() rows are all for the week asked for; a volunteer's own rows cover the year.
const forSession = (rows: (Omit<HoursWeek, 'session_id'> & { session_id?: string; volunteer_id?: string })[], sessionId: string): Letter[] =>
  rows.filter(r => !r.session_id || r.session_id === sessionId).map(r => ({ ...r, session_id: sessionId }))

function LetterPage({ letter, today }: { letter: Letter; today: string }) {
  // The signer prints only once both name and title are set; until then the line is left blank.
  const signer = letter.signer_name && letter.signer_title ? [letter.signer_name, letter.signer_title] : null
  return (
    <article className="letter bg-surface border border-border rounded px-6 py-8 md:px-14 md:py-12 max-w-[8.5in] mx-auto">
      <header>
        <p className="font-extrabold">Steel City Codes // Denver</p>
        <p className="text-ink-muted">denver@steelcitycodes.org</p>
        <p className="mt-8">{today}</p>
      </header>
      <h2 className="mt-8 font-display font-bold text-[1.5rem] leading-[1.2] text-balance print:text-[16pt]">
        Volunteer Record / Service Hour Verification
      </h2>
      <p className="mt-6 text-lg leading-relaxed text-pretty print:text-[12pt]">{letterSentence(letter)}</p>
      <p className="mt-6 leading-relaxed text-pretty">
        For questions about this record, contact Steel City Codes Denver at denver@steelcitycodes.org.
      </p>
      <div className="mt-16 max-w-[20rem]">
        <div className="sig-line border-b-2 border-ink h-10" />
        {signer && <><p className="mt-2 font-bold">{signer[0]}</p><p>{signer[1]}</p></>}
        <p className={signer ? '' : 'mt-2'}>Steel City Codes Denver</p>
      </div>
    </article>
  )
}

export default function PrintHours() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [params] = useSearchParams()
  const only = params.get('volunteer')
  const { role } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'

  // Kept with the week it was read for, so another week's letters never show while this one loads.
  const [result, setResult] = useState<{ sessionId: string; rows: Letter[]; error: string | null } | null>(null)

  useEffect(() => {
    if (!sessionId || !role) return
    let cancelled = false
    const read = isAdmin
      ? supabase.rpc('admin_volunteer_hours', { p_session_id: sessionId })
      : supabase.rpc('my_volunteer_hours')
    read.then(({ data, error: err }) => {
      if (cancelled) return
      setResult({ sessionId, rows: err ? [] : forSession(data ?? [], sessionId), error: err?.message ?? null })
    })
    return () => { cancelled = true }
  }, [sessionId, role, isAdmin])

  const current = result?.sessionId === sessionId ? result : null
  const rows = current?.rows ?? null
  const error = current?.error ?? null
  // ?volunteer= narrows an admin's letters to one person; a volunteer only ever has their own.
  const pick = (r: Letter) => !isAdmin || !only || r.volunteer_id === only
  const letters = (rows ?? []).filter(r => r.letter_ready && pick(r))
  const notReady = (rows ?? []).find(r => !r.letter_ready && pick(r))
  const today = todayInDenver()
  const home = isAdmin ? '/admin/volunteers?tab=hours' : '/volunteer/profile#hours'
  // Back returns to where the letter was opened from; a direct visit has nowhere to go back to.
  const back = () => location.key === 'default' ? navigate(home) : navigate(-1)

  // The saved PDF is named after the page title.
  const title = letters.length === 0 ? null
    : letters.length === 1 ? `Service hours, Week ${letters[0].week_number}, ${letters[0].letter_name}`
    : `Service hours, Week ${letters[0].week_number}, ${letters.length} letters`
  useEffect(() => {
    if (!title) return
    const before = document.title
    document.title = title
    return () => { document.title = before }
  }, [title])

  return (
    <div className="min-h-dvh bg-bg text-ink print-root">
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.75in; }
          body, .print-root { background: #fff !important; color: #000 !important; font-size: 11pt; line-height: 1.45; }
          .print-root * { color: #000 !important; box-shadow: none !important; }
          .letter { border: 0 !important; padding: 0 !important; background: #fff !important; max-width: none !important; }
          .letter + .letter { break-before: page; }
          .sig-line { border-color: #000 !important; }
        }
      `}</style>

      <nav aria-label="Letter actions" className="print:hidden max-w-[8.5in] mx-auto px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className={buttonClass('secondary')} onClick={back}>
          <ArrowLeft size={18} strokeWidth={2.25} aria-hidden="true" /> Back
        </button>
        {letters.length > 0 && (
          <button type="button" className={buttonClass('primary')} onClick={() => window.print()}>
            <Printer size={18} strokeWidth={2.25} aria-hidden="true" /> Print or save as PDF
          </button>
        )}
        {isAdmin && letters.length > 1 && <p className="basis-full text-sm text-ink-muted">{letters.length} letters, one per page.</p>}
        {!isAdmin && letters.length === 1 && !letters[0].has_legal_name && (
          <p className="basis-full text-sm text-ink-muted text-pretty">
            This letter uses your account name. To print your legal name instead, add it in <Link to="/volunteer/profile" className="font-bold underline underline-offset-[3px]">Profile</Link>.
          </p>
        )}
      </nav>

      <main className="max-w-[8.5in] mx-auto px-4 pb-10 space-y-6 print:p-0 print:max-w-none print:space-y-0">
        <h1 className="sr-only">Service hour letters</h1>
        {rows === null ? (
          <div className="bg-surface border border-border rounded p-8 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading the letter">
            <div className="h-5 w-1/3 bg-surface-sunken rounded" />
            <div className="h-7 w-2/3 bg-surface-sunken rounded" />
            <div className="h-20 bg-surface-sunken rounded" />
          </div>
        ) : error ? (
          <p role="alert" className="flex items-start gap-1.5 font-bold text-danger">
            <CircleAlert size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />
            Couldn't load the hours. Check your connection and reload the page.
          </p>
        ) : letters.length > 0 ? (
          letters.map(l => <LetterPage key={l.volunteer_id ?? l.session_id} letter={l} today={today} />)
        ) : notReady ? (
          <p className="text-pretty">
            The letter for Week {notReady.week_number} is ready from its last day, once there are hours to certify.
          </p>
        ) : (
          <p className="text-ink-muted text-pretty">There are no hours to certify for this week.</p>
        )}
      </main>
    </div>
  )
}
