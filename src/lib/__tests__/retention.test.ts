import { describe, expect, it } from 'vitest'
import { YOUNGEST_CAMP_AGE, gradeToAge } from '../campers'
import { RETENTION_PERIODS, turns21On } from '../retention'

describe('turns21On', () => {
  it('holds until 21 counting from the youngest camp age, not a later grade', () => {
    expect(YOUNGEST_CAMP_AGE).toBe(9)
    expect(gradeToAge('4th')).toBe(9)
    // 2010 − 9 + 21 = 2022; keep through that year. A 9th-grader reading (2010 − 14 + 21 = 2017) would be too soon.
    expect(turns21On(2010)).toBe('2023-01-01')
    expect(turns21On(2023)).toBe('2036-01-01')
    expect(turns21On(2000)).toBe('2013-01-01')
    expect(turns21On(1)).toBe('0014-01-01')
  })

  it('has no birthday when the first registration year is missing', () => {
    expect(turns21On(null)).toBeNull()
    expect(turns21On(undefined)).toBeNull()
    expect(turns21On(2023.5)).toBeNull()
    expect(turns21On(0)).toBeNull()
    expect(turns21On(-1)).toBeNull()
    expect(turns21On(NaN)).toBeNull()
    expect(turns21On(Infinity)).toBeNull()
    expect(turns21On(9987)).toBeNull()
  })
})

describe('RETENTION_PERIODS', () => {
  it('matches the schedule the nightly job implements', () => {
    expect(RETENTION_PERIODS).toEqual({
      medicalDays: 90,
      anonymizeYears: 2,
      parentYears: 2,
      rejectedApplicationYears: 1,
      volunteeredYears: 2,
      interestSignupDays: 60,
      conductIncidentYears: 1,
      waiverAge: 21,
    })
  })
})
