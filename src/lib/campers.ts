// Shared camper helpers.

// Grades are always "entering in the fall" (the camper's grade next school year), matching the
// official form. Grade → age drives section eligibility (sections are age-banded; the server
// trigger checks students.age) — keep this the single mapping so every form agrees.
export const GRADES = ['4th', '5th', '6th', '7th', '8th', '9th'] as const
const GRADE_AGE: Record<string, number> = { '4th': 9, '5th': 10, '6th': 11, '7th': 12, '8th': 13, '9th': 14 }
export function gradeToAge(grade: string | null | undefined): number | null {
  return grade ? GRADE_AGE[grade] ?? null : null
}

// Registration asks parents to type "None" when there's nothing to report — that isn't a flag.
export function realNote(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  return t && !/^(none|n\/?a|no|nope|nothing|-)\.?$/i.test(t) ? t : null
}
