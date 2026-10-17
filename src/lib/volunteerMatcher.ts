import type { VolunteerWithProfile } from '../hooks/useVolunteers'
import type { SupportEntry } from '../hooks/useAdminClasses'
import type { Section } from '../types/database'

export interface AssignmentPair {
  sectionId: string
  sectionLabel: string
  classId: string
  week: 1 | 2 | null
  lead: VolunteerWithProfile | null   // senior
  support: VolunteerWithProfile | null // junior
}

/**
 * Pairs one senior + one junior volunteer per section per week based on availability.
 *
 * Rules:
 * - Each section gets a lead (senior) and support (junior).
 * - A volunteer crews at most one section in any given week. Existing crews count too, on every
 *   section, not just the ones being matched: a week=null section occupies both weeks, so its
 *   candidates must also be free of any Week 1-only and Week 2-only section.
 * - Sections with week=null run both weeks, so they need someone available both weeks.
 * - Unmatched sections get null for missing roles.
 * - Sections that already have a lead skip lead matching; sections that already
 *   have one or more supports skip support matching.
 */
export function matchVolunteers(
  volunteers: VolunteerWithProfile[],
  sections: (Pick<Section, 'id' | 'class_id' | 'label' | 'week' | 'lead_id'> & {
    supports: SupportEntry[]
  })[],
  week: 1 | 2 | null
): AssignmentPair[] {
  const targetSections = week !== null
    ? sections.filter(s => s.week === week || s.week === null)
    : sections

  const weeksOf = (secWeek: 1 | 2 | null): (1 | 2)[] => secWeek === null ? [1, 2] : [secWeek]

  // Who is taken in each week, seeded from every section's current crew. Seeding only from the
  // sections being matched would miss Week 2-only crews during a Week 1 run, and a both-weeks
  // section filled in that run would then double-book them in Week 2.
  const busy: Record<1 | 2, Set<string>> = { 1: new Set(), 2: new Set() }
  const take = (id: string, secWeek: 1 | 2 | null) => weeksOf(secWeek).forEach(w => busy[w].add(id))
  for (const sec of sections) {
    if (sec.lead_id) take(sec.lead_id, sec.week)
    for (const sup of sec.supports) take(sup.id, sec.week)
  }

  // Free = available and not yet crewing anything in every week the section runs.
  const freeFor = (v: VolunteerWithProfile, secWeek: 1 | 2 | null) =>
    weeksOf(secWeek).every(w =>
      (w === 1 ? v.availability_week_1 : v.availability_week_2) && !busy[w].has(v.id))

  return targetSections.map(sec => {
    const needsLead = !sec.lead_id
    const needsSupport = sec.supports.length === 0

    const lead = needsLead
      ? volunteers.find(v => v.experience_level === 'senior' && freeFor(v, sec.week)) ?? null
      : null

    if (lead) take(lead.id, sec.week)

    const support = needsSupport
      ? volunteers.find(v => v.experience_level === 'junior' && freeFor(v, sec.week)) ?? null
      : null

    if (support) take(support.id, sec.week)

    return { sectionId: sec.id, sectionLabel: sec.label, classId: sec.class_id, week: sec.week, lead, support }
  })
}
