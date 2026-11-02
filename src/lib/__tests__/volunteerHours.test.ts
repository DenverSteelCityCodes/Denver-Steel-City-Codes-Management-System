import { describe, expect, it } from 'vitest'
import { formatHours, formatWeekDates, hoursWord, letterSentence, todayInDenver, type HoursWeek } from '../volunteerHours'

const week: HoursWeek = {
  session_id: 's1', week_number: 2, session_name: 'Week 2', start_date: '2026-06-08', end_date: '2026-06-12',
  crew_days: 5, crew_minutes: 1800, duty_minutes: 150, letter_ready: true,
  letter_name: 'Priya Raman', has_legal_name: true, signer_name: null, signer_title: null,
}

describe('volunteer hours', () => {
  it('rounds to the nearest quarter hour', () => {
    expect(formatHours(1950)).toBe('32.5')
    expect(formatHours(45)).toBe('0.75')
    expect(formatHours(52)).toBe('0.75')
    expect(formatHours(53)).toBe('1')
    expect(formatHours(0)).toBe('0')
  })

  it('says "hour" for exactly one', () => {
    expect(hoursWord(60)).toBe('1 hour')
    expect(hoursWord(90)).toBe('1.5 hours')
  })

  it('words a week inside one month, across months and across years', () => {
    expect(formatWeekDates('2026-06-08', '2026-06-12')).toBe('June 8–12, 2026')
    expect(formatWeekDates('2026-06-29', '2026-07-03')).toBe('June 29 – July 3, 2026')
    expect(formatWeekDates('2026-12-28', '2027-01-01')).toBe('December 28, 2026 – January 1, 2027')
  })

  it('writes the certifying sentence with crew and duty time together', () => {
    expect(letterSentence(week)).toBe(
      'This is to certify that Priya Raman has completed 32.5 hours of service during Week 2 (June 8–12, 2026) at Steel City Codes Denver.',
    )
  })

  it("dates a letter by Denver's today, whatever the device's time zone", () => {
    // 05:30 UTC on Nov 2 is still the evening of Nov 1 in Denver.
    expect(todayInDenver(new Date('2026-11-02T05:30:00Z'))).toBe('November 1, 2026')
  })
})
