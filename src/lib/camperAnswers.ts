// Every answer the registration wizard saves about a camper, in one catalogue (spec 39). Camper
// detail and the Campers CSV both read it, so what an admin sees and what they export never
// disagree. Labels are short admin labels, not the parent-facing sentence.

import type { LaptopLoanStatus, RegistrationStatus } from '../types/database'

export type CamperGroup = 'camper' | 'parent' | 'health' | 'details' | 'waiver'

// Wizard order. Camper detail lifts Health to the top; the CSV keeps this order.
export const CAMPER_GROUPS: { key: CamperGroup; label: string }[] = [
  { key: 'camper', label: 'Camper' },
  { key: 'parent', label: 'Parent and emergency' },
  { key: 'health', label: 'Health' },
  { key: 'details', label: 'Details' },
  { key: 'waiver', label: 'Waiver' },
]

// The fields the catalogue reads. AdminStudent carries all of them.
export interface CamperAnswerSource {
  full_name: string
  age: number
  grade: string | null
  email: string | null
  school_district: string | null
  school_name: string | null
  shirt_size: string | null
  gender: string | null
  ethnic_background: string[] | null
  registration_year: number | null
  parent_name: string
  parent_email: string | null
  parent_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_relation: string | null
  emergency_contact_phone: string | null
  allergies: string | null
  medical_conditions: string | null
  medical_info: string | null
  free_reduced_lunch: boolean | null
  lunch_provision: boolean | null
  how_heard: string | null
  previous_program: boolean | null
  program_last_year: string | null
  candy_consent: boolean | null
  other_info: string | null
  waiver_signature: string | null
  guardian_signature: string | null
  waiver_signed_at: string | null
}

export interface CamperAnswer {
  key: string
  group: CamperGroup
  label: string
  // The wizard field this answer comes from (formFields.ts), when there is one: it says whether the
  // answer is required, so a missing required answer reads "Not given" instead of disappearing.
  field?: string
  // The answer in words; null when there's none.
  text: (s: CamperAnswerSource) => string | null
}

const str = (v: string | null | undefined) => v?.trim() || null
const yesNo = (v: boolean | null | undefined) => v === true ? 'Yes' : v === false ? 'No' : null

export function formatSignedAt(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { timeZone: 'America/Denver', year: 'numeric', month: 'short', day: 'numeric' })
}

export const CAMPER_ANSWERS: CamperAnswer[] = [
  { key: 'age', group: 'camper', label: 'Age', text: s => String(s.age) },
  { key: 'grade', group: 'camper', label: 'Grade this fall', field: 'grade', text: s => str(s.grade) },
  { key: 'school_district', group: 'camper', label: 'School district', field: 'school_district', text: s => str(s.school_district) },
  { key: 'school_name', group: 'camper', label: 'School', field: 'school_name', text: s => str(s.school_name) },
  { key: 'email', group: 'camper', label: 'Camper email', field: 'email', text: s => str(s.email) },
  { key: 'shirt_size', group: 'camper', label: 'Shirt size', field: 'shirt_size', text: s => str(s.shirt_size) },
  { key: 'gender', group: 'camper', label: 'Gender', field: 'gender', text: s => str(s.gender) },
  { key: 'ethnic_background', group: 'camper', label: 'Ethnic background', field: 'ethnic_background', text: s => s.ethnic_background?.length ? s.ethnic_background.join(', ') : null },
  { key: 'registration_year', group: 'camper', label: 'Registered for', text: s => s.registration_year ? String(s.registration_year) : null },

  { key: 'parent_name', group: 'parent', label: 'Parent', field: 'parent_name', text: s => str(s.parent_name) },
  { key: 'parent_email', group: 'parent', label: 'Parent email', field: 'parent_email', text: s => str(s.parent_email) },
  { key: 'parent_phone', group: 'parent', label: 'Parent phone', field: 'parent_phone', text: s => str(s.parent_phone) },
  { key: 'emergency_name', group: 'parent', label: 'Emergency contact', field: 'emergency_name', text: s => str(s.emergency_contact_name) },
  { key: 'emergency_relation', group: 'parent', label: 'Relationship', field: 'emergency_relation', text: s => str(s.emergency_contact_relation) },
  { key: 'emergency_phone', group: 'parent', label: 'Emergency phone', field: 'emergency_phone', text: s => str(s.emergency_contact_phone) },

  { key: 'allergies', group: 'health', label: 'Allergies', field: 'allergies', text: s => str(s.allergies) },
  // Medical conditions replaced the older medical_info.
  { key: 'medical_conditions', group: 'health', label: 'Medical', field: 'medical_conditions', text: s => str(s.medical_conditions) ?? str(s.medical_info) },

  { key: 'free_reduced_lunch', group: 'details', label: 'Free or reduced lunch', field: 'free_reduced_lunch', text: s => yesNo(s.free_reduced_lunch) },
  { key: 'lunch_provision', group: 'details', label: 'Wants camp lunch', field: 'lunch_provision', text: s => yesNo(s.lunch_provision) },
  { key: 'how_heard', group: 'details', label: 'Heard about us', field: 'how_heard', text: s => str(s.how_heard) },
  { key: 'previous_program', group: 'details', label: 'Came last year', field: 'previous_program', text: s => yesNo(s.previous_program) },
  { key: 'program_last_year', group: 'details', label: "Last year's course", text: s => s.previous_program ? str(s.program_last_year) : null },
  { key: 'candy_consent', group: 'details', label: 'Candy treats', field: 'candy_consent', text: s => yesNo(s.candy_consent) },
  { key: 'other_info', group: 'details', label: 'Other information', field: 'other_info', text: s => str(s.other_info) },

  { key: 'waiver_signature', group: 'waiver', label: 'Camper signature', field: 'waiver_signature', text: s => str(s.waiver_signature) },
  { key: 'guardian_signature', group: 'waiver', label: 'Guardian signature', field: 'guardian_signature', text: s => str(s.guardian_signature) },
  { key: 'waiver_signed_at', group: 'waiver', label: 'Signed', text: s => formatSignedAt(s.waiver_signed_at) },
]

