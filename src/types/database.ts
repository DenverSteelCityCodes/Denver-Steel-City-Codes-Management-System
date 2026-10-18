export type UserRole = 'admin' | 'volunteer' | 'parent'
export type ExperienceLevel = 'junior' | 'senior'
// 'offered' (spec 10): a freed seat held for a waitlisted camper until they claim it or it expires.
export type RegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled' | 'offered'

export interface Profile {
  id: string
  role: UserRole
  display_name: string
  created_at: string
}

export interface Student {
  id: string
  parent_id: string
  full_name: string
  age: number
  medical_info: string | null
  created_at: string
  // Extended onboarding fields (migration_student_registration.sql). Present at runtime via
  // select('*'); all nullable since quick-added campers have only name/age/medical so far.
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  school_district?: string | null
  school_name?: string | null
  grade?: string | null
  shirt_size?: string | null
  // No longer asked (spec 29: loaner laptops are requested per week, laptop_loans). Read-only,
  // kept for past seasons until retention (L4) clears it.
  laptop_available?: boolean | null
  ethnic_background?: string[] | null
  gender?: string | null
  parent_name?: string | null
  parent_phone?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relation?: string | null
  allergies?: string | null
  medical_conditions?: string | null
  other_info?: string | null
  free_reduced_lunch?: boolean | null
  lunch_provision?: boolean | null
  how_heard?: string | null
  previous_program?: boolean | null
  program_last_year?: string | null
  candy_consent?: boolean | null
  waiver_signature?: string | null
  guardian_signature?: string | null
  waiver_signed_at?: string | null
  registration_year?: number | null
  // Stamped by the database on every change (migration_edit_conflicts.sql); saves check it.
  updated_at?: string
}

// The subset of onboarding fields a parent reviews/edits when re-confirming a camper for a new
// camp year (per-summer attestation). Excludes immutable identity (parent_id, created_at).
export type OnboardingConfirmation = Pick<
  Student,
  | 'full_name' | 'grade' | 'shirt_size'
  | 'parent_name' | 'parent_phone' | 'emergency_contact_name'
  | 'emergency_contact_phone' | 'emergency_contact_relation'
  | 'allergies' | 'medical_conditions' | 'free_reduced_lunch'
  | 'guardian_signature'
>


export interface Volunteer {
  id: string
  experience_level: ExperienceLevel
  availability_week_1: boolean
  availability_week_2: boolean
  created_at: string
}

export interface Class {
  id: string
  name: string
  description: string | null
  updated_at?: string
  created_at: string
}

export interface Section {
  id: string
  class_id: string
  label: string
  age_min: number
  age_max: number
  capacity: number
  week: 1 | 2 | null
  // Derived from week by the sections_sync_session trigger (null = runs both weeks).
  session_id?: string | null
  lead_id: string | null
  // Schedule (migration_camp_week_ops.sql): free-text days, HH:MM:SS times, room name.
  days: string
  start_time: string | null
  end_time: string | null
  room: string | null
  // Set when an admin cancels the section (migration_soft_cancel.sql). Cancelled sections keep their
  // registrations (as cancelled) and are hidden from parents.
  cancelled_at?: string | null
  cancel_reason?: string | null
  // Stamped by the database on every change (migration_edit_conflicts.sql); saves check it.
  updated_at?: string
  created_at: string
}

// The daily camp schedule, one list per session (same every day of that week).
export interface ScheduleItem {
  id: string
  session_id: string
  start_time: string
  end_time: string | null
  title: string
  location: string | null
  created_at: string
}

export type RollCallKind = 'arrival' | 'after_lunch' | 'dismissal'

export interface RollCallMark {
  id: string
  section_id: string
  student_id: string
  day: string          // YYYY-MM-DD
  roll_call: RollCallKind
  present: boolean
  note: string | null
  marked_by: string | null
  marked_at: string
}

export type UpdateAudience = 'everyone' | 'parents' | 'volunteers' | 'section'

export interface Update {
  id: string
  author_id: string
  author_name: string
  audience: UpdateAudience
  section_id: string | null
  body: string
  created_at: string
}

export interface SectionSupport {
  section_id: string
  volunteer_id: string
}

export interface Registration {
  id: string
  student_id: string
  section_id: string
  status: RegistrationStatus
  // Camp year, stamped by the database from the section's session.
  year: number
  // Cancel details, stamped by the database (migration_soft_cancel.sql). cancel_reason is one of
  // admin_removed, parent_cancel, section_cancelled, declined_offer, offer_expired,
  // took_other_seat, merged.
  cancelled_at?: string | null
  cancel_reason?: string | null
  cancelled_by?: string | null
  displaced_from_section?: string | null
  // Waitlist offer window (migration_waitlist_offers.sql).
  offered_at?: string | null
  offer_expires_at?: string | null
  created_at: string
}

export interface Session {
  id: string
  name: string
  year: number
  start_date: string
  end_date: string
  is_active: boolean
  // Building and address of this week (migration_public_camp_page.sql, spec 30).
  location?: string | null
  // Loaner laptops the camp can lend that week (migration_laptop_loans.sql, spec 29).
  laptop_loaners?: number
  created_at: string
}

// A loaner laptop for one registration (one camper, one week; migration_laptop_loans.sql).
// reserved and handed_out count against the week's cap; queued waits, first come first served.
export type LaptopLoanStatus = 'reserved' | 'queued' | 'handed_out' | 'returned' | 'released'
export interface LaptopLoan {
  registration_id: string
  status: LaptopLoanStatus
  requested_at: string
  handed_out_at: string | null
  returned_at: string | null
  updated_at: string
}

export interface DutyType {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface DutySlot {
  id: string
  duty_type_id: string
  session_id: string | null
  slot_date: string
  capacity: number
  created_at: string
}

export interface DutyAssignment {
  id: string
  duty_slot_id: string
  volunteer_id: string
  created_at: string
}

export interface InterviewSlot {
  id: string
  slot_datetime: string
  duration_minutes: number
  notes: string | null
  created_at: string
}

export interface InterviewBooking {
  id: string
  slot_id: string
  application_id: string
  admin_notes: string | null
  created_at: string
}

export interface FormConfig {
  id: string
  form_key: string
  config: {
    enabled: boolean
    fields: Record<string, { visible?: boolean; required?: boolean; label?: string }>
  }
  updated_at: string
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

export interface VolunteerApplication {
  id: string
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  age: number
  grade: string
  school: string
  shirt_size: string
  availability_week_1: boolean
  availability_week_2: boolean
  why_volunteer: string
  previous_scc_volunteer: boolean
  cs_languages: string[]
  cs_classes: string | null
  experience_children: string | null
  skill_python: number | null
  skill_java: number | null
  skill_html: number | null
  skill_css: number | null
  skill_javascript: number | null
  skill_microcontrollers: number | null
  course_first_choice: string
  course_second_choice: string
  other_curricula: string | null
  volunteer_signature: string
  guardian_signature: string | null
  interview_confirmed: boolean
  status: ApplicationStatus
  admin_notes: string | null
  created_at: string
}


export interface ParentProfile {
  id: string
  email: string | null
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  updated_at: string
}
