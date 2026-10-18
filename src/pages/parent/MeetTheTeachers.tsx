import { useState } from 'react'
import { Printer } from 'lucide-react'
import Segmented from '../../components/Segmented'
import { useMeetTheCrew, type CrewRow } from '../../hooks/useMeetTheCrew'
import { localDateISO } from '../../lib/campDay'
import { buttonClass } from '../../lib/ui'
import { PageHead, framedCls, h2Cls, rowCls } from './parts'

// Meet the teachers (spec 35): the volunteers teaching in the weeks the family has a seated camper,
// so parents and campers know names (and how to say them) before the first day. Preferred names,
// bios and only consented photos; the database decides what reaches this page. One week at a time,
// the camper's own class first, and a print view that replaces the hand-made PDF.
interface Week { key: string; name: string; start: string | null; end: string | null; rows: CrewRow[] }

function weekKey(r: CrewRow) { return r.session_id ?? `week-${r.week ?? 0}` }

function dateRange(a: string | null, b: string | null) {
  if (!a || !b) return ''
  const f = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return `${f(a)} – ${f(b)}`
}

// A photo only when there is one (consented); without it the row is just the words, no placeholder.
function Person({ r, photo }: { r: CrewRow; photo: string | undefined }) {
  return (
    <li className={`${rowCls} py-4 break-inside-avoid ${photo ? 'grid grid-cols-[4.5rem_1fr] gap-4 items-start' : ''}`}>
      {photo && <img src={photo} alt={r.name} className="w-[4.5rem] h-[4.5rem] rounded object-cover border border-border bg-surface" />}
      <div className="min-w-0">
        <p className="text-lg font-bold leading-[1.3]">
          {r.name} <span className="text-base font-normal text-ink-muted">· {r.crew_role === 'lead' ? 'Lead teacher' : 'Support'}</span>
        </p>
        {r.pronunciation && <p className="text-ink-muted">Say it: <b className="font-bold text-ink">{r.pronunciation}</b></p>}
        {r.bio && <p className="mt-1 max-w-[65ch] text-pretty whitespace-pre-line">{r.bio}</p>}
      </div>
    </li>
  )
}

export default function MeetTheTeachers() {
  const { rows, photos, error } = useMeetTheCrew()
  const [picked, setPicked] = useState<string | null>(null)

  // One tab per week. A section not tied to a week's session joins every week it overlaps (a
  // section with no week runs both), so its crew shows wherever the family has a camper.
  const weeks: Week[] = []
  const loose = (rows ?? []).filter(r => !r.session_id)
  for (const r of (rows ?? []).filter(r => r.session_id)) {
    const k = weekKey(r)
    let w = weeks.find(x => x.key === k)
    if (!w) { w = { key: k, name: r.session_name ?? `Week ${r.week}`, start: r.start_date, end: r.end_date, rows: [] }; weeks.push(w) }
    w.rows.push(r)
  }
  for (const r of loose) {
    const fits = weeks.filter(w => r.week === null || w.rows.some(x => x.week === null || x.week === r.week))
    if (fits.length > 0) { for (const w of fits) w.rows.push(r); continue }
    const k = weekKey(r)
    let w = weeks.find(x => x.key === k)
    if (!w) { w = { key: k, name: r.week ? `Week ${r.week}` : 'Both weeks', start: null, end: null, rows: [] }; weeks.push(w) }
    w.rows.push(r)
  }
  // Open on the first week that isn't over yet.
  const today = localDateISO()
  const current = weeks.find(w => !w.end || w.end >= today) ?? weeks[0]
  const week = weeks.find(w => w.key === picked) ?? current

  // Sections in the week, the camper's own first, then by class.
  const sections = new Map<string, CrewRow[]>()
  for (const r of week?.rows ?? []) sections.set(r.section_id, [...(sections.get(r.section_id) ?? []), r])
  const ordered = [...sections.values()].sort((a, b) =>
    Number(!!b[0].my_campers) - Number(!!a[0].my_campers) || a[0].class_name.localeCompare(b[0].class_name) || a[0].section_label.localeCompare(b[0].section_label))

  return (
    <>
      <PageHead title="Meet the teachers">
        The volunteers teaching {weeks.length > 1 ? 'in your campers\' weeks' : 'in your camper\'s week'}: their names, how to say them, and a little about them.
      </PageHead>

      {error ? (
        <p role="alert" title={error} className="mt-6 font-bold text-danger">Couldn't load the teachers. Check your connection and reload the page.</p>
      ) : rows === null ? (
        <div aria-busy="true" className="mt-6 h-40 rounded bg-surface-sunken animate-pulse" />
      ) : weeks.length === 0 ? (
        <p className="mt-6 py-4 border-y-2 border-ink text-pretty">
          <b className="font-bold">Nothing to show yet.</b> Teachers show up here once your camper has a spot in a class and the camp has assigned its crew.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
            {weeks.length > 1 && (
              <Segmented label="Camp week" value={week!.key} onChange={setPicked}
                options={weeks.map(w => ({ value: w.key, label: w.name }))} />
            )}
            <button type="button" onClick={() => window.print()} className={buttonClass('secondary')}>
              <Printer size={18} strokeWidth={2.5} aria-hidden="true" /> Print {weeks.length > 1 ? 'this week' : 'this page'}
            </button>
          </div>
          <p className="mt-6 font-bold">{week!.name}{week!.start ? `, ${dateRange(week!.start, week!.end)}` : ''}</p>
          {ordered.map(crew => {
            const s = crew[0]
            const sorted = [...crew].sort((a, b) => Number(b.crew_role === 'lead') - Number(a.crew_role === 'lead') || a.name.localeCompare(b.name))
            const meta = [s.room, s.my_campers && `${s.my_campers}'s class`].filter(Boolean).join(' · ')
            return (
              <section key={s.section_id} aria-labelledby={`sec-${s.section_id}`} className="mt-8 break-inside-avoid-page">
                <h2 id={`sec-${s.section_id}`} className={h2Cls}>{s.class_name} · {s.section_label}</h2>
                {meta && <p className="text-ink-muted">{meta}</p>}
                <ul className={`mt-2 ${framedCls}`}>
                  {sorted.map(r => <Person key={`${r.section_id}-${r.volunteer_id}`} r={r} photo={r.photo_path ? photos.get(r.photo_path) : undefined} />)}
                </ul>
              </section>
            )
          })}
        </>
      )}
    </>
  )
}
