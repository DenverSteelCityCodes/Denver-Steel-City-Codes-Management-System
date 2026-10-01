import { useState } from 'react'
import { Link } from 'react-router-dom'
import AttendanceExport from '../components/AttendanceExport'
import { Users, UserCheck, AlertTriangle, BellOff, Phone, RefreshCw, ChevronDown, Printer } from 'lucide-react'
import StatCard from '../components/StatCard'
import { useAttendanceBoard } from '../hooks/useAttendanceBoard'
import type { BoardSection, BoardStudent } from '../hooks/useAttendanceBoard'
import { ROLL_CALLS, formatDayLong, formatTime, parseLocalDate, rollCallLabel } from '../lib/campDay'
import { formatSessionDates } from '../hooks/useSessions'
import type { RollCallKind } from '../types/database'

const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`

function timeOf(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const callBtn =
  'min-h-11 px-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border-strong bg-surface text-ink font-sans font-semibold text-sm hover:bg-surface-sunken transition'

function Mark({ value }: { value: boolean | undefined }) {
  if (value === true) return <span aria-label="present" className="text-success font-semibold">✓</span>
  if (value === false) return <span aria-label="absent" className="text-danger font-semibold">✗</span>
  return <span aria-label="not marked" className="text-ink-faint">–</span>
}

function Unaccounted({ student, latest }: { student: BoardStudent; latest: RollCallKind }) {
  const why = student.marks[latest] === false ? 'Missed' : 'Not marked at'
  return (
    <li className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-sans font-semibold text-sm text-ink break-words">
          {student.full_name} <span className="font-normal text-ink-muted">· Age {student.age}</span>
        </p>
        <p className="font-sans text-xs text-ink-muted">{why} {rollCallLabel(latest)}</p>
        {student.medicalNote && <p className="font-sans text-xs text-danger break-words">{student.medicalNote}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {student.parent_phone && (
          <a href={telHref(student.parent_phone)} aria-label={`Call ${student.parent_name ?? 'parent'}`} className={callBtn}>
            <Phone size={15} /> Call parent
          </a>
        )}
        {student.emergency_contact_phone && (
          <a
            href={telHref(student.emergency_contact_phone)}
            aria-label={`Call ${student.emergency_contact_name ?? 'emergency contact'}`}
            className={callBtn}
          >
            <Phone size={15} /> Call {student.emergency_contact_name ?? 'emergency contact'}
          </a>
        )}
      </div>
    </li>
  )
}

function SectionCard({ section }: { section: BoardSection }) {
  const [open, setOpen] = useState(false)
  const { latest, unaccounted } = section
  return (
    <section className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 space-y-3">
        <div className="min-w-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
          <h2 className="font-sans font-bold text-base text-ink break-words">{section.className} · {section.label}</h2>
          <p className="font-sans text-xs text-ink-muted">
            {section.leadName ? `Lead: ${section.leadName}` : 'No lead assigned'}
            {section.room ? ` · ${section.room}` : ''}
            {` · ${section.roster.length} camper${section.roster.length === 1 ? '' : 's'}`}
          </p>
          </div>
          <Link to={`/print/roster/${section.id}`} title="Printable roster" aria-label={`Print ${section.label} roster`}
            className="p-2 shrink-0 text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[8px] transition">
            <Printer size={16} />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLL_CALLS.map(({ key, label }) => {
            const rc = section.rollCalls[key]
            if (!rc.taken) {
              return (
                <span key={key} className="px-2.5 py-1 rounded-full bg-surface-sunken text-ink-muted font-sans text-xs font-medium">
                  {label} — not taken
                </span>
              )
            }
            const tone = rc.absent > 0 || rc.unmarked > 0 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
            return (
              <span key={key} className={`px-2.5 py-1 rounded-full font-sans text-xs font-medium ${tone}`}>
                {label} {rc.present}/{section.roster.length} · {timeOf(rc.takenAt)}
              </span>
            )
          })}
        </div>
        {latest === null && (
          <p className="px-3 py-2 rounded-[10px] bg-warning-soft text-warning font-sans text-sm font-medium">
            No roll call taken yet — call the lead.
          </p>
        )}
        {latest && unaccounted.length === 0 && (
          <p className="font-sans text-sm text-success font-medium">Everyone accounted for at {rollCallLabel(latest)}.</p>
        )}
      </div>

      {latest && unaccounted.length > 0 && (
        <ul className="border-t border-border divide-y divide-border bg-danger-soft/30">
          {unaccounted.map(s => <Unaccounted key={s.id} student={s} latest={latest} />)}
        </ul>
      )}

      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="w-full min-h-11 px-4 flex items-center justify-between font-sans text-sm font-semibold text-ink-muted hover:text-ink hover:bg-surface-sunken transition"
        >
          {open ? 'Hide full roster' : 'Show full roster'}
          <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="overflow-x-auto border-t border-border">
            {section.roster.length === 0 ? (
              <p className="px-4 py-3 font-sans text-sm text-ink-muted">No campers on this roster.</p>
            ) : (
              <table className="w-full min-w-[420px] font-sans text-sm">
                <thead>
                  <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wider">
                    <th scope="col" className="text-left px-4 py-2 font-semibold">Camper</th>
                    {ROLL_CALLS.map(r => (
                      <th key={r.key} scope="col" className="px-3 py-2 font-semibold text-center whitespace-nowrap">{r.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.roster.map(s => (
                    <tr key={s.id} className="border-t border-border">
                      <th scope="row" className="text-left px-4 py-2 font-medium text-ink">{s.full_name}</th>
                      {ROLL_CALLS.map(r => (
                        <td key={r.key} className="px-3 py-2 text-center"><Mark value={s.marks[r.key]} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default function AdminAttendance() {
  const { today, session, nextSession, sections, loading, error, refetch, lastUpdated } = useAttendanceBoard()

  const campers = sections.reduce((n, s) => n + s.roster.length, 0)
  const present = sections.reduce((n, s) => n + (s.latest ? s.rollCalls[s.latest].present : 0), 0)
  const unaccounted = sections.reduce((n, s) => n + s.unaccounted.length, 0)
  const noRollCall = sections.filter(s => s.latest === null).length

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-sans font-bold text-2xl text-ink">Attendance</h1>
          <p className="font-sans text-sm text-ink-muted">
            {formatDayLong(today)}
            {lastUpdated && ` · Updated ${formatTime(`${lastUpdated.getHours()}:${lastUpdated.getMinutes()}`)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="min-h-11 px-3 inline-flex items-center gap-1.5 rounded-[10px] font-sans text-sm font-semibold text-ink-muted hover:text-ink hover:bg-surface-sunken transition"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="px-4 py-3 rounded-[10px] bg-danger-soft text-danger font-sans text-sm font-medium">{error}</p>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-surface-sunken animate-pulse" />)}
        </div>
      ) : !session ? (
        <div className="bg-surface border border-border rounded-xl shadow-sm p-6 text-center">
          <p className="font-sans font-semibold text-ink">No camp today.</p>
          {nextSession && (
            <p className="font-sans text-sm text-ink-muted mt-1">
              {nextSession.name} starts{' '}
              {parseLocalDate(nextSession.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' '}({formatSessionDates(nextSession)})
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Campers today" value={campers} icon={Users} iconColor="text-info" iconBg="bg-info-soft" />
            <StatCard label="Present at latest roll call" value={present} icon={UserCheck} iconColor="text-success" iconBg="bg-success-soft" />
            <StatCard
              label="Unaccounted"
              value={unaccounted}
              icon={AlertTriangle}
              iconColor={unaccounted > 0 ? 'text-danger' : 'text-ink-muted'}
              iconBg={unaccounted > 0 ? 'bg-danger-soft' : 'bg-surface-sunken'}
            />
            <StatCard
              label="Sections with no roll call yet"
              value={noRollCall}
              icon={BellOff}
              iconColor={noRollCall > 0 ? 'text-warning' : 'text-ink-muted'}
              iconBg={noRollCall > 0 ? 'bg-warning-soft' : 'bg-surface-sunken'}
            />
          </div>
          {sections.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl shadow-sm p-6 text-center font-sans text-sm text-ink-muted">
              No sections are scheduled for {session.name}.
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map(s => <SectionCard key={s.id} section={s} />)}
            </div>
          )}
        </>
      )}
      {!loading && <AttendanceExport />}
    </div>
  )
}
