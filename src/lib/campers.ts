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

interface HealthFields {
  allergies: string | null
  medical_conditions: string | null
  medical_info: string | null
}

interface ContactFields {
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation?: string | null
  parent_name?: string | null
  parent_phone: string | null
}

export interface HealthLine { label: 'Allergy' | 'Medical'; text: string }

// A camper's health notes by kind, allergy first: what the crew reads on every row, never behind a
// tap. Empty when there's nothing real to report.
export function healthLines(s: HealthFields): HealthLine[] {
  const allergy = realNote(s.allergies)
  const medical = realNote(s.medical_conditions) ?? realNote(s.medical_info)
  return [
    ...(allergy ? [{ label: 'Allergy' as const, text: allergy }] : []),
    ...(medical ? [{ label: 'Medical' as const, text: medical }] : []),
  ]
}

export interface CallLine { who: string; number: string }

const digits = (n: string) => n.replace(/\D/g, '')
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

// Who the crew can call about a camper, in the order to try: the emergency contact, then the parent.
// `who` says who will answer: "Grandpa Tran (grandparent, emergency)", "Linh Tran (parent)". The
// parent is left out when they gave the same number as the emergency contact.
export function callLines(s: ContactFields): CallLine[] {
  const lines: CallLine[] = []
  const ecPhone = s.emergency_contact_phone?.trim()
  if (ecPhone) {
    const name = s.emergency_contact_name?.trim()
    // "Aunt Novak" already says aunt; "Grandpa Tran" doesn't say grandparent.
    const said = name?.toLowerCase().split(/\s+/) ?? []
    const relation = s.emergency_contact_relation?.trim() || null
    const named = relation && said.includes(relation.toLowerCase()) ? null : relation
    const who = name
      ? `${name} (${named ? `${lowerFirst(named)}, ` : ''}emergency)`
      : `Emergency contact${relation ? ` (${lowerFirst(relation)})` : ''}`
    lines.push({ who, number: ecPhone })
  }
  const parentPhone = s.parent_phone?.trim()
  if (parentPhone && (!ecPhone || digits(parentPhone) !== digits(ecPhone))) {
    const name = s.parent_name?.trim()
    lines.push({ who: name ? `${name} (parent)` : 'Parent', number: parentPhone })
  }
  return lines
}

export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`
}
