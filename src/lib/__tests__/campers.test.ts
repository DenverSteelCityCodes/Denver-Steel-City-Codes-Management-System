import { describe, expect, it } from 'vitest'
import { GRADES, callLines, gradeToAge, healthLines, realNote, telHref } from '../campers'
import { courseConstraint, gradeBlockReason } from '../courseConstraints'

describe('gradeToAge', () => {
  it('maps every grade to an age, 4th = 9 up to 9th = 14', () => {
    expect(GRADES.map(gradeToAge)).toEqual([9, 10, 11, 12, 13, 14])
  })
  it('returns null for unknown or empty grades', () => {
    expect(gradeToAge('College')).toBeNull()
    expect(gradeToAge(null)).toBeNull()
  })
})

describe('realNote', () => {
  it('treats "None"-style answers as no note', () => {
    for (const t of ['None', 'none.', 'N/A', 'na', 'no', '-', '  ', null]) expect(realNote(t)).toBeNull()
  })
  it('keeps real notes, trimmed', () => {
    expect(realNote('  Peanut allergy ')).toBe('Peanut allergy')
    expect(realNote('None of the above, but asthma')).toBe('None of the above, but asthma')
  })
})

describe('course constraints', () => {
  it('finds the Microcontrollers rule by name, case-insensitively', () => {
    expect(courseConstraint('MICROCONTROLLERS')?.allowedGrades).toEqual(['7th', '8th', '9th'])
    expect(courseConstraint('Intro to Python')).toBeNull()
  })
  it('blocks grades outside the rule, never an unknown grade', () => {
    const mc = courseConstraint('Microcontrollers')
    expect(gradeBlockReason(mc, '6th')).toBe('Open to students entering grades 7–9')
    expect(gradeBlockReason(mc, '8th')).toBeNull()
    expect(gradeBlockReason(mc, null)).toBeNull()
    expect(gradeBlockReason(null, '4th')).toBeNull()
  })
})

describe('roster helpers', () => {
  const base = { allergies: null, medical_conditions: null, medical_info: null, emergency_contact_name: null, emergency_contact_phone: null, parent_phone: null }
  it('splits health notes into allergy and medical lines, skipping "None"', () => {
    expect(healthLines({ ...base, allergies: 'Peanuts', medical_conditions: 'None', medical_info: 'Asthma' }))
      .toEqual([{ label: 'Allergy', text: 'Peanuts' }, { label: 'Medical', text: 'Asthma' }])
    expect(healthLines({ ...base, medical_conditions: 'Type 1 diabetes' })).toEqual([{ label: 'Medical', text: 'Type 1 diabetes' }])
    expect(healthLines({ ...base, allergies: 'n/a' })).toEqual([])
  })
  it('names who answers: the emergency contact first, then the parent', () => {
    expect(callLines({
      ...base, emergency_contact_phone: '720-555-0137', emergency_contact_name: 'Grandpa Tran', emergency_contact_relation: 'Grandparent',
      parent_name: 'Linh Tran', parent_phone: '303-555-0137',
    })).toEqual([
      { who: 'Grandpa Tran (grandparent, emergency)', number: '720-555-0137' },
      { who: 'Linh Tran (parent)', number: '303-555-0137' },
    ])
    expect(callLines({ ...base, emergency_contact_phone: '720-555-0101', emergency_contact_name: 'Aunt Jo' }))
      .toEqual([{ who: 'Aunt Jo (emergency)', number: '720-555-0101' }])
    expect(callLines({ ...base, parent_phone: '303-555-0199' })).toEqual([{ who: 'Parent', number: '303-555-0199' }])
    expect(callLines(base)).toEqual([])
  })
  it("doesn't repeat a relationship the name already says", () => {
    expect(callLines({ ...base, emergency_contact_phone: '720-555-0130', emergency_contact_name: 'Aunt Novak', emergency_contact_relation: 'Aunt' }))
      .toEqual([{ who: 'Aunt Novak (emergency)', number: '720-555-0130' }])
  })
  it('lists a shared number once', () => {
    expect(callLines({ ...base, emergency_contact_phone: '(303) 555-0101', emergency_contact_name: 'Ana Ruiz', parent_name: 'Ana Ruiz', parent_phone: '303-555-0101' }))
      .toEqual([{ who: 'Ana Ruiz (emergency)', number: '(303) 555-0101' }])
  })
  it('builds a dialable tel: link', () => {
    expect(telHref('(303) 555-0101')).toBe('tel:3035550101')
  })
})
