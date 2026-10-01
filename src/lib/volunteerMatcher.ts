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
 * - Matching is done per week — a volunteer can only be assigned once per week, and anyone
 *   already crewing a section that runs that week (incl. week=null "both weeks" sections) is skipped.
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

  // Anyone already crewing a section that runs this week is busy — including sections with
  // week = null, which run both weeks. Without this, running Week 1 then Week 2 could put the
  // same person on a both-weeks section and a Week 2 section at once.
  const busy = new Set<string>()
  for (const sec of targetSections) {
    if (sec.lead_id) busy.add(sec.lead_id)
    for (const sup of sec.supports) busy.add(sup.id)
  }

  const availableFor = (v: VolunteerWithProfile, secWeek: 1 | 2 | null) => {
    // A both-weeks section needs someone free both weeks.
    if (secWeek === null) return v.availability_week_1 && v.availability_week_2
    return secWeek === 1 ? v.availability_week_1 : v.availability_week_2
  }

  const usedSenior = new Set<string>(busy)
  const usedJunior = new Set<string>(busy)

  return targetSections.map(sec => {
    const needsLead = !sec.lead_id
    const needsSupport = sec.supports.length === 0

    const lead = needsLead
      ? volunteers.find(v => v.experience_level === 'senior' && !usedSenior.has(v.id) && availableFor(v, sec.week)) ?? null
      : null

    if (lead) { usedSenior.add(lead.id); usedJunior.add(lead.id) }

    const support = needsSupport
      ? volunteers.find(v => v.experience_level === 'junior' && !usedJunior.has(v.id) && availableFor(v, sec.week)) ?? null
      : null

    if (support) { usedJunior.add(support.id); usedSenior.add(support.id) }

    return { sectionId: sec.id, sectionLabel: sec.label, classId: sec.class_id, week: sec.week, lead, support }
  })
}
