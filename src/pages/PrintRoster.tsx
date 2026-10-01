import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildMailto, copyText } from '../lib/mailto'
import { useSectionRoster } from '../hooks/useSectionRoster'
import { formatDayLong, formatTimeRange, localDateISO } from '../lib/campDay'
import { realNote } from '../lib/campers'

const MAILTO_LIMIT = 1800

function Box() {
  return <span className="inline-block w-5 h-5 border border-border-strong rounded-sm align-middle box" />
}

export default function PrintRoster() {
  const { sectionId } = useParams<{ sectionId: string }>()
  const { section, students, loading, error } = useSectionRoster(sectionId)

  const [emails, setEmails] = useState<string[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!sectionId) return
    let cancelled = false
    supabase
      .rpc('update_recipient_emails', { p_audience: 'section', p_section_id: sectionId })
      .then(({ data }) => { if (!cancelled && Array.isArray(data)) setEmails(data as string[]) })
    return () => { cancelled = true }
  }, [sectionId])

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
    if (err) { flash(err.message); return null }
    const list = (data ?? []) as string[]
    setEmails(list)
    return list
  }

  async function copyAll() {
    const list = await fetchEmails()
    if (!list) return
    if (list.length === 0) { flash('No parent emails found'); return }
    const ok = await copyText(list.join(', '))
    flash(ok ? `Copied ${list.length} emails` : 'Could not copy to clipboard')
  }

  async function emailAll(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    const list = emails.length ? emails : await fetchEmails()
    if (!list) return
    if (list.length === 0) { flash('No parent emails found'); return }
    const href = buildMailto(list, '', '')
    if (href.length <= MAILTO_LIMIT) { window.location.href = href; return }
    const ok = await copyText(list.join(', '))
    flash(ok ? `List too long for a mail link. Copied ${list.length} emails instead` : 'Could not copy to clipboard')
  }

  const btn = 'inline-flex items-center justify-center min-h-10 px-4 rounded-lg border border-border bg-surface text-sm font-semibold text-ink hover:bg-surface-sunken cursor-pointer'
  const today = localDateISO()
  const schedule = section
    ? [section.days, formatTimeRange(section.start_time, section.end_time), section.room].filter(Boolean).join(' · ')
    : ''

  return (
    <div className="min-h-screen bg-bg text-ink print-root">
      <style>{`
        @media print {
          @page { margin: 12mm; }
          body, .print-root { background: #fff !important; color: #000 !important; font-size: 11pt; }
          .print-root * { color: #000 !important; box-shadow: none !important; }
          .print-card { border: 0 !important; padding: 0 !important; background: #fff !important; border-radius: 0 !important; }
          .print-table { border-collapse: collapse; width: 100%; }
          .print-table th, .print-table td { border: 1px solid #000 !important; }
          .print-table tr { break-inside: avoid; }
          .print-table thead { display: table-header-group; }
          .print-table .box { border-color: #000 !important; }
        }
      `}</style>

      <div className="print:hidden bg-surface border-b border-border px-4 py-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => window.history.back()}>← Back</button>
        <button type="button" className={`${btn} !bg-brand !border-brand !text-brand-on hover:!bg-brand-hover`} onClick={() => window.print()}>Print</button>
        <button type="button" className={btn} onClick={copyAll}>Copy all parent emails</button>
        <a href={buildMailto(emails, '', '')} onClick={emailAll} className={btn}>Email all parents</a>
        {msg && <span role="status" className="text-sm text-ink-muted">{msg}</span>}
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="bg-surface border border-border rounded-xl p-6 space-y-3 animate-pulse" aria-busy="true">
            <div className="h-6 w-1/2 bg-surface-sunken rounded" />
            <div className="h-4 w-1/3 bg-surface-sunken rounded" />
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-surface-sunken rounded" />)}
          </div>
        ) : error ? (
          <div role="alert" className="bg-danger-soft text-danger border border-danger rounded-lg px-4 py-3 text-sm">{error}</div>
        ) : !section ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-sm text-ink-muted">
            This section doesn't exist or you don't have access.
          </div>
        ) : (
          <div className="print-card bg-surface border border-border rounded-xl p-6">
            <header className="mb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-sm font-bold tracking-wide">Steel City Codes // Denver</p>
                <p className="text-sm">Date: ______________</p>
              </div>
              <h1 className="text-xl font-bold mt-1">
                {section.class_name} · {section.label}{section.week ? ` · Week ${section.week}` : ''}
              </h1>
              {schedule && <p className="text-sm text-ink-muted">{schedule}</p>}
              {section.lead_name && <p className="text-sm text-ink-muted">Lead: {section.lead_name}</p>}
              <p className="text-xs text-ink-muted mt-1">Printed {formatDayLong(today)}</p>
            </header>

            <div className="overflow-x-auto">
              <table className="print-table w-full text-sm border-collapse border border-border">
                <thead>
                  <tr className="bg-surface-sunken text-left">
                    {['#', 'Camper', 'Age', 'Allergies / medical', 'Parent', 'Emergency contact', 'Arrival', 'After lunch', 'Dismissal', 'Notes'].map(h => (
                      <th key={h} className="border border-border px-2 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 && (
                    <tr><td colSpan={10} className="border border-border px-2 py-4 text-center text-ink-muted">No campers registered.</td></tr>
                  )}
                  {students.map((s, i) => {
                    const flags = [realNote(s.allergies), realNote(s.medical_conditions) ?? realNote(s.medical_info)].filter(Boolean)
                    return (
                      <tr key={s.id} className="align-top">
                        <td className="border border-border px-2 py-2">{i + 1}</td>
                        <td className="border border-border px-2 py-2 font-semibold">{s.full_name}</td>
                        <td className="border border-border px-2 py-2">{s.age ?? ''}</td>
                        <td className="border border-border px-2 py-2 font-bold min-w-44">{flags.join('; ')}</td>
                        <td className="border border-border px-2 py-2 min-w-36">
                          {s.parent_name}{s.parent_phone && <div>{s.parent_phone}</div>}
                        </td>
                        <td className="border border-border px-2 py-2 min-w-36">
                          {s.emergency_contact_name}
                          {s.emergency_contact_relation ? ` (${s.emergency_contact_relation})` : ''}
                          {s.emergency_contact_phone && <div>{s.emergency_contact_phone}</div>}
                        </td>
                        <td className="border border-border px-2 py-2 text-center"><Box /></td>
                        <td className="border border-border px-2 py-2 text-center"><Box /></td>
                        <td className="border border-border px-2 py-2 text-center"><Box /></td>
                        <td className="border border-border px-2 py-2 min-w-28" />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-ink-muted mt-4">Confidential — for camp staff only. Shred after the camp week.</p>
          </div>
        )}
      </div>
    </div>
  )
}
