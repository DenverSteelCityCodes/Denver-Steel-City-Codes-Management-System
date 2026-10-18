import type { ExperienceLevel } from '../types/database'

// Options for a section's Lead and Supports selects (A-admin §6 "Reassigning cover"): every
// volunteer stays pickable, but each option says their level, whether they're free that week and
// what they already crew, and the free people come first. Pure, so it's tested on its own.

export interface CrewPerson {
  id: string
  name: string
  level: ExperienceLevel
  week1: boolean   // said they can do Week 1
  week2: boolean
}

export interface CrewSection {
  id: string
  label: string
  week: 1 | 2 | null   // null runs both weeks
  lead_id: string | null
  support_ids: string[]
  cancelled?: boolean
}

export interface CrewOption { id: string; text: string }
export interface CrewGroup { label: string; options: CrewOption[] }

export const weekName = (w: 1 | 2 | null) => (w ? `Week ${w}` : 'both weeks')
const weeksOf = (w: 1 | 2 | null): (1 | 2)[] => (w ? [w] : [1, 2])

function availability(p: CrewPerson): string {
  if (p.week1 && p.week2) return 'both weeks'
  if (p.week1) return 'Week 1 only'
  if (p.week2) return 'Week 2 only'
  return 'not available'
}

// Groups for one select. `target` is the section being edited (its own crew don't count as busy)
// and the week it runs in; `exclude` drops people already chosen elsewhere in the form.
export function crewGroups(
  people: CrewPerson[],
  sections: CrewSection[],
  target: { sectionId?: string; week: 1 | 2 | null },
  role: 'lead' | 'support',
  exclude: ReadonlySet<string> = new Set(),
): { groups: CrewGroup[]; freeSeniors: number; freeJuniors: number } {
  const weeks = weeksOf(target.week)
  const live = sections.filter(s => !s.cancelled && s.id !== target.sectionId)
  const when = weekName(target.week)

  const free: (CrewOption & { p: CrewPerson })[] = []
  const busy: typeof free = []
  const away: typeof free = []

  for (const p of people) {
    if (exclude.has(p.id)) continue
    const jobs = live
      .map(s => ({ s, as: s.lead_id === p.id ? 'leads' : s.support_ids.includes(p.id) ? 'supports' : null }))
      .filter((j): j is { s: CrewSection; as: 'leads' | 'supports' } => j.as !== null)
    const clash = jobs.some(j => weeksOf(j.s.week).some(w => weeks.includes(w)))
    const canDo = weeks.every(w => (w === 1 ? p.week1 : p.week2))
    const says = jobs.map(j => `${j.as} ${j.s.label} ${weekName(j.s.week)}`)
    const text = (status: string | null) => [p.name, p.level, status, ...says].filter(Boolean).join(' · ')
    if (!canDo) away.push({ id: p.id, p, text: text(availability(p)) })
    else if (clash) busy.push({ id: p.id, p, text: text(null) })
    else free.push({ id: p.id, p, text: text(`free ${when}`) })
  }

  // Leads are usually seniors and supports juniors, so that level leads each group.
  const first: ExperienceLevel = role === 'lead' ? 'senior' : 'junior'
  const order = (a: { p: CrewPerson }, b: { p: CrewPerson }) =>
    Number(b.p.level === first) - Number(a.p.level === first) || a.p.name.localeCompare(b.p.name)
  const strip = (list: typeof free): CrewOption[] => [...list].sort(order).map(({ id, text }) => ({ id, text }))

  const groups: CrewGroup[] = [
    { label: `Free in ${when}`, options: strip(free) },
    { label: `Already crewing in ${when}`, options: strip(busy) },
    { label: `Not available in ${when}`, options: strip(away) },
  ].filter(g => g.options.length > 0)

  return {
    groups,
    freeSeniors: free.filter(f => f.p.level === 'senior').length,
    freeJuniors: free.filter(f => f.p.level === 'junior').length,
  }
}
