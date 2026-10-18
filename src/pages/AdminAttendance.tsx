import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, CircleAlert, CircleCheck, ClockAlert, HeartPulse, Minus, Printer, RefreshCw, X } from 'lucide-react'
import AttendanceExport from '../components/AttendanceExport'
import SignBand from '../components/SignBand'
import CallLink from '../components/CallLink'
import StatusWord from '../components/StatusWord'
import Button from '../components/Button'
import AdminPageHead, { pageClass, h2Class } from '../components/AdminPageHead'
import { useAttendanceBoard } from '../hooks/useAttendanceBoard'
import type { BoardSection, BoardStudent } from '../hooks/useAttendanceBoard'
import { ROLL_CALLS, formatDayLong, parseLocalDate, rollCallForTime, rollCallLabel } from '../lib/campDay'
import { callLines } from '../lib/campers'
import { formatSessionDates } from '../hooks/useSessions'
import type { RollCallKind } from '../types/database'

const clockTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/, '')
const timeOf = (iso: string | null) => iso ? clockTime(new Date(iso)) : ''
const rcIndex = (k: RollCallKind | null) => k ? ROLL_CALLS.findIndex(r => r.key === k) : -1
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// The alarm and quiet signs (DESIGN.md › Sign Band variants): white on alarm red for unaccounted
// campers, a 2px ink frame for the all-clear. Same grid as the shared gold SignBand, which only
// draws the gold sign. Candidates for promotion into SignBand.
function BoardSign({ tone, context, figure, message, sub }: {
  tone: 'alarm' | 'quiet'
  context: string
  figure: number
  message: string
  sub?: string
}) {
  const alarm = tone === 'alarm'
  return (
    <div role="status" className={`grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-1 rounded p-4 ${
      alarm ? 'bg-alarm text-white' : 'border-2 border-ink text-ink'}`}>
      <span className={`col-span-full text-sm font-bold ${alarm ? '' : 'text-ink-muted'}`}>{context}</span>
      <span className="font-extrabold text-[3.5rem] leading-[0.92] tracking-[-0.03em] [font-variant-numeric:tabular-nums_lining-nums]">{figure}</span>
      <span className="col-start-1 text-[1.375rem] font-extrabold leading-[1.15] text-balance">{message}</span>
      {sub && <span className="col-span-full mt-1 text-pretty">{sub}</span>}
    </div>
  )
}

function Mark({ value, name, label }: { value: boolean | undefined; name: string; label: string }) {
  const sr = `${name}, ${label}: ${value === true ? 'present' : value === false ? 'absent' : 'not marked'}`
  if (value === true) return <span title={sr}><Check size={18} strokeWidth={2.5} className="text-success" aria-hidden="true" /><span className="sr-only">{sr}</span></span>
  if (value === false) return <span title={sr}><X size={18} strokeWidth={2.5} className="text-danger" aria-hidden="true" /><span className="sr-only">{sr}</span></span>
  return <span title={sr}><Minus size={18} className="text-ink-muted" aria-hidden="true" /><span className="sr-only">{sr}</span></span>
}

// One unaccounted camper: who, where, why, their health notes and who to call, all without a tap.
function Unaccounted({ student, section }: { student: BoardStudent; section: BoardSection }) {
  const latest = section.latest!
  const why = student.marks[latest] === false ? 'Missed' : 'Not marked at'
  const calls = callLines(student)
  const at = timeOf(section.rollCalls[latest].takenAt)
  return (
    <li className="py-4 border-t border-border first:border-t-0">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex-1 min-w-[min(100%,16rem)]">
          <h3 className="text-lg font-bold leading-[1.3] [overflow-wrap:anywhere]">{student.full_name}</h3>
          <p className="text-sm text-ink-muted text-pretty">
            Age {student.age} · {section.className}, {section.label}{section.room ? ` · ${section.room}` : ''} · {section.leadName ? `Lead ${section.leadName}` : 'No lead assigned'}
          </p>
        </div>
        <StatusWord tone="danger" icon={CircleAlert}>{why} {rollCallLabel(latest)}{at ? ` · ${at}` : ''}</StatusWord>
      </div>
      {student.medicalNote
        ? <p className="mt-2 flex items-start gap-1.5 font-bold leading-snug text-danger">
            <HeartPulse size={16} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />
            <span className="min-w-0 text-pretty break-words">{student.medicalNote}</span>
          </p>
        : <p className="mt-2 text-sm text-ink-muted">No allergies or medical notes</p>}
      {calls.length > 0
        ? <div className="mt-1 flex flex-wrap gap-x-6">{calls.map(c => <CallLink key={c.number + c.who} call={c} verb />)}</div>
        : <p className="mt-2 font-bold">No phone on file</p>}
    </li>
  )
}

