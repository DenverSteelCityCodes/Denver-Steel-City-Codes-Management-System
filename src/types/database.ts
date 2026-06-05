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
  age_group: string
  capacity: number
  lead_id: string | null
  support_id: string | null
  created_at: string
}

export interface Registration {
  id: string
  student_id: string
  class_id: string
  status: RegistrationStatus
  created_at: string
}

export interface AttendanceLog {
  id: string
  student_id: string
  class_id: string
  action: AttendanceAction
  timestamp: string
}
