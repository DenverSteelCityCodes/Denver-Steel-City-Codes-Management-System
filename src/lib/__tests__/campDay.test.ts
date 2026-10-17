import { describe, expect, it } from 'vitest'
import { firstName, formatTime, formatTimeRange, localDateISO, rollCallForTime, sessionDays, sessionOnDay } from '../campDay'
import type { Session } from '../../types/database'

describe('camp-day helpers', () => {
  it('formats times as 12-hour', () => {
    expect(formatTime('09:00:00')).toBe('9:00 AM')
    expect(formatTime('12:05')).toBe('12:05 PM')
    expect(formatTime('00:30')).toBe('12:30 AM')
    expect(formatTimeRange('09:00', '15:00')).toBe('9:00 AM – 3:00 PM')
    expect(formatTimeRange('09:00', null)).toBe('9:00 AM')
    expect(formatTimeRange(null, '15:00')).toBe('')
  })

  it('picks the roll call by time of day', () => {
    expect(rollCallForTime(new Date(2027, 5, 7, 9, 0))).toBe('arrival')
    expect(rollCallForTime(new Date(2027, 5, 7, 11, 30))).toBe('after_lunch')
    expect(rollCallForTime(new Date(2027, 5, 7, 14, 30))).toBe('dismissal')
  })

  it('uses the local calendar day, not UTC', () => {
    expect(localDateISO(new Date(2027, 5, 7, 23, 30))).toBe('2027-06-07')
  })

  it('lists Mon–Fri camp days and finds the session on a day', () => {
    const s = { id: 'w1', start_date: '2027-06-05', end_date: '2027-06-13' } as Session   // Sat → Sun
    expect(sessionDays(s)).toEqual(['2027-06-07', '2027-06-08', '2027-06-09', '2027-06-10', '2027-06-11'])
    expect(sessionOnDay([s], '2027-06-09')?.id).toBe('w1')
    expect(sessionOnDay([s], '2027-06-14')).toBeNull()
  })

  it('takes a first name', () => {
    expect(firstName('  Maya  Brooks ')).toBe('Maya')
    expect(firstName(null)).toBe('')
  })
})
