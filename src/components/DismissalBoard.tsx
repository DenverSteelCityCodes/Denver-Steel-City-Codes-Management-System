import { CircleCheck, Clock, ShieldAlert } from 'lucide-react'
import { h2Class } from './AdminPageHead'
import CallLink from './CallLink'
import StatusWord from './StatusWord'
import { useDismissalBoard } from '../hooks/useDismissalBoard'
import { leaveVerb, summarizeDismissal, type DismissalRow } from '../lib/pickups'

const clock = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// Today's dismissal on the attendance board (spec 36): who hasn't been collected yet in sections
// whose dismissal has started (with who may collect them and how to reach them), every release
// recorded on an admin's OK, and the sections that haven't started. Reloads with the board.
export default function DismissalBoard({ version }: { version: unknown }) {
  const { rows, error } = useDismissalBoard(version)
  // Nothing until it loads, and nothing on a day with no camp.
  if ((!rows && !error) || (rows && rows.length === 0 && !error)) return null
  const s = rows ? summarizeDismissal(rows) : null

  return (
    <section aria-labelledby="dismissal-heading" className="mt-10">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="dismissal-heading" className={h2Class}>Dismissal</h2>
        {s && s.total > 0 && <span className="text-sm text-ink-muted tabular-nums">{s.released} of {plural(s.total, 'camper')} collected</span>}
      </div>
      {error && (
        <p role="alert" className="mt-2 font-bold text-danger text-pretty">
          {rows ? "Couldn't refresh dismissal. This is the last list loaded." : "Couldn't load dismissal. It tries again with the board."}
        </p>
      )}
      {s && s.total > 0 && (
        s.started.length === 0 ? (
          <p className="mt-3 py-3 border-y-2 border-ink text-ink-muted text-pretty">
            No section has started dismissal yet. Once a crew marks dismissal, anyone not collected shows here.
          </p>
        ) : (
          <>
            {s.waiting.length > 0 ? (
              <>
                <h3 className="mt-4 text-lg font-bold leading-[1.3]">Not collected yet ({s.waiting.length})</h3>
                <ul className="mt-2 border-y-2 border-ink">
                  {s.waiting.map(r => <Waiting key={`${r.section_id}-${r.student_id}`} row={r} />)}
                </ul>
              </>
            ) : (
              <p className="mt-3 py-3 border-y-2 border-ink flex items-center gap-1.5 font-bold text-success">
                <CircleCheck size={18} strokeWidth={2.5} aria-hidden="true" />
                Everyone in {plural(s.started.length, 'section')} with dismissal under way is collected.
              </p>
            )}

            {s.adminOk.length > 0 && (
              <>
                <h3 className="mt-6 text-lg font-bold leading-[1.3]">Released on an admin's OK ({s.adminOk.length})</h3>
                <ul className="mt-2 border-y-2 border-ink">
                  {s.adminOk.map(r => (
                    <li key={`${r.section_id}-${r.student_id}`} className="py-3 border-t border-border first:border-t-0">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        <p className="text-lg font-bold leading-[1.3] [overflow-wrap:anywhere]">{r.full_name}</p>
                        <StatusWord tone="waiting" icon={ShieldAlert}>Admin OK · {clock(r.marked_at)}</StatusWord>
                      </div>
                      <p className="text-pretty">Collected by {r.released_to}{r.marked_by_name ? `, recorded by ${r.marked_by_name}` : ''}</p>
                      <p className="text-sm text-ink-muted">{r.section_label} · {r.class_name}{r.parent_name ? ` · Parent ${r.parent_name}` : ''}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )
      )}
      {s && s.notStarted.length > 0 && s.started.length > 0 && (
        <p className="mt-4 text-sm text-ink-muted text-pretty">
          Dismissal not started: {s.notStarted.map(x => `${x.label} (${plural(x.campers, 'camper')}${x.leadName ? `, lead ${x.leadName}` : ''})`).join(', ')}.
        </p>
      )}
    </section>
  )
}

// A camper still in the room at dismissal: who may collect them, and the numbers to call.
function Waiting({ row: r }: { row: DismissalRow }) {
  const adults = r.pickup_adults ?? []
  const may = [
    `${r.parent_name ?? 'Their parent'} (parent)`,
    ...adults.map(a => `${a.name} (${a.relation.toLowerCase()}${a.days ? ', today only' : ''})`),
  ].join(', ')
  return (
    <li className="py-3 border-t border-border first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="text-lg font-bold leading-[1.3] [overflow-wrap:anywhere]">{r.full_name}</p>
        <StatusWord tone="waiting" icon={Clock}>{r.present === null ? 'Not marked at dismissal' : 'Waiting in the room'}</StatusWord>
      </div>
      <p className="text-sm text-ink-muted">
        {r.section_label} · {r.class_name}{r.room ? ` · ${r.room}` : ''} · {r.lead_name ? `Lead ${r.lead_name}` : 'No lead assigned'}
      </p>
      <p className="mt-1 text-pretty">
        <b className="font-bold">May go with:</b> {may}.{' '}
        {r.may_leave_alone ? `Their parent says they ${leaveVerb(r.leave_alone_mode)} on their own today.` : 'Not on their own today.'}
      </p>
      <div className="flex flex-wrap gap-x-6">
        {r.parent_phone && <CallLink call={{ who: `${r.parent_name ?? 'Parent'} (parent)`, number: r.parent_phone }} verb />}
        {adults.filter(a => a.phone).map(a => <CallLink key={a.name} call={{ who: `${a.name} (${a.relation.toLowerCase()})`, number: a.phone! }} verb />)}
      </div>
    </li>
  )
}
