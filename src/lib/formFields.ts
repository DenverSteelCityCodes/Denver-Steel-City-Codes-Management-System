// Single source of truth for the two public forms' configurable fields. The admin Form editor
// edits labels / visibility / required-ness per field (stored in form_configs), and the public
// forms read them through useFormConfig(). Keys match the form state keys in each page.
//
// `locked` fields can be relabelled but never hidden or made optional — the database requires
// them (NOT NULL), or camp safety / matching / eligibility depends on them.

export interface FieldDef {
  key: string
  label: string
  required?: boolean
  locked?: boolean
}

export type FormKey = 'volunteer_application' | 'student_registration'

export const FORM_DEFINITIONS: Record<FormKey, { label: string; description: string; fields: FieldDef[] }> = {
  volunteer_application: {
    label: 'Volunteer application',
    description: 'The public form at /apply.',
    fields: [
      { key: 'firstName', label: 'First name', required: true, locked: true },
      { key: 'lastName', label: 'Last name', required: true, locked: true },
      { key: 'email', label: 'Email', required: true, locked: true },
      { key: 'phone', label: 'Phone number', required: true, locked: true },
      { key: 'age', label: 'Age', required: true, locked: true },
      { key: 'grade', label: 'Current grade', required: true, locked: true },
      { key: 'school', label: 'School', required: true, locked: true },
      { key: 'shirtSize', label: 'Shirt size', required: true, locked: true },
      { key: 'availability', label: 'Which sessions can you attend?', required: true, locked: true },
      { key: 'whyVolunteer', label: 'Why do you want to volunteer with Steel City Codes?', required: true, locked: true },
      { key: 'previousScc', label: 'Have you volunteered at a previous Steel City Codes activity?', required: true },
      { key: 'csLanguages', label: 'CS languages you know', required: true },
      { key: 'csClasses', label: "CS classes you've taken" },
      { key: 'experienceChildren', label: 'Experience working with children or volunteering' },
      { key: 'skills', label: 'Skill levels' },
      { key: 'courseFirst', label: 'First choice course', required: true, locked: true },
      { key: 'courseSecond', label: 'Second choice course', required: true, locked: true },
      { key: 'otherCurricula', label: 'Other curricula you could teach' },
      { key: 'volunteerSignature', label: 'Volunteer electronic signature', required: true, locked: true },
      { key: 'guardianSignature', label: 'Parent / guardian electronic signature', locked: true },
    ],
  },
  student_registration: {
    label: 'Camper registration',
    description: 'The parent registration wizard.',
    fields: [
      { key: 'first_name', label: 'First name', required: true, locked: true },
      { key: 'last_name', label: 'Last name', required: true, locked: true },
      { key: 'email', label: "Student's preferred email", required: true },
      { key: 'school_district', label: 'School district', required: true },
      { key: 'school_name', label: 'School name', required: true },
      { key: 'grade', label: 'Grade (entering fall)', required: true, locked: true },
      { key: 'shirt_size', label: 'Shirt size', required: true },
      { key: 'laptop_available', label: 'Does your student have access to a personal laptop?', required: true },
      { key: 'ethnic_background', label: 'Ethnic background' },
      { key: 'gender', label: 'Gender' },
      { key: 'parent_name', label: 'Parent / guardian name', required: true, locked: true },
      { key: 'parent_email', label: 'Parent email', required: true, locked: true },
      { key: 'parent_phone', label: 'Parent phone', required: true, locked: true },
      { key: 'emergency_name', label: 'Emergency contact name', required: true, locked: true },
      { key: 'emergency_phone', label: 'Emergency phone', required: true, locked: true },
      { key: 'emergency_relation', label: 'Relationship', required: true, locked: true },
      { key: 'allergies', label: 'Allergies / dietary restrictions', required: true, locked: true },
      { key: 'medical_conditions', label: 'Medical conditions, learning disabilities, etc.', required: true, locked: true },
      { key: 'other_info', label: 'Other information about participant' },
      { key: 'free_reduced_lunch', label: 'Is your student eligible for free / reduced lunch?', required: true },
      { key: 'lunch_provision', label: 'I would like Steel City Codes to provide lunch for my student.' },
      { key: 'how_heard', label: 'How did you hear about Steel City Codes?', required: true },
      { key: 'previous_program', label: 'Did your student participate in Steel City Codes last year?', required: true },
      { key: 'candy_consent', label: 'I consent to my student receiving small candy treats during camp activities.' },
      { key: 'waiver_signature', label: 'Student / registrant signature', required: true, locked: true },
      { key: 'guardian_signature', label: 'Parent / guardian signature', required: true, locked: true },
    ],
  },
}

export interface FieldConfig {
  visible?: boolean
  required?: boolean
  label?: string
}

export interface ResolvedField {
  show: boolean
  required: boolean
  label: string
}

// Merge a field's admin overrides onto its definition. Locked fields ignore visible/required.
export function resolveField(formKey: FormKey, key: string, overrides: Record<string, FieldConfig> | undefined): ResolvedField {
  const def = FORM_DEFINITIONS[formKey].fields.find(f => f.key === key)
  const o = overrides?.[key] ?? {}
  const label = o.label?.trim() || def?.label || key
  if (!def || def.locked) return { show: true, required: def?.required ?? false, label }
  const show = o.visible !== false
  return { show, required: show && (o.required ?? def.required ?? false), label }
}
