import { describe, expect, it } from 'vitest'
import { decisions, nextCampDay, needsNewClass, offerDeadline, roomFigure, statusSentence, timeLeft, weekLines } from '../homeDecision'
import type { RegistrationWithSection } from '../../hooks/useRegistrations'
import type { Session, Student } from '../../types/database'

const session = (id: string, start: string, end: string): Session =>
  ({ id, name: id === 'w1' ? 'Week 1' : 'Week 2', year: 2026, start_date: start, end_date: end, is_active: true, created_at: '' })
const W1 = session('w1', '2026-10-19', '2026-10-23')
const W2 = session('w2', '2026-10-26', '2026-10-30')
const WEEKS = [W1, W2]

const kid = (id: string, first: string, year = 2026): Student =>
  ({ id, parent_id: 'p', full_name: `${first} Brooks`, first_name: first, age: 11, medical_info: null, created_at: '', registration_year: year })
const reg = (id: string, student: string, week: 1 | 2 | null, status: RegistrationWithSection['status'], extra: Partial<RegistrationWithSection> = {}) =>
  ({
    id, student_id: student, section_id: `sec-${id}`, status, year: 2026, created_at: '',
    sections: { label: 'A', age_min: 9, age_max: 14, capacity: 10, week, session_id: week ? `w${week}` : null, days: 'Mon–Fri', start_time: '09:00', end_time: '15:00', room: 'Room 202', classes: { name: 'Web Development' } },
    ...extra,
  }) as RegistrationWithSection

const maya = kid('m', 'Maya'), eli = kid('e', 'Eli'), noor = kid('n', 'Noor', 2025)
const TODAY = '2026-10-17'
const opts = { campYear: 2026, registrationOpen: true, today: TODAY }

describe('decisions', () => {
  it('puts the offer that runs out first at the top', () => {
    const all = [
      reg('1', 'm', 1, 'offered', { offer_expires_at: '2026-10-19T01:00:00Z' }),
      reg('2', 'e', 1, 'offered', { offer_expires_at: '2026-10-18T01:00:00Z' }),
    ]
    expect(decisions([maya, eli], all, WEEKS, opts).map(d => d.kind === 'offer' && d.reg.id)).toEqual(['2', '1'])
  })
  it('puts every re-confirm before any camper who only needs a class', () => {
    const d = decisions([maya, eli, noor], [reg('1', 'm', 1, 'confirmed')], WEEKS, opts)
    expect(d.map(x => `${x.kind}:${x.student.id}`)).toEqual(['reconfirm:n', 'register:e'])
  })
  it('holds registering decisions until registration opens', () => {
    expect(decisions([noor], [], WEEKS, { ...opts, registrationOpen: false })).toEqual([])
  })
  it('asks for a new class when the camp cancelled the only one that week', () => {
    const all = [reg('1', 'm', 1, 'cancelled', { cancel_reason: 'section_cancelled' })]
    expect(decisions([maya], all, WEEKS, opts)[0].kind).toBe('cancelled')
    expect(needsNewClass(all[0], [...all, reg('2', 'm', 1, 'confirmed')], WEEKS, TODAY)).toBe(false)
  })
  it('lets a same-week waitlist place or offer settle a cancelled class', () => {
    const cancelled = reg('1', 'm', 1, 'cancelled', { cancel_reason: 'section_cancelled' })
    expect(needsNewClass(cancelled, [cancelled, reg('2', 'm', 1, 'waitlisted')], WEEKS, TODAY)).toBe(false)
    expect(needsNewClass(cancelled, [cancelled, reg('3', 'm', 1, 'offered')], WEEKS, TODAY)).toBe(false)
    expect(needsNewClass(cancelled, [cancelled, reg('4', 'm', 2, 'waitlisted')], WEEKS, TODAY)).toBe(true)
  })
  it('drops a cancelled class once its week is over', () => {
    const all = [reg('1', 'm', 1, 'cancelled', { cancel_reason: 'section_cancelled' })]
    expect(needsNewClass(all[0], all, WEEKS, '2026-10-24')).toBe(false)
    expect(decisions([maya], all, WEEKS, { ...opts, today: '2026-10-24' }).map(d => d.kind)).not.toContain('cancelled')
  })
})

describe('weekLines', () => {
  it('shows each week, with an empty line for a week the camper could still join', () => {
    expect(weekLines('m', [reg('1', 'm', 1, 'confirmed')], WEEKS, TODAY).map(l => [l.label, l.reg?.id ?? null]))
      .toEqual([['Week 1', '1'], ['Week 2', null]])
  })
  it('folds a camper with nothing into one line', () => {
    expect(weekLines('n', [], WEEKS, TODAY).map(l => l.label)).toEqual(['Weeks 1, 2'])
  })
  it('drops the family\'s own cancellations', () => {
    const lines = weekLines('m', [reg('1', 'm', 1, 'cancelled', { cancel_reason: 'parent_cancel' })], WEEKS, TODAY)
    expect(lines.map(l => l.label)).toEqual(['Weeks 1, 2'])
  })
})

describe('statusSentence', () => {
  it('says one thing per camper', () => {
    const all = [reg('1', 'm', 1, 'confirmed'), reg('2', 'e', 1, 'waitlisted')]
    expect(statusSentence([maya, eli, noor], all, WEEKS, TODAY))
      .toBe("Maya is set for Week 1. Eli is on the waitlist. Noor isn't registered yet.")
  })
  it('counts with the right agreement past three campers', () => {
    const all = [reg('1', 'm', 1, 'confirmed'), reg('2', 'e', 1, 'waitlisted'), reg('3', 'a', 1, 'waitlisted')]
    expect(statusSentence([maya, eli, noor, kid('a', 'Ava')], all, WEEKS, TODAY))
      .toBe('1 camper is set. 2 are on a waitlist. 1 needs a class.')
  })
})

describe('nextCampDay', () => {
  it('finds the first camp day with a seat and its campers', () => {
    const day = nextCampDay([maya, eli], [reg('1', 'm', 1, 'confirmed'), reg('2', 'e', 1, 'waitlisted')], WEEKS, WEEKS, TODAY)
    expect(day && { day: day.day, away: day.daysAway, seats: day.seats.map(s => s.student.id) })
      .toEqual({ day: '2026-10-19', away: 2, seats: ['m'] })
  })
  it('numbers the day when camp is on today', () => {
    expect(nextCampDay([maya], [reg('1', 'm', 1, 'confirmed')], WEEKS, WEEKS, '2026-10-21')?.dayNumber).toBe(3)
  })
})

describe('small formatters', () => {
  it('reads the room number for the figure', () => {
    expect(roomFigure('Room 202')).toBe('202')
    expect(roomFigure('Library')).toBe('Library')
  })
  it('says an offer deadline in Denver time', () => {
    expect(offerDeadline('2026-10-17T01:00:00Z')).toBe('Fri 7:00 PM (Denver time)')
  })
  it('counts hours, then minutes, left on an offer', () => {
    const now = Date.parse('2026-10-17T12:00:00Z')
    expect(timeLeft('2026-10-17T21:30:00Z', now)).toEqual({ value: 9, unit: 'h' })
    expect(timeLeft('2026-10-17T12:40:00Z', now)).toEqual({ value: 40, unit: 'min' })
    expect(timeLeft('2026-10-17T11:00:00Z', now)).toBeNull()
  })
})
