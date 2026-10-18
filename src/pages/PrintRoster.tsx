import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, Copy, Laptop, Mail, Printer } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { buildMailto, copyText } from '../lib/mailto'
import { useSectionRoster } from '../hooks/useSectionRoster'
import { formatDayLong, formatTimeRange, localDateISO } from '../lib/campDay'
import { healthLines } from '../lib/campers'
import { buttonClass } from '../lib/ui'

const MAILTO_LIMIT = 1800

// A paper checkbox for each roll call.
function Box() {
  return <span aria-hidden="true" className="box inline-block w-[22px] h-[22px] border-2 border-border-strong rounded-sm align-middle" />
}

export default function PrintRoster() {
  const { sectionId } = useParams<{ sectionId: string }>()
  const { section, students, loading, error } = useSectionRoster(sectionId)
  const { role } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [emails, setEmails] = useState<string[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  // Parent emails are for this section's crew and admins: the same people section_roster lets in.
  // So they're read only once the roster has loaded; a section that isn't yours (or doesn't exist)
  // never asks, rather than logging a 403.
  const canEmail = !!section && section.id === sectionId
  useEffect(() => {
    if (!sectionId || !canEmail) return
    let cancelled = false
    supabase
      .rpc('update_recipient_emails', { p_audience: 'section', p_section_id: sectionId })
      .then(({ data }) => { if (!cancelled && Array.isArray(data)) setEmails(data as string[]) })
    return () => { cancelled = true }
  }, [sectionId, canEmail])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function flash(text: string) {
    setMsg(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 4000)
  }

  async function fetchEmails(): Promise<string[] | null> {
    const { data, error: err } = await supabase.rpc('update_recipient_emails', {
      p_audience: 'section', p_section_id: sectionId,
    })
    if (err) { flash("Couldn't get the parent emails. Check your connection and try again."); return null }
    const list = (data ?? []) as string[]
    setEmails(list)
    return list
  }

  async function copyAll() {
    const list = await fetchEmails()
    if (!list) return
    if (list.length === 0) { flash('No parent emails found.'); return }
    const ok = await copyText(list.join(', '))
    flash(ok ? `Copied ${list.length} emails.` : 'Your browser blocked the clipboard. Try again.')
  }

  async function emailAll(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    const list = emails.length ? emails : await fetchEmails()
    if (!list) return
    if (list.length === 0) { flash('No parent emails found.'); return }
    const href = buildMailto(list, '', '')
    if (href.length <= MAILTO_LIMIT) { window.location.href = href; return }
    const ok = await copyText(list.join(', '))
    flash(ok ? `Too many for a mail link, so ${list.length} emails were copied instead.` : 'Your browser blocked the clipboard. Try again.')
  }

  const today = localDateISO()
  const schedule = section
    ? [section.days, formatTimeRange(section.start_time, section.end_time), section.room].filter(Boolean).join(' · ')
    : ''
  // Back returns to where the roster was opened from; a direct visit has nowhere to go back to.
  const back = () => location.key === 'default' ? navigate(role === 'admin' ? '/admin/classes' : '/volunteer/classes') : navigate(-1)
  const th = 'px-3 py-3 text-left text-sm font-bold text-ink-muted whitespace-nowrap border-b border-ink bg-surface'
  const td = 'px-3 py-3 align-top border-t border-border'

  return (
    <div className="min-h-dvh bg-bg text-ink print-root">
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 0.4in; }
          body, .print-root { background: #fff !important; color: #000 !important; font-size: 10pt; line-height: 1.35; }
          .print-root * { color: #000 !important; box-shadow: none !important; }
          .print-sheet { border: 0 !important; padding: 0 !important; background: #fff !important; }
          .print-wrap { overflow: visible !important; border-color: #000 !important; }
          .print-table { min-width: 0 !important; }
          .print-table th, .print-table td { border-color: #000 !important; background: #fff !important; padding: 5px 6px !important; font-size: 10pt !important; }
          .print-table tr { break-inside: avoid; }
          .print-table thead { display: table-header-group; }
          .print-table .box { border-color: #000 !important; }
          .print-blank { border-color: #000 !important; }
        }
      `}</style>

      <nav aria-label="Roster actions" className="print:hidden max-w-[1280px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className={buttonClass('secondary')} onClick={back}>
          <ArrowLeft size={18} strokeWidth={2.25} aria-hidden="true" /> Back
        </button>
        <button type="button" className={buttonClass('primary')} onClick={() => window.print()}>
          <Printer size={18} strokeWidth={2.25} aria-hidden="true" /> Print
        </button>
        <span className="flex-1" />
        {canEmail && <span role="group" aria-labelledby="emails-label" className="inline-flex flex-wrap items-center gap-x-4">
          <span id="emails-label" className="text-sm font-bold text-ink-muted">Parent emails:</span>
          <button type="button" className={buttonClass('text')} onClick={() => void copyAll()}>
            <Copy size={16} strokeWidth={2.5} aria-hidden="true" /> Copy
          </button>
          <a href={buildMailto(emails, '', '')} onClick={e => void emailAll(e)} className={buttonClass('text')}>
            <Mail size={16} strokeWidth={2.5} aria-hidden="true" /> Email
          </a>
        </span>}
        {msg && <p role="status" className="basis-full text-sm font-bold text-ink-muted">{msg}</p>}
      </nav>

      <main className="max-w-[1280px] mx-auto px-4 md:px-8 pb-10 print:p-0 print:max-w-none">
        {loading ? (
          <div className="bg-surface border border-border rounded p-6 space-y-3 animate-pulse" aria-busy="true">
            <div className="h-6 w-1/2 bg-surface-sunken rounded" />
            <div className="h-4 w-1/3 bg-surface-sunken rounded" />
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-surface-sunken rounded" />)}
          </div>
        ) : error ? (
          <p role="alert" className="flex items-start gap-1.5 font-bold text-danger">
            <CircleAlert size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />
            Couldn't load the roster. Check your connection and reload the page.
          </p>
        ) : !section ? (
          <p className="text-ink-muted">This section doesn't exist or you don't have access.</p>
        ) : (
          <article className="print-sheet bg-surface border border-border rounded px-5 py-6 md:px-8">
            <header className="flex flex-wrap justify-between gap-x-8 gap-y-3 mb-5 print:mb-2">
              <div>
                <p className="font-extrabold">Steel City Codes // Denver</p>
                <h1 className="mt-1 font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance print:text-[18pt]">
                  <span className="whitespace-nowrap">{section.class_name}</span> · <span className="whitespace-nowrap">{section.label}{section.week ? ` · Week ${section.week}` : ''}</span>
                </h1>
                <p className="mt-1">{[schedule, section.lead_name && `Lead: ${section.lead_name}`].filter(Boolean).join(' · ')}</p>
                <p className="text-sm text-ink-muted">Printed {formatDayLong(today)}</p>
              </div>
              <p>Date: <span className="print-blank inline-block w-36 border-b-2 border-ink" /></p>
            </header>

            <div tabIndex={0} role="region" aria-label="Roster table, scrolls sideways on small screens"
              className="print-wrap overflow-x-auto border-y-2 border-ink">
              <table className="print-table w-full min-w-[1020px] border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className={`${th} text-right!`}>#</th>
                    <th scope="col" className={th}>Camper</th>
                    <th scope="col" className={`${th} w-[24%]`}>Allergies / medical</th>
                    <th scope="col" className={th}>Emergency contact</th>
                    <th scope="col" className={th}>Parent</th>
                    {/* Spec 29: who borrows one of the camp's loaner laptops this week. */}
                    <th scope="col" className={th}>
                      <span className="inline-flex items-center gap-1.5"><Laptop size={16} strokeWidth={2.5} aria-hidden="true" />Loaner</span>
                    </th>
                    <th scope="col" className={th}>Arrival</th>
                    <th scope="col" className={th}>After lunch</th>
                    <th scope="col" className={th}>Dismissal</th>
                    <th scope="col" className={`${th} w-[16%]`}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 && (
                    <tr><td colSpan={10} className={`${td} text-center text-ink-muted`}>No campers registered.</td></tr>
                  )}
                  {students.map((s, i) => {
                    const relation = s.emergency_contact_relation?.trim()
                    return (
                      <tr key={s.id}>
                        <td className={`${td} text-right`}>{i + 1}</td>
                        <td className={`${td} whitespace-nowrap`}>
                          <b className="font-bold">{s.full_name}</b>
                          {s.age != null && <span className="block text-sm text-ink-muted">age {s.age}</span>}
                        </td>
                        <td className={`${td} font-extrabold`}>
                          {healthLines(s).map(l => <span key={l.label} className="block">{l.label}: {l.text}</span>)}
                        </td>
                        <td className={td}>
                          {s.emergency_contact_name}{relation ? ` (${relation})` : ''}
                          {s.emergency_contact_phone && <span className="block whitespace-nowrap">{s.emergency_contact_phone}</span>}
                        </td>
                        <td className={td}>
                          {s.parent_name}
                          {s.parent_phone && <span className="block whitespace-nowrap">{s.parent_phone}</span>}
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          {s.laptop_loan === 'reserved' ? 'To hand out' : s.laptop_loan === 'handed_out' ? 'Handed out' : ''}
                        </td>
                        <td className={td}><Box /></td>
                        <td className={td}><Box /></td>
                        <td className={td}><Box /></td>
                        <td className={td} />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-sm text-ink-muted">Confidential — for camp staff only. Shred after the camp week.</p>
          </article>
        )}
      </main>
    </div>
  )
}