export default function AdminAttendance() {
  const { today, session, nextSession, sections, loading, error, refetch, lastUpdated } = useAttendanceBoard()
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  // The roll call due by now, read from the time of the last refresh (it refreshes every minute).
  const dueIdx = lastUpdated ? rcIndex(rollCallForTime(lastUpdated)) : 0
  const campers = sections.reduce((n, s) => n + s.roster.length, 0)
  // Present at each section's latest roll call (0 for a section with none yet), as the old stat card counted.
  const present = sections.reduce((n, s) => n + (s.latest ? s.rollCalls[s.latest].present : 0), 0)
  const presentLine = `${present} of ${plural(campers, 'camper')} present`
  const unaccounted = sections.flatMap(s => s.unaccounted.map(student => ({ student, section: s })))
  const noRollCall = sections.filter(s => s.latest === null)
  const latestIdx = Math.max(-1, ...sections.map(s => rcIndex(s.latest)))
  const latestLabel = latestIdx >= 0 ? ROLL_CALLS[latestIdx].label : null
  const troubled = [...new Set(unaccounted.map(u => u.section.label))]
  // Problems first: most unaccounted, then no roll call yet, then the fine ones.
  const ordered = [...sections].sort((a, b) =>
    b.unaccounted.length - a.unaccounted.length
    || Number(b.latest === null) - Number(a.latest === null)
    || a.label.localeCompare(b.label))
  const updated = lastUpdated ? `Updated ${clockTime(lastUpdated)}` : null

  const th = 'px-3 py-2.5 text-left text-sm font-bold text-ink-muted border-b border-ink whitespace-nowrap'
  const mobileLabel = 'md:hidden text-sm font-bold text-ink-muted'

  function rollCell(s: BoardSection, key: RollCallKind, idx: number) {
    const rc = s.rollCalls[key]
    const latestOfSection = rcIndex(s.latest)
    if (rc.taken) {
      const missing = rc.absent + rc.unmarked
      if (idx === latestOfSection) {
        return (
          <>
            {missing > 0
              ? <span className="font-extrabold text-danger">{rc.present}/{s.roster.length} · {missing} unaccounted</span>
              : <span className="inline-flex items-center gap-1.5 font-bold text-success"><CircleCheck size={16} strokeWidth={2.5} aria-hidden="true" />All {s.roster.length} accounted for</span>}
            <span className="block text-sm text-ink-muted">{timeOf(rc.takenAt)}</span>
          </>
        )
      }
      return <>{rc.present}/{s.roster.length} present<span className="block text-sm text-ink-muted">{timeOf(rc.takenAt)}</span></>
    }
    if (idx < latestOfSection) return <span className="text-ink-muted">Not taken</span>
    if (idx <= dueIdx) {
      return (
        <span className="inline-flex items-center gap-1.5 font-extrabold">
          <ClockAlert size={16} strokeWidth={2.5} aria-hidden="true" /> No roll call yet
        </span>
      )
    }
    return <span className="text-ink-muted">Later</span>
  }

  return (
    <div className={pageClass}>
      <AdminPageHead
        title="Attendance"
        lede={<>
          {session ? `${session.name} · ` : ''}{formatDayLong(today)}
          {session && !loading && ` · ${plural(campers, 'camper')} in ${plural(sections.length, 'section')}`}
          {updated && <> · {updated} · refreshes every minute</>}
        </>}
        actions={<Button variant="text" onClick={refetch}><RefreshCw size={16} strokeWidth={2.5} aria-hidden="true" /> Refresh now</Button>}
      />

      {error && (
        <p role="alert" title={error} className="mt-4 font-bold text-danger text-pretty">
          {lastUpdated && sections.length > 0
            ? `Couldn't refresh. This is the board from ${clockTime(lastUpdated)}; it tries again every minute.`
            : "Couldn't load attendance. It tries again every minute, or use Refresh now."}
        </p>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Loading attendance" className="mt-5">
          <div className="h-[140px] rounded bg-surface-sunken animate-pulse" />
          <div className="mt-8 h-40 rounded bg-surface-sunken animate-pulse" />
        </div>
      ) : !session ? (
        <p className="mt-5 py-4 border-y-2 border-ink text-pretty">
          <b className="font-bold">No camp today.</b>
          {nextSession && (
            <span className="text-ink-muted">
              {' '}{nextSession.name} starts{' '}
              {parseLocalDate(nextSession.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' '}({formatSessionDates(nextSession)}).
            </span>
          )}
        </p>
      ) : sections.length === 0 ? (
        <p className="mt-5 py-4 border-y-2 border-ink font-bold">No sections are scheduled for {session.name}.</p>
      ) : (
        <>
          <div className="mt-5">
            {unaccounted.length > 0 ? (
              <BoardSign
                tone="alarm"
                context={`${latestLabel ?? 'Latest'} roll call · ${presentLine}`}
                figure={unaccounted.length}
                message={unaccounted.length === 1 ? 'camper unaccounted' : 'campers unaccounted'}
                sub={`Marked absent or not marked in ${troubled.join(', ')}. Who to call is below.`}
              />
            ) : noRollCall.length > 0 ? (
              <SignBand
                context={`Roll call · ${presentLine}`}
                figure={noRollCall.length}
                message={noRollCall.length === 1 ? 'section has no roll call yet' : 'sections have no roll call yet'}
                sub="Their leads and rooms are listed below."
              />
            ) : (
              <BoardSign
                tone="quiet"
                context={`${latestLabel} roll call · ${presentLine}`}
                figure={campers}
                message={campers === 1 ? 'camper accounted for' : 'campers accounted for'}
              />
            )}
          </div>

          {unaccounted.length > 0 && (
            <section aria-labelledby="unaccounted-heading" className="mt-8">
              <h2 id="unaccounted-heading" className={h2Class}>Unaccounted now</h2>
              <ul className="mt-3 border-y-2 border-ink">
                {unaccounted.map(u => <Unaccounted key={`${u.section.id}-${u.student.id}`} student={u.student} section={u.section} />)}
              </ul>
            </section>
          )}

          {noRollCall.length > 0 && (
            <section aria-labelledby="norc-heading" className="mt-8">
              <h2 id="norc-heading" className={h2Class}>
                {noRollCall.length === 1 ? '1 section has no roll call yet' : `${noRollCall.length} sections have no roll call yet`}
              </h2>
              <ul className="mt-3 border-y-2 border-ink">
                {noRollCall.map(s => (
                  <li key={s.id} className="py-3 border-t border-border first:border-t-0">
                    <p><b className="font-extrabold tracking-[0.02em]">{s.label}</b> · {s.className}</p>
                    <p className="text-sm text-ink-muted">
                      {s.room ?? 'No room set'} · {s.leadName ? <>Lead <b className="font-bold text-ink">{s.leadName}</b></> : <b className="font-bold text-ink">No lead assigned</b>}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="all-heading" className="mt-10">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 id="all-heading" className={h2Class}>All sections</h2>
              <span className="text-sm text-ink-muted">Problems first</span>
            </div>
            <table className="mt-3 w-full bg-surface border-y-2 border-ink max-md:block">
              <caption className="sr-only">Roll calls by section, problems first</caption>
              <thead className="max-md:sr-only">
                <tr>
                  <th scope="col" className={th}>Section</th>
                  {ROLL_CALLS.map(r => <th key={r.key} scope="col" className={th}>{r.label}</th>)}
                </tr>
              </thead>
              <tbody className="max-md:block">
                {ordered.map(s => {
                  // One line per section; the marks open on demand (unaccounted campers are already listed above).
                  const open = toggled[s.id] ?? false
                  return (
                    <Fragment key={s.id}>
                      <tr className={`border-t first:border-t-0 max-md:block max-md:py-3 ${open ? 'border-ink' : 'border-border'}`}>
                        <td className="px-3 py-3 align-top max-md:block max-md:p-0">
                          <button type="button" aria-expanded={open} aria-controls={`marks-${s.id}`}
                            onClick={() => setToggled(t => ({ ...t, [s.id]: !open }))}
                            className="inline-flex items-center gap-1.5 min-h-11 md:min-h-9 text-lg font-extrabold tracking-[0.02em] cursor-pointer hover:underline underline-offset-[3px]">
                            {s.label}
                            <span className="sr-only">, {s.className}, campers and marks</span>
                            <ChevronDown size={18} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>
                          <span className="block text-sm text-ink-muted text-pretty">
                            {s.className}{s.room ? ` · ${s.room}` : ''} · {s.leadName ?? 'No lead'}
                          </span>
                        </td>
                        {ROLL_CALLS.map((r, idx) => {
                          // Roll calls still to come say "Later"; on a phone they're left out of the row.
                          const later = !s.rollCalls[r.key].taken && idx > rcIndex(s.latest) && idx > dueIdx
                          return (
                            <td key={r.key} className={`px-3 py-3 align-top max-md:p-0 max-md:pt-1 ${later ? 'max-md:hidden' : 'max-md:block'}`}>
                              <span className={mobileLabel}>{r.label}: </span>{rollCell(s, r.key, idx)}
                            </td>
                          )
                        })}
                      </tr>
                      {open && (
                        <tr id={`marks-${s.id}`} className="max-md:block">
                          <td colSpan={ROLL_CALLS.length + 1} className="px-3 pb-5 pt-1 border-b-2 border-ink max-md:block max-md:px-0">
                            <div className="flex flex-wrap items-center gap-x-4">
                              <p className="text-sm font-bold text-ink-muted">{plural(s.roster.length, 'camper')} in {s.label}</p>
                              <Link to={`/print/roster/${s.id}`} className="inline-flex items-center gap-1.5 min-h-11 text-sm font-bold underline underline-offset-[3px]">
                                <Printer size={16} strokeWidth={2.5} aria-hidden="true" /> Print roster<span className="sr-only"> for {s.label}</span>
                              </Link>
                            </div>
                            {s.roster.length === 0 ? (
                              <p className="text-ink-muted">No campers on this roster.</p>
                            ) : (
                              <table className="w-full max-w-[640px]">
                                <caption className="sr-only">{s.label} campers and their marks</caption>
                                <thead>
                                  <tr>
                                    <th scope="col" className="py-1.5 pr-3 text-left text-sm font-bold text-ink-muted border-b border-border">Camper</th>
                                    {ROLL_CALLS.map(r => (
                                      <th key={r.key} scope="col" className="py-1.5 px-2 text-center text-sm font-bold text-ink-muted border-b border-border whitespace-nowrap">
                                        <span className="max-sm:hidden">{r.label}</span><span className="sm:hidden" aria-hidden="true">{r.short}</span>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.roster.map(st => (
                                    <tr key={st.id} className="border-t border-border first:border-t-0">
                                      <th scope="row" className="py-1.5 pr-3 text-left font-normal [overflow-wrap:anywhere]">{st.full_name}</th>
                                      {ROLL_CALLS.map(r => (
                                        <td key={r.key} className="py-1.5 px-2 text-center"><span className="inline-flex justify-center"><Mark value={st.marks[r.key]} name={st.full_name} label={r.label} /></span></td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {!loading && <AttendanceExport />}
    </div>
  )
}
