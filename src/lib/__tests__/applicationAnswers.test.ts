import { describe, expect, it } from 'vitest'
import { APPLICATION_ANSWERS, applicationCsv } from '../applicationAnswers'
import { toCsv } from '../csv'
import type { VolunteerApplication } from '../../types/database'

const riya: VolunteerApplication = {
  id: 'app-1', user_id: 'user-1', first_name: 'Riya', last_name: 'Shah',
  email: 'riya.shah@example.com', phone: '303-555-0142', age: 15, grade: '10th',
  school: 'Denver School of Science', shirt_size: 'M',
  availability_week_1: true, availability_week_2: true,
  course_first_choice: 'Web Development', course_second_choice: 'Intro to Python',
  other_curricula: 'Robotics', cs_languages: ['Python', 'JavaScript'], cs_classes: 'AP Computer Science',
  skill_python: 5, skill_java: 4, skill_html: 3, skill_css: 2, skill_javascript: 1, skill_microcontrollers: 0,
  previous_scc_volunteer: true, why_volunteer: 'I like teaching.', experience_children: 'I tutor younger students.',
  volunteer_signature: 'Riya Shah', guardian_signature: 'Asha Shah', interview_confirmed: true,
  status: 'accepted', created_at: '2026-07-02T01:00:00Z', admin_notes: 'Ready to teach.',
}

const cell = (app: VolunteerApplication, label: string) => {
  const { headers, rows } = applicationCsv([app])
  expect(headers).toContain(label)
  return rows[0][headers.indexOf(label)]
}

describe('applicationCsv', () => {
  it('exports every answer with short labels and one row per application', () => {
    expect(applicationCsv([riya])).toEqual({
      headers: [
        'Name', 'Email', 'Phone', 'Age', 'Grade', 'School', 'Shirt size', 'Weeks',
        'First choice course', 'Second choice course', 'Other curricula', 'CS languages', 'CS classes',
        'Skill: Python', 'Skill: Java', 'Skill: HTML', 'Skill: CSS', 'Skill: JavaScript', 'Skill: Microcontrollers',
        'Volunteered before', 'Why volunteer', 'Experience with children', 'Volunteer signature', 'Guardian signature',
        'Interview signed up', 'Status', 'Applied', 'Admin notes',
      ],
      rows: [[
        'Riya Shah', 'riya.shah@example.com', '303-555-0142', '15', '10th', 'Denver School of Science', 'M', 'Week 1, Week 2',
        'Web Development', 'Intro to Python', 'Robotics', 'Python, JavaScript', 'AP Computer Science',
        '5/5', '4/5', '3/5', '2/5', '1/5', '0/5',
        'Yes', 'I like teaching.', 'I tutor younger students.', 'Riya Shah', 'Asha Shah',
        'Yes', 'accepted', 'Jul 1, 2026', 'Ready to teach.',
      ]],
    })
    const { headers, rows } = applicationCsv([riya, { ...riya, first_name: 'Jo', status: 'pending' }])
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.length === headers.length)).toBe(true)
    expect(rows[1][0]).toBe('Jo Shah')
    expect(rows[1][headers.indexOf('Status')]).toBe('pending')
  })

  it('keeps headers when there are no applications', () => {
    const { headers, rows } = applicationCsv([])
    expect(headers).toContain('Why volunteer')
    expect(rows).toEqual([])
  })

  it('leaves absent and whitespace-only optional answers blank', () => {
    const app = {
      ...riya, other_curricula: null, cs_languages: [], cs_classes: '  ',
      experience_children: null, guardian_signature: '', admin_notes: '\n ',
    }
    for (const label of ['Other curricula', 'CS languages', 'CS classes', 'Experience with children', 'Guardian signature', 'Admin notes']) {
      expect(cell(app, label)).toBeNull()
      expect(toCsv([label], [[cell(app, label)]])).toBe(`${label}\r\n`)
    }
  })

  it('joins language arrays and spells out booleans', () => {
    expect(cell(riya, 'CS languages')).toBe('Python, JavaScript')
    for (const value of [true, false]) {
      const app = { ...riya, previous_scc_volunteer: value, interview_confirmed: value }
      expect(cell(app, 'Volunteered before')).toBe(value ? 'Yes' : 'No')
      expect(cell(app, 'Interview signed up')).toBe(value ? 'Yes' : 'No')
    }
  })

  it('exports plain week names for every availability combination', () => {
    expect(cell(riya, 'Weeks')).toBe('Week 1, Week 2')
    expect(cell({ ...riya, availability_week_2: false }, 'Weeks')).toBe('Week 1')
    expect(cell({ ...riya, availability_week_1: false }, 'Weeks')).toBe('Week 2')
    expect(cell({ ...riya, availability_week_1: false, availability_week_2: false }, 'Weeks')).toBe('Neither week')
    const weeks = APPLICATION_ANSWERS.find(a => a.key === 'weeks')!
    expect(weeks.text(riya, ['June 1–5', 'June 8–12'])).toBe('June 1–5, June 8–12')
    expect(weeks.text({ ...riya, availability_week_1: false }, ['June 1–5', 'June 8–12'])).toBe('June 8–12')
  })

  it('keeps each skill separate, including zero, and leaves unrated skills blank', () => {
    const app = {
      ...riya, skill_python: null, skill_java: null, skill_html: null,
      skill_css: null, skill_javascript: null, skill_microcontrollers: null,
    }
    for (const label of ['Python', 'Java', 'HTML', 'CSS', 'JavaScript', 'Microcontrollers']) {
      expect(cell(app, `Skill: ${label}`)).toBeNull()
    }
    expect(cell(riya, 'Skill: Microcontrollers')).toBe('0/5')
  })

  it('formats applied dates in Denver in summer and winter and ignores invalid dates', () => {
    expect(cell(riya, 'Applied')).toBe('Jul 1, 2026')
    expect(cell({ ...riya, created_at: '2026-01-02T06:30:00Z' }, 'Applied')).toBe('Jan 1, 2026')
    expect(cell({ ...riya, created_at: 'invalid' }, 'Applied')).toBeNull()
  })
})
