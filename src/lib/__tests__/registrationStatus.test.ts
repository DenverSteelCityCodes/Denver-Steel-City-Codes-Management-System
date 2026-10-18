import { describe, expect, it } from 'vitest'
import { registrationPhase, registrationSign, seatTotals } from '../registrationStatus'
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

describe('the registration sign on Today', () => {
  const now = Date.parse('2027-02-06T15:00:00Z')   // Sat Feb 6, 8:00 AM in Denver
  const seats = { sections: 9, withSeats: 7, seatsLeft: 38, taken: 84, waitlisted: 9 }
  const base = { formEnabled: true, opensAt: null, openingUnknown: false, seats, updatedAt: '7:14', now }

  it('counts down to a scheduled opening and links to the setting', () => {
    const sign = registrationSign({ ...base, opensAt: '2027-02-07T02:00:00Z' })   // 7:00 PM that day
    expect(sign).toMatchObject({
      context: 'Registration opens today · Denver time', figure: '7:00', unit: 'PM',
      message: 'Opens in 11 hours', sub: '38 seats ready in 9 sections · Updated 7:14', to: '/admin/sessions',
    })
  })

  it('shows seats left once open, with taken, waitlisted and when it was updated', () => {
    const sign = registrationSign({ ...base, opensAt: '2027-02-06T02:00:00Z' })   // Fri 7:00 PM
    expect(sign).toMatchObject({
      context: 'Registration open since Fri, Feb 5, 7:00 PM', figure: 38,
      message: 'seats left in 7 sections', sub: '84 seats taken · 9 waitlisted · Updated 7:14', to: '/admin/classes',
    })
    expect(registrationSign(base).context).toBe('Registration is open')
  })

  it('says closed, and warns when a set opening time will not happen', () => {
    expect(registrationSign({ ...base, formEnabled: false })).toMatchObject({
      figure: 'Closed', message: "Families can't register or join a waitlist", sub: '84 seats taken · 9 waitlisted · Updated 7:14',
    })
    expect(registrationSign({ ...base, formEnabled: false, opensAt: '2027-02-07T02:00:00Z' }).sub)
      .toBe("It won't open on Sat, Feb 6 at 7:00 PM until you turn it on in Sessions · Updated 7:14")
  })

  it('never shows zeros it could not load', () => {
    expect(registrationSign({ ...base, seats: null })).toMatchObject({ figure: 'Open', message: "Seat counts didn't load" })
  })

  it("says it couldn't check, never open, when the switch couldn't be read", () => {
    const sign = registrationSign({ ...base, formEnabled: null })
    expect(sign).toMatchObject({
      context: 'Registration', message: "Couldn't check whether registration is open",
      sub: 'It tries again when you come back to this tab · Last updated 7:14', to: '/admin/sessions',
    })
    expect(sign.figure).toBeUndefined()
    expect(registrationSign({ ...base, formEnabled: null, updatedAt: null }).sub).toBe('It tries again when you come back to this tab')
  })

  it("can't call an open switch open when the opening time didn't load", () => {
    expect(registrationSign({ ...base, openingUnknown: true }).message).toBe("Couldn't check whether registration is open")
  })

  it('still says closed when the switch is off, whatever the opening time', () => {
    const sign = registrationSign({ ...base, formEnabled: false, openingUnknown: true, opensAt: '2027-02-07T02:00:00Z' })
    expect(sign).toMatchObject({ figure: 'Closed', sub: '84 seats taken · 9 waitlisted · Updated 7:14' })
  })
})
