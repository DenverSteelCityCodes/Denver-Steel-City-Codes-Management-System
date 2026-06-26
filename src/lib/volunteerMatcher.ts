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
 * - Matching is done per week — a volunteer can only be assigned once per week.
 * - Sections with week=null are skipped when filtering by week; pass week=null to match all.
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
  const availKey = week === 1 ? 'availability_week_1' : week === 2 ? 'availability_week_2' : null

  const available = availKey
    ? volunteers.filter(v => v[availKey as 'availability_week_1' | 'availability_week_2'])
    : volunteers

  const seniors = available.filter(v => v.experience_level === 'senior')
  const juniors = available.filter(v => v.experience_level === 'junior')

  const usedSenior = new Set<string>()
  const usedJunior = new Set<string>()

  const targetSections = week !== null
    ? sections.filter(s => s.week === week || s.week === null)
    : sections

  return targetSections.map(sec => {
    const needsLead = !sec.lead_id
    const needsSupport = sec.supports.length === 0

    const lead = needsLead
      ? seniors.find(s => !usedSenior.has(s.id)) ?? null
      : null

    if (lead) usedSenior.add(lead.id)

    const support = needsSupport
      ? juniors.find(j => !usedJunior.has(j.id)) ?? null
      : null

    if (support) usedJunior.add(support.id)

    return { sectionId: sec.id, sectionLabel: sec.label, classId: sec.class_id, week: sec.week, lead, support }
  })
}
