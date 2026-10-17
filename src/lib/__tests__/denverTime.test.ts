import { describe, expect, it } from 'vitest'
import { campInputToISO, formatCampDateTime, isoToCampInput, timeUntil } from '../denverTime'

describe('Denver time', () => {
  it('reads a typed time as Denver time in winter (UTC−7) and summer (UTC−6)', () => {
    expect(campInputToISO('2027-02-06T09:00')).toBe('2027-02-06T16:00:00.000Z')
    expect(campInputToISO('2027-06-07T09:00')).toBe('2027-06-07T15:00:00.000Z')
    expect(campInputToISO('')).toBeNull()
  })

  it('handles the days the clocks change', () => {
    expect(campInputToISO('2027-03-14T12:00')).toBe('2027-03-14T18:00:00.000Z')   // after spring forward
    expect(campInputToISO('2027-11-07T12:00')).toBe('2027-11-07T19:00:00.000Z')   // after fall back
  })

  it('round-trips to what the input shows', () => {
    for (const v of ['2027-02-06T09:00', '2027-06-07T17:45', '2027-12-31T23:59']) {
      expect(isoToCampInput(campInputToISO(v))).toBe(v)
    }
    expect(isoToCampInput(null)).toBe('')
  })

  it('formats in Denver time whatever the device zone', () => {
    expect(formatCampDateTime('2027-02-06T16:00:00Z')).toBe('Saturday, February 6 at 9:00 AM')
  })

  it('says how long until, in the two largest units', () => {
    const min = 60_000, hour = 60 * min, day = 24 * hour
    expect(timeUntil(3 * day + 4 * hour + 5 * min)).toBe('3 days, 4 hours')
    expect(timeUntil(day)).toBe('1 day')
    expect(timeUntil(2 * hour + min)).toBe('2 hours, 1 minute')
    expect(timeUntil(45_000)).toBe('45 seconds')
    expect(timeUntil(-5)).toBe('0 seconds')
  })
})
