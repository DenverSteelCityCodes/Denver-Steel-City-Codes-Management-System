export type UserRole = 'admin' | 'volunteer' | 'parent'
export type ExperienceLevel = 'junior' | 'senior'
export type RegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'
export type AttendanceAction = 'check_in' | 'check_out'

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
}

// The subset of onboarding fields a parent reviews/edits when re-confirming a camper for a new
// camp year (per-summer attestation). Excludes immutable identity (parent_id, created_at).
export type OnboardingConfirmation = Pick<
  Student,
  | 'full_name' | 'grade' | 'shirt_size' | 'laptop_available'
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
  interview_notes: string | null
  created_at: string
}

export interface Class {
  id: string
  name: string
  description: string | null
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
  lead_id: string | null
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
  created_at: string
}

export interface AttendanceLog {
  id: string
  student_id: string
  section_id: string
  action: AttendanceAction
  timestamp: string
}

export interface Session {
  id: string
  name: string
  year: number
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
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
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  updated_at: string
}
