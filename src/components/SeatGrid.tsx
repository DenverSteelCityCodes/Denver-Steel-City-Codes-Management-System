import { Link } from 'react-router-dom'
import { UserRoundX } from 'lucide-react'
import type { ClassWithSections, SectionWithCrew } from '../hooks/useAdminClasses'
import type { Session } from '../hooks/useSessions'

// Today › Seats: a week × class grid of every section's seats (DESIGN.md › Rows and Data Tables).
// A full section is ink with its waitlist, never red. Each section links to its class in Classes.
// Under 768px the table reflows to one block per class, each week labelled in the left column.

type WeekKey = 1 | 2 | 'both'

// "Oct 19–23", or "Oct 30–Nov 3" across a month end.
function shortRange(start: string, end: string) {
  const a = new Date(`${start}T12:00:00`), b = new Date(`${end}T12:00:00`)
  const mon = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
  return mon(a) === mon(b) ? `${mon(a)} ${a.getDate()}–${b.getDate()}` : `${mon(a)} ${a.getDate()}–${mon(b)} ${b.getDate()}`
}

function SectionSeats({ cls, section, weekLabel, countsMissing }: {
  cls: ClassWithSections
  section: SectionWithCrew
  weekLabel: string
  countsMissing: boolean
}) {
  const { label, capacity, registered_count: taken, waitlist_count: waiting } = section
  const full = capacity > 0 && taken >= capacity
  const share = capacity > 0 ? Math.min(1, taken / capacity) : 0
  const noLead = !section.lead_id
  const said = [
    countsMissing ? `${capacity} seats` : `${taken} of ${capacity} seats taken`,
    !countsMissing && waiting > 0 ? `${waiting} waitlisted` : null,
    noLead ? 'no lead' : null,
  ].filter(Boolean).join(', ')

  return (
    <Link
      to={`/admin/classes?open=${encodeURIComponent(cls.id)}`}
      aria-label={`${label}, ${weekLabel}: ${said}. Open ${cls.name} in Classes.`}
      className="grid gap-0.5 min-h-11 -mx-2 p-2 rounded no-underline transition-colors hover:bg-ink/5"
    >
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-base font-extrabold leading-[1.2] tracking-[0.02em]">{label}</span>
        <span className="text-sm font-bold">
          {countsMissing
            ? `${capacity} seats`
            : <>{full ? <b className="font-extrabold">{taken}/{capacity}</b> : `${taken}/${capacity}`}{waiting > 0 && ` · ${waiting} wait`}</>}
        </span>
      </span>
      {!countsMissing && (
        <span aria-hidden="true" className="block h-1 mt-1.5 rounded-[2px] bg-border overflow-hidden">
          <span className={`block h-full ${full ? 'bg-ink' : 'bg-ink-muted'}`} style={{ width: `${share * 100}%` }} />
        </span>
      )}
      {noLead && (
        <span className="inline-flex items-center gap-1.5 mt-1 text-sm font-extrabold">
          <UserRoundX size={16} strokeWidth={2.5} aria-hidden="true" /> No lead
        </span>
      )}
    </Link>
  )
}

export default function SeatGrid({ classes, weeks, countsMissing, error = null }: {
  classes: ClassWithSections[]
  weeks: Session[]          // this camp year's sessions in date order (campSessions)
  countsMissing: boolean    // the fill counts didn't load: show capacity only, never zeros
  error?: string | null     // the classes couldn't be read: say so, never "No sections yet"
}) {
  if (error) {
    return (
      <p role="alert" className="py-4 border-y-2 border-ink font-bold text-danger text-pretty">
        Couldn't load the sections. It tries again when you come back to this tab.
      </p>
    )
  }

  const rows = classes
    .map(cls => ({ cls, sections: cls.sections.filter(s => !s.cancelled_at).sort((a, b) => a.label.localeCompare(b.label)) }))
    .filter(r => r.sections.length > 0)

  if (rows.length === 0) {
    return <p className="py-4 border-y-2 border-ink text-ink-muted">No sections yet. Add them in Classes.</p>
  }

  const cols: { key: WeekKey; label: string; dates: string | null }[] = ([1, 2] as const).map(w => ({
    key: w,
    label: weeks[w - 1]?.name ?? `Week ${w}`,
    dates: weeks[w - 1] ? shortRange(weeks[w - 1].start_date, weeks[w - 1].end_date) : null,
  }))
  // A section with no week runs in both; it gets its own column rather than being counted twice.
  if (rows.some(r => r.sections.some(s => s.week === null))) cols.push({ key: 'both', label: 'Both weeks', dates: null })

  return (
    <div className="border-y-2 border-ink">
      <table className="w-full table-fixed border-collapse max-md:block">
        <caption className="sr-only">Seats by class and week. Each section opens its class in Classes.</caption>
        <colgroup>
          <col className="w-[34%]" />
          {cols.map(col => <col key={col.key} />)}
        </colgroup>
        <thead className="max-md:sr-only">
          <tr>
            <th scope="col" className="p-2 text-left align-bottom text-sm font-extrabold border-b border-ink">Class</th>
            {cols.map(col => (
              <th key={col.key} scope="col" className="p-2 text-left align-bottom text-sm font-extrabold border-b border-ink">
                {col.label}
                {col.dates && <span className="block font-semibold text-ink-muted">{col.dates}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block">
          {rows.map(({ cls, sections }) => (
            <tr key={cls.id} className="border-t border-border first:border-t-0 max-md:block max-md:py-3">
              <th scope="row" className="p-2 text-left align-top text-sm font-bold max-md:block max-md:px-0 max-md:py-1 max-md:text-base">
                {cls.name}
              </th>
              {cols.map(col => {
                const here = sections.filter(s => (col.key === 'both' ? s.week === null : s.week === col.key))
                return (
                  <td
                    key={col.key}
                    data-label={col.label}
                    className="p-2 align-top max-md:grid max-md:grid-cols-[76px_1fr] max-md:gap-3 max-md:px-0 max-md:py-1 max-md:before:content-[attr(data-label)] max-md:before:pt-2 max-md:before:text-sm max-md:before:font-bold max-md:before:text-ink-muted"
                  >
                    {here.length === 0
                      ? <span className="block py-2 text-sm text-ink-muted">No section</span>
                      : (
                        <div className="grid gap-2">
                          {here.map(s => <SectionSeats key={s.id} cls={cls} section={s} weekLabel={col.label} countsMissing={countsMissing} />)}
                        </div>
                      )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