export interface ShownAnswer { key: string; label: string; text: string; missing: boolean }

// One group's answers for camper detail: empty optional answers are left out; a required answer
// that's missing says "Not given". `required` comes from the form editor's settings.
export function shownAnswers(group: CamperGroup, s: CamperAnswerSource, required: (field: string) => boolean): ShownAnswer[] {
  return CAMPER_ANSWERS.filter(a => a.group === group).flatMap((a): ShownAnswer[] => {
    const text = a.text(s)
    if (text !== null) return [{ key: a.key, label: a.label, text, missing: false }]
    return a.field && required(a.field) ? [{ key: a.key, label: a.label, text: 'Not given', missing: true }] : []
  })
}

// ── CSV ─────────────────────────────────────────────────────────────────────

export type RowShape = 'class' | 'camper'

export interface CsvRegistration {
  status: RegistrationStatus
  section_label: string
  section_week: 1 | 2 | null
  class_name: string
  place_with: string | null
  laptop: LaptopLoanStatus | null
}

export interface CsvCamper extends CamperAnswerSource {
  registrations: CsvRegistration[]
}

type Cell = string | number | null

const weekCell = (w: 1 | 2 | null) => w ? `Week ${w}` : 'Both weeks'
// Spec 29: reserved / queued / handed_out / returned; blank when none (or released).
const laptopCell = (l: LaptopLoanStatus | null) => l && l !== 'released' ? l.replace('_', ' ') : null
const byWeek = (a: CsvRegistration, b: CsvRegistration) =>
  (a.section_week ?? 3) - (b.section_week ?? 3) || a.class_name.localeCompare(b.class_name)

// Name always leads and the classes always close a row, whatever groups are chosen.
export function camperCsv(campers: CsvCamper[], groups: CamperGroup[], shape: RowShape): { headers: string[]; rows: Cell[][] } {
  const answers = CAMPER_GROUPS.filter(g => groups.includes(g.key))
    .flatMap(g => CAMPER_ANSWERS.filter(a => a.group === g.key))
  const answerCells = (s: CsvCamper): Cell[] => answers.map(a => a.text(s))
  const headers = ['Camper', ...answers.map(a => a.label),
    ...(shape === 'class' ? ['Class', 'Section', 'Week', 'Status', 'Place with', 'Laptop'] : ['Classes', 'Place with', 'Laptops'])]

  const rows: Cell[][] = []
  for (const s of campers) {
    const regs = [...s.registrations].sort(byWeek)
    const lead: Cell[] = [s.full_name, ...answerCells(s)]
    if (shape === 'class') {
      if (regs.length === 0) rows.push([...lead, null, null, null, 'not registered', null, null])
      for (const r of regs) {
        rows.push([...lead, r.class_name, r.section_label, weekCell(r.section_week), r.status, r.place_with, laptopCell(r.laptop)])
      }
    } else {
      const placeWith = [...new Set(regs.map(r => r.place_with).filter((p): p is string => !!p))]
      const laptops = regs.flatMap(r => { const l = laptopCell(r.laptop); return l ? [`${weekCell(r.section_week)} ${l}`] : [] })
      rows.push([
        ...lead,
        regs.length ? regs.map(r => `${r.class_name} (${r.section_label}, ${weekCell(r.section_week)}, ${r.status})`).join('; ') : 'not registered',
        placeWith.join('; ') || null,
        laptops.join('; ') || null,
      ])
    }
  }
  return { headers, rows }
}

// How many rows an export writes, for the panel's "Writes 42 rows" line.
export const camperCsvRowCount = (campers: CsvCamper[], shape: RowShape) =>
  shape === 'camper' ? campers.length : campers.reduce((n, s) => n + Math.max(1, s.registrations.length), 0)
