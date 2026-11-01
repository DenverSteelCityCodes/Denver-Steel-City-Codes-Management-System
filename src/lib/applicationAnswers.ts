// Every answer on a volunteer application, in one catalogue (spec 39): the application review and
// the applications CSV both read it, so they never disagree. `paragraph` answers are the
// applicant's own words, shown as paragraphs beside the facts.

import type { VolunteerApplication } from '../types/database'
import { formatSignedAt } from './camperAnswers'

export interface ApplicationAnswer {
  key: string
  label: string
  paragraph?: boolean
  text: (app: VolunteerApplication, weekLabels?: [string, string]) => string | null
}

const str = (v: string | null | undefined) => v?.trim() || null
const yesNo = (v: boolean) => v ? 'Yes' : 'No'
const skill = (v: number | null) => v === null ? null : `${v}/5`

// Application review and CSV use the same answers; only the review uses dated week labels.
export const APPLICATION_ANSWERS: ApplicationAnswer[] = [
  { key: 'name', label: 'Name', text: a => str(`${a.first_name} ${a.last_name}`) },
  { key: 'email', label: 'Email', text: a => str(a.email) },
  { key: 'phone', label: 'Phone', text: a => str(a.phone) },
  { key: 'age', label: 'Age', text: a => String(a.age) },
  { key: 'grade', label: 'Grade', text: a => str(a.grade) },
  { key: 'school', label: 'School', text: a => str(a.school) },
  { key: 'shirt_size', label: 'Shirt size', text: a => str(a.shirt_size) },
  { key: 'weeks', label: 'Weeks', text: (a, labels = ['Week 1', 'Week 2']) => {
    const weeks = [a.availability_week_1 && labels[0], a.availability_week_2 && labels[1]].filter(Boolean)
    return weeks.length ? weeks.join(', ') : 'Neither week'
  } },
  { key: 'course_first_choice', label: 'First choice course', text: a => str(a.course_first_choice) },
  { key: 'course_second_choice', label: 'Second choice course', text: a => str(a.course_second_choice) },
  { key: 'other_curricula', label: 'Other curricula', text: a => str(a.other_curricula) },
  { key: 'cs_languages', label: 'CS languages', text: a => a.cs_languages.length ? a.cs_languages.join(', ') : null },
  { key: 'cs_classes', label: 'CS classes', text: a => str(a.cs_classes) },
  { key: 'skill_python', label: 'Skill: Python', text: a => skill(a.skill_python) },
  { key: 'skill_java', label: 'Skill: Java', text: a => skill(a.skill_java) },
  { key: 'skill_html', label: 'Skill: HTML', text: a => skill(a.skill_html) },
  { key: 'skill_css', label: 'Skill: CSS', text: a => skill(a.skill_css) },
  { key: 'skill_javascript', label: 'Skill: JavaScript', text: a => skill(a.skill_javascript) },
  { key: 'skill_microcontrollers', label: 'Skill: Microcontrollers', text: a => skill(a.skill_microcontrollers) },
  { key: 'previous_scc_volunteer', label: 'Volunteered before', text: a => yesNo(a.previous_scc_volunteer) },
  { key: 'why_volunteer', label: 'Why volunteer', paragraph: true, text: a => str(a.why_volunteer) },
  { key: 'experience_children', label: 'Experience with children', paragraph: true, text: a => str(a.experience_children) },
  { key: 'volunteer_signature', label: 'Volunteer signature', text: a => str(a.volunteer_signature) },
  { key: 'guardian_signature', label: 'Guardian signature', text: a => str(a.guardian_signature) },
  { key: 'interview_confirmed', label: 'Interview signed up', text: a => yesNo(a.interview_confirmed) },
  { key: 'status', label: 'Status', text: a => str(a.status) },
  { key: 'created_at', label: 'Applied', text: a => formatSignedAt(a.created_at) },
  { key: 'admin_notes', label: 'Admin notes', paragraph: true, text: a => str(a.admin_notes) },
]

export function applicationCsv(apps: VolunteerApplication[]): { headers: string[]; rows: (string | number | null)[][] } {
  return {
    headers: APPLICATION_ANSWERS.map(a => a.label),
    rows: apps.map(app => APPLICATION_ANSWERS.map(a => a.text(app))),
  }
}
