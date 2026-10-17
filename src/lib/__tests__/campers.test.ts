import { describe, expect, it } from 'vitest'
import { GRADES, gradeToAge, realNote } from '../campers'
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
