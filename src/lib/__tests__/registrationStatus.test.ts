import { describe, expect, it } from 'vitest'
import { registrationPhase, seatTotals } from '../registrationStatus'
import { formatCampDay, formatCampTime, isSameCampDay } from '../denverTime'

describe('registration phase', () => {
  const now = Date.parse('2027-02-06T15:00:00Z')   // 8:00 AM in Denver

  it('is closed whenever the form is off, even with an opening time ahead', () => {
    expect(registrationPhase(false, null, now)).toBe('closed')
    expect(registrationPhase(false, '2027-02-07T02:00:00Z', now)).toBe('closed')
  })

  it('waits for a scheduled opening, then opens', () => {
    expect(registrationPhase(true, '2027-02-07T02:00:00Z', now)).toBe('scheduled')
    expect(registrationPhase(true, '2027-02-06T15:00:00Z', now)).toBe('open')
    expect(registrationPhase(true, '2027-02-01T02:00:00Z', now)).toBe('open')
  })

  it('is open with no opening time set', () => {
    expect(registrationPhase(true, null, now)).toBe('open')
  })
})

describe('seat totals', () => {
  it('adds up free seats, held seats and waitlists, leaving out cancelled sections', () => {
    expect(seatTotals([
      { capacity: 10, registered_count: 10, waitlist_count: 2 },
      { capacity: 16, registered_count: 9, waitlist_count: 0 },
      { capacity: 14, registered_count: 15, waitlist_count: 1 },   // over capacity counts as 0 left
      { capacity: 12, registered_count: 3, waitlist_count: 0, cancelled_at: '2027-01-01T00:00:00Z' },
    ])).toEqual({ sections: 3, withSeats: 1, seatsLeft: 7, taken: 34, waitlisted: 3 })
  })
})

describe('short Denver dates', () => {
  it('formats the day and time in Denver whatever the device zone', () => {
    expect(formatCampDay('2027-02-07T02:00:00Z')).toBe('Sat, Feb 6')
    expect(formatCampTime('2027-02-07T02:00:00Z')).toBe('7:00 PM')
  })

  it('compares calendar days in Denver, not UTC', () => {
    expect(isSameCampDay('2027-02-07T02:00:00Z', '2027-02-06T15:00:00Z')).toBe(true)
    expect(isSameCampDay('2027-02-07T08:00:00Z', '2027-02-06T15:00:00Z')).toBe(false)
  })
})
