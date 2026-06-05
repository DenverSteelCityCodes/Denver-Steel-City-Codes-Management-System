import type { VolunteerWithProfile } from '../hooks/useVolunteers'
import type { Class } from '../types/database'

export interface AssignmentPair {
  classId: string
  className: string
  week: 1 | 2
  lead: VolunteerWithProfile | null   // senior
  support: VolunteerWithProfile | null // junior
}

/**
 * Pairs one senior + one junior volunteer per class per week based on availability.
 *
 * Rules (per PLAN.md):
 * - Each class gets a lead (senior) and support (junior).
 * - Matching is done per week — a volunteer can only be assigned once per week.
 * - Unmatched classes get null for missing roles.
 * - Volunteers already assigned to a class (lead_id/support_id set) are excluded
 *   from the pool so the algorithm only fills vacant slots.
 */
export function matchVolunteers(
  volunteers: VolunteerWithProfile[],
  classes: Pick<Class, 'id' | 'name' | 'lead_id' | 'support_id'>[],
  week: 1 | 2
): AssignmentPair[] {
  const availKey = week === 1 ? 'availability_week_1' : 'availability_week_2'

  const available = volunteers.filter(v => v[availKey])
  const seniors = available.filter(v => v.experience_level === 'senior')
  const juniors = available.filter(v => v.experience_level === 'junior')

  const usedSenior = new Set<string>()
  const usedJunior = new Set<string>()

  return classes.map(cls => {
    // Only fill vacant slots
    const needsLead = !cls.lead_id
    const needsSupport = !cls.support_id

    const lead = needsLead
      ? seniors.find(s => !usedSenior.has(s.id)) ?? null
      : null

    if (lead) usedSenior.add(lead.id)

    const support = needsSupport
      ? juniors.find(j => !usedJunior.has(j.id)) ?? null
      : null

    if (support) usedJunior.add(support.id)

    return { classId: cls.id, className: cls.name, week, lead, support }
  })
}
