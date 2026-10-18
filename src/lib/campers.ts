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

interface RosterFields {
  allergies: string | null
  medical_conditions: string | null
  medical_info: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  parent_phone: string | null
}

// One line for the crew's health tag: "Allergies: … · Medical: …", or null when there's nothing.
export function healthNote(s: RosterFields): string | null {
  const allergies = realNote(s.allergies)
  const medical = realNote(s.medical_conditions) ?? realNote(s.medical_info)
  return [allergies && `Allergies: ${allergies}`, medical && `Medical: ${medical}`].filter(Boolean).join(' · ') || null
}

// Who the crew calls about a camper: the emergency contact when there is one, else the parent.
export function callTarget(s: RosterFields): { number: string; who: string } | null {
  if (s.emergency_contact_phone) return { number: s.emergency_contact_phone, who: s.emergency_contact_name ?? 'emergency contact' }
  return s.parent_phone ? { number: s.parent_phone, who: 'parent' } : null
}

export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`
}
