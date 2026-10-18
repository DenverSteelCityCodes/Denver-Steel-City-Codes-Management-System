import { describe, expect, it } from 'vitest'
import { buildSubhead, homeBand, needsNewClass, rollup, rowRegistrations, sessionOf, weekName } from '../parentHome'
import type { RegistrationWithSection } from '../../hooks/useRegistrations'
import type { Session, Student } from '../../types/database'

const session = (id: string, start: string, end: string): Session =>
  ({ id, name: id === 'w1' ? 'Week 1' : 'Week 2', year: 2026, start_date: start, end_date: end, is_active: true, created_at: '' })
const W1 = session('w1', '2026-06-08', '2026-06-12')
const W2 = session('w2', '2026-06-15', '2026-06-19')
const S = [W1, W2]

const kid = (id: string, first: string): Student =>
  ({ id, parent_id: 'p', full_name: `${first} Reyes`, first_name: first, age: 11, medical_info: null, created_at: '' })
const reg = (id: string, student: string, week: 1 | 2 | null, status: RegistrationWithSection['status'], extra: Partial<RegistrationWithSection> = {}) =>
  ({
    id, student_id: student, section_id: `sec-${id}`, status, year: 2026, created_at: '',
    sections: { label: 'A', age_min: 9, age_max: 14, capacity: 10, week, session_id: week ? `w${week}` : null, days: 'Mon–Fri', start_time: null, end_time: null, room: null, classes: { name: 'Intro to Python' } },
    ...extra,
  }) as RegistrationWithSection

const maya = kid('m', 'Maya'), eli = kid('e', 'Eli')

describe('rollup', () => {
  it('says All set when every live registration holds a seat', () => {
    expect(rollup([reg('1', 'm', 1, 'confirmed'), reg('2', 'm', 2, 'pending')]).label).toBe('All set')
  })
  it('puts an offer first', () => {
    expect(rollup([reg('1', 'm', 1, 'confirmed'), reg('2', 'm', 2, 'offered')]).tone).toBe('offer')
  })
  it('asks for a new class when the camp cancelled the only one', () => {
    expect(rollup([reg('1', 'm', 1, 'cancelled', { cancel_reason: 'section_cancelled' })]).label).toBe('Pick a class')
  })
  it('ignores the family\'s own cancellations', () => {
    expect(rollup([reg('1', 'm', 1, 'cancelled', { cancel_reason: 'parent_cancel' })]).label).toBe('Not signed up')
  })
  it('reads waitlist-only campers as waitlisted', () => {
    expect(rollup([reg('1', 'm', 1, 'waitlisted')]).tone).toBe('wait')
  })
})

describe('rowRegistrations', () => {
  it('keeps live rows and camp cancellations that still need a class, by week', () => {
    const all = [
      reg('2', 'm', 2, 'confirmed'),
      reg('1', 'm', 1, 'cancelled', { cancel_reason: 'section_cancelled' }),
      reg('3', 'm', 1, 'cancelled', { cancel_reason: 'parent_cancel' }),
      reg('4', 'e', 1, 'confirmed'),
    ]
    expect(rowRegistrations('m', all).map(r => r.id)).toEqual(['1', '2'])
  })
  it('drops a camp cancellation once the camper has another seat that week', () => {
    const all = [reg('1', 'm', 1, 'cancelled', { cancel_reason: 'section_cancelled' }), reg('2', 'm', 1, 'confirmed')]
    expect(needsNewClass(all[0], all)).toBe(false)
  })
})

describe('sessionOf and weekName', () => {
  it('finds the session by id, then by week number', () => {
    expect(sessionOf(reg('1', 'm', 2, 'confirmed'), S)).toBe(W2)
    const noId = reg('2', 'm', 1, 'confirmed')
    noId.sections.session_id = null
    expect(sessionOf(noId, S)).toBe(W1)
  })
  it('names both-weeks sections', () => {
    expect(weekName(reg('1', 'm', null, 'confirmed'), S)).toBe('Both weeks')
  })
})

describe('homeBand', () => {
  it('asks a new family to register', () => {
    expect(homeBand([], [], S, '2026-06-01')).toEqual({ kind: 'register' })
  })
  it('puts a waitlist offer above everything else', () => {
    const regs = [reg('1', 'm', 1, 'confirmed'), reg('2', 'e', 1, 'offered')]
    expect(homeBand([maya, eli], regs, S, '2026-06-09')?.kind).toBe('offer')
  })
  it('shows the camp day with the seats running today', () => {
    const regs = [reg('1', 'm', 1, 'confirmed'), reg('2', 'e', 2, 'confirmed')]
    const band = homeBand([maya, eli], regs, S, '2026-06-10')
    expect(band?.kind).toBe('campDay')
    if (band?.kind === 'campDay') {
      expect(band.day).toBe(3)
      expect(band.seats.map(r => r.id)).toEqual(['1'])
    }
  })
  it('points at the next week a camper holds a seat in', () => {
    const regs = [reg('1', 'm', 2, 'confirmed'), reg('2', 'e', 1, 'waitlisted')]
    expect(homeBand([maya, eli], regs, S, '2026-06-01')).toEqual({ kind: 'upcoming', session: W2 })
  })
  it('is empty when nobody holds a seat ahead', () => {
    expect(homeBand([maya], [reg('1', 'm', 1, 'waitlisted')], S, '2026-06-01')).toBeNull()
  })
})

describe('buildSubhead', () => {
  it('names the camper who is set and the one who is not', () => {
    expect(buildSubhead([maya, eli], [reg('1', 'm', 1, 'confirmed')])).toBe("Maya is all set for camp. Eli isn't signed up yet.")
  })
})
