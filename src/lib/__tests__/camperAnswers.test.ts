import { describe, expect, it } from 'vitest'
import { CAMPER_ANSWERS, camperCsv, camperCsvRowCount, shownAnswers, type CsvCamper } from '../camperAnswers'

const camper: CsvCamper = {
  full_name: 'Ana Ruiz', age: 12, grade: '7th', email: null, school_district: 'Denver Public Schools',
  school_name: 'Hill Middle', shirt_size: 'M', gender: null, ethnic_background: ['Hispanic or Latino', 'White'],
  registration_year: 2027, parent_name: 'Rosa Ruiz', parent_email: 'rosa@example.com', parent_phone: '303-555-0101',
  emergency_contact_name: 'Luis Ruiz', emergency_contact_relation: 'Uncle', emergency_contact_phone: '303-555-0102',
  allergies: 'Peanuts', medical_conditions: null, medical_info: 'Asthma', free_reduced_lunch: false, lunch_provision: true,
  how_heard: 'A friend', previous_program: false, program_last_year: 'Intro to Python', candy_consent: true, other_info: null,
  waiver_signature: 'Ana Ruiz', guardian_signature: 'Rosa Ruiz', waiver_signed_at: '2027-02-03T17:00:00Z',
  registrations: [
    { status: 'waitlisted', section_label: 'JV-A', section_week: 2, class_name: 'Intro to Java', place_with: null, laptop: null },
    { status: 'confirmed', section_label: 'PY-B', section_week: 1, class_name: 'Intro to Python', place_with: 'Mia Lee', laptop: 'handed_out' },
  ],
}

describe('camper answers', () => {
  it('words booleans and arrays, and falls back to the older medical note', () => {
    const text = (key: string) => CAMPER_ANSWERS.find(a => a.key === key)!.text(camper)
    expect(text('free_reduced_lunch')).toBe('No')
    expect(text('lunch_provision')).toBe('Yes')
    expect(text('ethnic_background')).toBe('Hispanic or Latino, White')
    expect(text('medical_conditions')).toBe('Asthma')
    expect(text('waiver_signed_at')).toBe('Feb 3, 2027')
  })

  it("hides last year's course unless they came last year", () => {
    expect(CAMPER_ANSWERS.find(a => a.key === 'program_last_year')!.text(camper)).toBeNull()
  })

  it('leaves out empty optional answers and says "Not given" for required ones', () => {
    const shown = shownAnswers('camper', camper, f => f === 'email')
    expect(shown.find(a => a.key === 'email')).toEqual({ key: 'email', label: 'Camper email', text: 'Not given', missing: true })
    expect(shown.find(a => a.key === 'gender')).toBeUndefined()
  })
})

describe('camperCsv', () => {
  it('writes one row per class, Week 1 first, with only the chosen groups', () => {
    const { headers, rows } = camperCsv([camper], ['health'], 'class')
    expect(headers).toEqual(['Camper', 'Allergies', 'Medical', 'Class', 'Section', 'Week', 'Status', 'Place with', 'Laptop'])
    expect(rows).toEqual([
      ['Ana Ruiz', 'Peanuts', 'Asthma', 'Intro to Python', 'PY-B', 'Week 1', 'confirmed', 'Mia Lee', 'handed out'],
      ['Ana Ruiz', 'Peanuts', 'Asthma', 'Intro to Java', 'JV-A', 'Week 2', 'waitlisted', null, null],
    ])
  })

  it('writes one row per camper with the classes in one cell', () => {
    const { headers, rows } = camperCsv([camper], [], 'camper')
    expect(headers).toEqual(['Camper', 'Classes', 'Place with', 'Laptops'])
    expect(rows).toEqual([[
      'Ana Ruiz',
      'Intro to Python (PY-B, Week 1, confirmed); Intro to Java (JV-A, Week 2, waitlisted)',
      'Mia Lee',
      'Week 1 handed out',
    ]])
  })

  it('keeps a camper with no classes as one row either way', () => {
    const none = { ...camper, registrations: [] }
    expect(camperCsv([none], [], 'class').rows).toEqual([['Ana Ruiz', null, null, null, 'not registered', null, null]])
    expect(camperCsv([none], [], 'camper').rows).toEqual([['Ana Ruiz', 'not registered', null, null]])
    expect(camperCsvRowCount([camper, none], 'class')).toBe(3)
    expect(camperCsvRowCount([camper, none], 'camper')).toBe(2)
  })

  it('keeps every group in wizard order whatever order they were ticked in', () => {
    const { headers } = camperCsv([camper], ['waiver', 'camper'], 'camper')
    expect(headers.indexOf('Age')).toBeLessThan(headers.indexOf('Camper signature'))
  })
})
