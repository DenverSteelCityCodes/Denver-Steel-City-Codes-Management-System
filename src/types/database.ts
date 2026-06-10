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
}

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
  support_id: string | null
  created_at: string
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
