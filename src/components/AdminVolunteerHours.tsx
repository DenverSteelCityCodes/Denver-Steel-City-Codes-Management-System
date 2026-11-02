import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminVolunteerHours } from '../hooks/useAdminVolunteerHours'
import { useAppSettings } from '../hooks/useAppSettings'
import { useSessions, campSessions } from '../hooks/useSessions'
import { campDateKey } from '../lib/denverTime'
import { parseLocalDate } from '../lib/campDay'
import { formatHours, hoursWord, totalMinutes, formatWeekDates } from '../lib/volunteerHours'
import { buttonClass } from '../lib/ui'
import Button from './Button'
import { Input } from './Field'
import Segmented from './Segmented'
import { h2Class } from './AdminPageHead'

const th = 'px-3 py-2.5 text-sm font-bold text-ink-muted border-b border-ink'
const td = 'px-3 py-3 align-middle max-md:p-0 max-md:py-1'
const mobileLabel = 'block md:hidden text-sm font-bold text-ink-muted'

function HoursSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the hours" className="border-y-2 border-ink">
      {[1, 2, 3, 4].map(i => <div key={i} aria-hidden="true" className="h-12 my-1 rounded bg-surface-sunken animate-pulse" />)}
    </div>
  )
}

function SignerForm({ settings, updateSetting }: Pick<ReturnType<typeof useAppSettings>, 'settings' | 'updateSetting'>) {
  const [name, setName] = useState(settings.hours_letter_signer_name ?? '')
  const [title, setTitle] = useState(settings.hours_letter_signer_title ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await updateSetting('hours_letter_signer_name', name.trim())
      await updateSetting('hours_letter_signer_title', title.trim())
      setSaved(true)
    } catch (error) {
      setError(`Couldn't save the signer: ${error instanceof Error ? error.message : 'Check your connection and try again.'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-4 max-w-[640px] space-y-4">
      <div>
        <label htmlFor="hours-signer-name" className="block font-bold mb-1.5">Name</label>
        <Input id="hours-signer-name" value={name} disabled={saving}
          onChange={e => { setName(e.target.value); setSaved(false); setError(null) }} />
      </div>
      <div>
        <label htmlFor="hours-signer-title" className="block font-bold mb-1.5">Title</label>
        <Input id="hours-signer-title" value={title} disabled={saving}
          onChange={e => { setTitle(e.target.value); setSaved(false); setError(null) }} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        <p aria-live="polite" className="text-sm font-bold text-ink-muted">{saved ? 'Saved.' : ''}</p>
      </div>
      {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
    </form>
  )
}

export default function AdminVolunteerHours() {
  const { sessions, loading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useSessions()
  const { settings, loading: settingsLoading, error: settingsError, updateSetting } = useAppSettings()
  const weeks = campSessions(sessions)
  const [pickedWeek, setPickedWeek] = useState('')
  const today = campDateKey(new Date().toISOString())
  const defaultWeek = weeks.filter(w => w.start_date <= today).at(-1) ?? weeks[0]
  const week = weeks.find(w => w.id === pickedWeek) ?? defaultWeek
  const sessionId = week?.id ?? null
  const { rows, loading, error, refetch } = useAdminVolunteerHours(sessionId)
  // Counted per volunteer, so a section with two crew shows up twice: say which crew, not a count.
  const untimed = rows.filter(row => row.untimed_sections > 0)
  const lettersReady = rows.some(row => row.letter_ready)
  const loadError = sessionsError ?? error

  return (
    <div className="min-w-0 space-y-10">
      <section aria-label="Weekly volunteer hours" className="min-w-0 space-y-4">
        {weeks.length > 0 && (
          <Segmented label="Week" value={sessionId ?? ''} onChange={setPickedWeek}
            options={weeks.map(w => ({ value: w.id, label: w.name }))} />
        )}
        {week && <p className="font-bold">{formatWeekDates(week.start_date, week.end_date)}</p>}
        <p className="text-ink-muted text-pretty">Hours count weekdays crewed so far, minus days off, plus duties. Letters are ready from the week's last day.</p>

        {sessionsLoading || loading ? <HoursSkeleton /> : loadError ? (
          <div role="alert" className="py-4 border-y-2 border-ink flex flex-wrap items-center gap-3">
            <p title={loadError} className="flex-1 font-bold text-danger">Couldn't load the hours. Check your connection, then try again.</p>
            <Button onClick={() => { if (sessionsError) void refetchSessions(); else refetch() }}>Try again</Button>
          </div>
        ) : !week ? (
          <p className="py-4 border-y-2 border-ink text-ink-muted">No camp weeks yet.</p>
        ) : (
          <>
            {untimed.length > 0 && (
              <div className="border-2 border-ink rounded p-4 text-ink">
                <p className="text-pretty">
                  {untimed.length === 1 ? `${untimed[0].display_name} crews` : `${untimed.length} volunteers (marked below) crew`} a section with no start or end time this week, so it adds no hours. Set its times in Classes.
                </p>
                <Link to="/admin/classes" className={buttonClass('text')}>Classes</Link>
              </div>
            )}
            <div>
              {lettersReady ? (
                <Link to={`/print/hours/${sessionId}`} className={buttonClass('ink')}>Print all letters</Link>
              ) : (
                <p className="text-ink-muted">Letters are ready from {parseLocalDate(week.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
              )}
            </div>
            {rows.length === 0 ? (
              <p className="py-4 border-y-2 border-ink text-lg font-bold">Nobody is crewed or on a duty this week.</p>
            ) : (
              <table className="w-full table-fixed bg-surface border-y-2 border-ink max-md:block max-md:bg-transparent">
                <caption className="sr-only">Volunteer hours for {week.name}</caption>
                <thead className="max-md:sr-only">
                  <tr>
                    <th scope="col" className={`${th} text-left w-1/3`}>Volunteer</th>
                    <th scope="col" className={`${th} text-right`}>Days crewed</th>
                    <th scope="col" className={`${th} text-right`}>Crew hours</th>
                    <th scope="col" className={`${th} text-right`}>Duty hours</th>
                    <th scope="col" className={`${th} text-right`}>Total</th>
                    <th scope="col" className={`${th} text-right`}>Letter</th>
                  </tr>
                </thead>
                <tbody className="max-md:block">
                  {rows.map(row => (
                    <tr key={row.volunteer_id} className="border-t border-border first:border-t-0 hover:bg-ink/[0.03] max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:py-3">
                      <td className={`${td} max-md:col-span-2 [overflow-wrap:anywhere]`}>
                        <b className="font-bold">{row.display_name}</b>
                        <span className="block text-sm text-ink-muted">Letter name: {row.letter_name}</span>
                        {!row.has_legal_name && <span className="block text-sm text-ink-muted">No legal name on file</span>}
                        {row.untimed_sections > 0 && <span className="block text-sm font-bold text-ink">Section times missing: class hours not counted</span>}
                      </td>
                      <td className={`${td} md:text-right`}><span className={mobileLabel}>Days crewed</span>{row.crew_days}</td>
                      <td className={`${td} text-right`}><span className={mobileLabel}>Crew hours</span>{formatHours(row.crew_minutes)}</td>
                      <td className={`${td} md:text-right`}><span className={mobileLabel}>Duty hours</span>{formatHours(row.duty_minutes)}</td>
                      <td className={`${td} text-right`}><span className={mobileLabel}>Total</span><b className="font-bold">{hoursWord(totalMinutes(row))}</b></td>
                      <td className={`${td} text-right max-md:col-span-2`}>
                        {row.letter_ready && <Link to={`/print/hours/${sessionId}?volunteer=${row.volunteer_id}`} className={buttonClass('text')}>Letter<span className="sr-only"> for {row.display_name}</span></Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="hours-signer-heading" className="border-t-2 border-ink pt-6">
        <h2 id="hours-signer-heading" className={h2Class}>Letters are signed by</h2>
        {settingsLoading ? (
          <div aria-busy="true" aria-label="Loading the signer" className="mt-4 h-12 rounded bg-surface-sunken animate-pulse" />
        ) : settingsError ? (
          <p role="alert" title={settingsError} className="mt-4 font-bold text-danger">Couldn't load the signer. Check your connection, then reload the page.</p>
        ) : <SignerForm settings={settings} updateSetting={updateSetting} />}
      </section>
    </div>
  )
}
