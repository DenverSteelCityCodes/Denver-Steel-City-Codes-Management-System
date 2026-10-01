// Per-course eligibility constraints from the official 2026 sign-up form (#44).
//
// Matched by class name (case-insensitive substring) so a rule activates automatically when an
// admin creates the class. Two of the form's constraints are already handled by data, not code:
//   - Per-week caps (Microcontrollers 20, Web Dev 25) live on `sections.capacity` + the waitlist.
//   - "Web Development not offered in Week 2" = simply not creating a Week-2 section.
// What needs code is the grade gate and the surfaced prerequisite for Microcontrollers.

export interface CourseConstraint {
  // Allowed grades, in the form's "entering in the fall" terms (the camper's grade next school
  // year). Microcontrollers is for rising 7th–9th graders. Undefined = no grade limit.
  allowedGrades?: string[]
  // Advisory prerequisite shown to parents. Verified by staff at registration — we can't reliably
  // auto-check a camper's Python level, so this is surfaced, not hard-blocked.
  requirementNote?: string
}

// Notes never repeat a cap or which weeks a course runs: both come from the sections an admin
// creates, so hard-coded numbers here would drift from what the capacity meters show.
const RULES: { match: string; constraint: CourseConstraint }[] = [
  {
    match: 'microcontroller',
    constraint: {
      allowedGrades: ['7th', '8th', '9th'],
      requirementNote: 'For campers entering grades 7–9 with at least intermediate Python knowledge.',
    },
  },
]

export function courseConstraint(className: string): CourseConstraint | null {
  const lower = className.toLowerCase()
  return RULES.find(r => lower.includes(r.match))?.constraint ?? null
}

// A reason string when the camper's current grade disqualifies them, else null. Returns null when
// grade is unknown (quick-added camper not yet onboarded) — the onboarding gate collects grade
// before registration, and the section's age range still applies as a fallback.
export function gradeBlockReason(constraint: CourseConstraint | null, grade?: string | null): string | null {
  if (!constraint?.allowedGrades || !grade) return null
  if (constraint.allowedGrades.includes(grade)) return null
  const nums = constraint.allowedGrades.map(g => g.replace(/\D/g, ''))
  return `Open to students entering grades ${nums[0]}–${nums[nums.length - 1]}`
}
