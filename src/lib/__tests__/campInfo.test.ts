import { describe, expect, it } from 'vitest'
import { ageSpan, listNames, sameSchedule, weekDates } from '../campInfo'
import { placeSentence, sharedPlace } from '../campSite'

describe('weekDates', () => {
  it('names the month once inside one month', () => {
    expect(weekDates('2027-06-07', '2027-06-11')).toBe('June 7 – 11')
  })
  it('names both months across a month end', () => {
    expect(weekDates('2027-06-28', '2027-07-02')).toBe('June 28 – July 2')
  })
  it('handles a one-day week', () => {
    expect(weekDates('2027-06-07', '2027-06-07')).toBe('June 7')
  })
})

describe('listNames', () => {
  it('joins with "and"', () => {
    expect(listNames([])).toBe('')
    expect(listNames(['Week 1'])).toBe('Week 1')
    expect(listNames(['Week 1', 'Week 2'])).toBe('Week 1 and Week 2')
    expect(listNames(['Week 1', 'Week 2', 'Week 3'])).toBe('Week 1, Week 2 and Week 3')
  })
})

describe('ageSpan', () => {
  it('spans every course, or is null with none', () => {
    expect(ageSpan([])).toBeNull()
    expect(ageSpan([{ age_min: 11, age_max: 14 }, { age_min: 9, age_max: 13 }])).toEqual({ min: 9, max: 14 })
  })
})

describe('sameSchedule', () => {
  const day = [{ title: 'Drop-off', start_time: '08:30:00', end_time: '09:00:00', location: 'Lobby' }]
  it('is true when every week runs the same day', () => {
    expect(sameSchedule([{ schedule: day }, { schedule: [...day] }])).toBe(true)
  })
  it('is false when a week differs', () => {
    expect(sameSchedule([{ schedule: day }, { schedule: [{ ...day[0], start_time: '08:45:00' }] }])).toBe(false)
  })
})

describe('where camp is (sessions.location)', () => {
  const w1 = { name: 'Week 1', location: 'Cherry Creek High School' }
  it('names a shared place once', () => {
    expect(sharedPlace([w1, { ...w1, name: 'Week 2' }])).toBe('Cherry Creek High School')
    expect(placeSentence([w1, { ...w1, name: 'Week 2' }])).toBe('Camp is held at Cherry Creek High School.')
  })
  it('names each week when the places differ', () => {
    const w2 = { name: 'Week 2', location: 'Smoky Hill High School' }
    expect(sharedPlace([w1, w2])).toBeNull()
    expect(placeSentence([w1, w2])).toBe('Week 1 is at Cherry Creek High School. Week 2 is at Smoky Hill High School.')
  })
  it('says nothing before a place is set', () => {
    expect(sharedPlace([{ name: 'Week 1', location: null }])).toBeNull()
    expect(placeSentence([{ name: 'Week 1', location: '  ' }])).toBeNull()
    expect(sharedPlace([])).toBeNull()
  })
})
