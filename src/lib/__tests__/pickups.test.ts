import { describe, expect, it } from 'vitest'
import {
  daysAhead, daysPhrase, leaveChip, leaveInfinitive, onDay, openWeeks, pickupDraftError, releaseCell, releaseLine,
  summarizeDismissal, type DismissalRow,
} from '../pickups'
import type { Session } from '../../types/database'

const week = (id: string, start: string, end: string, year = 2027): Session =>
  ({ id, name: id, year, start_date: start, end_date: end, is_active: true, created_at: '' })
const W1 = week('w1', '2027-06-07', '2027-06-11')
const W2 = week('w2', '2027-06-14', '2027-06-18')

describe('daysPhrase', () => {
  it('says any day for an every-day adult', () => {
    expect(daysPhrase(null)).toBe('Any day')
    expect(daysPhrase([], 'Every day of Week 1')).toBe('Every day of Week 1')
  })
  it('names one day as the only one, and joins several in date order', () => {
    expect(daysPhrase(['2027-06-09'])).toBe('Wed, Jun 9 only')
    expect(daysPhrase(['2027-06-11', '2027-06-07'])).toBe('Mon, Jun 7 and Fri, Jun 11')
    expect(daysPhrase(['2027-06-07', '2027-06-08', '2027-06-09'])).toBe('Mon, Jun 7, Tue, Jun 8 and Wed, Jun 9')
  })
})

describe('onDay', () => {
  it('lets an any-day adult through every day, a dated one only on its days', () => {
    expect(onDay(null, '2027-06-09')).toBe(true)
    expect(onDay(['2027-06-09'], '2027-06-09')).toBe(true)
    expect(onDay(['2027-06-09'], '2027-06-10')).toBe(false)
  })
})

describe('release wording', () => {
  it('says who collected the camper', () => {
    expect(releaseLine('parent', 'Pat Lee')).toBe('Collected by Pat Lee (parent)')
    expect(releaseLine('listed_adult', 'Rosa Diaz')).toBe('Collected by Rosa Diaz')
    expect(releaseLine('alone', 'On their own (walk)')).toBe('Left on their own (walk)')
    expect(releaseLine('admin_ok', 'Aunt May')).toBe('Collected by Aunt May, admin OK')
  })
  it('fills the CSV cell, empty when nobody is recorded', () => {
    expect(releaseCell('parent', 'Pat Lee')).toBe('Pat Lee (parent)')
    expect(releaseCell('admin_ok', 'Aunt May')).toBe('Aunt May (admin OK)')
    expect(releaseCell('alone', 'On their own (bike)')).toBe('On their own (bike)')
    expect(releaseCell(null, null)).toBe('')
  })
  it('says how the camper may go home', () => {
    expect(leaveInfinitive('bike')).toBe('bike home')
    expect(leaveInfinitive('other')).toBe('leave')
  })
  it('labels the walk-home tap by how the camper gets home', () => {
    expect(leaveChip('walk')).toBe('Walking home')
    expect(leaveChip('transit')).toBe('Taking transit')
    expect(leaveChip(null)).toBe('On their own')
  })
})

describe('pickupDraftError', () => {
  const ok = { name: 'Rosa Diaz', relation: 'Grandmother', phone: '303-555-0142' }
  it('accepts a complete adult', () => {
    expect(pickupDraftError(ok)).toBeNull()
  })
  it('points at the first missing or wrong field', () => {
    expect(pickupDraftError({ ...ok, name: '  ' })?.field).toBe('name')
    expect(pickupDraftError({ ...ok, relation: '' })?.field).toBe('relation')
    expect(pickupDraftError({ ...ok, phone: '' })?.field).toBe('phone')
    expect(pickupDraftError({ ...ok, phone: '555-01' })?.field).toBe('phone')
    expect(pickupDraftError({ ...ok, phone: '+1 (303) 555-0142' })).toBeNull()
  })
})

describe('openWeeks', () => {
  const seat = (status: string, session_id: string | null, week: number | null) => ({ status, sections: { session_id, week } })
  it('lists weeks with a seat that have not ended, in date order', () => {
    expect(openWeeks([seat('confirmed', 'w2', 2), seat('confirmed', 'w1', 1)], [W2, W1], '2027-06-01').map(s => s.id)).toEqual(['w1', 'w2'])
    expect(openWeeks([seat('confirmed', 'w1', 1)], [W1, W2], '2027-06-11').map(s => s.id)).toEqual(['w1'])
    expect(openWeeks([seat('confirmed', 'w1', 1)], [W1, W2], '2027-06-12')).toEqual([])
  })
  it('skips waitlist places and cancelled spots', () => {
    expect(openWeeks([seat('waitlisted', 'w1', 1), seat('cancelled', 'w2', 2)], [W1, W2], '2027-06-01')).toEqual([])
  })
  it('counts a both-weeks section in both weeks', () => {
    expect(openWeeks([seat('confirmed', null, null)], [W1, W2], '2027-06-01').map(s => s.id)).toEqual(['w1', 'w2'])
  })
})

describe('daysAhead', () => {
  it('lists the camp days from today on', () => {
    expect(daysAhead([W1], '2027-06-09')).toEqual(['2027-06-09', '2027-06-10', '2027-06-11'])
    expect(daysAhead([W1, W2], '2027-06-12')).toHaveLength(5)
  })
})

describe('summarizeDismissal', () => {
  const row = (over: Partial<DismissalRow>): DismissalRow => ({
    section_id: 'a', section_label: 'PY-A', class_name: 'Python', room: '101', lead_name: 'Sam',
    student_id: 's', full_name: 'Ava', parent_name: 'Pat', parent_phone: null, present: null,
    released_to: null, released_mode: null, marked_at: null, marked_by_name: null, pickup_adults: [],
    may_leave_alone: false, leave_alone_mode: null, ...over,
  })
  it('lists who is still waiting in sections that started dismissal', () => {
    const s = summarizeDismissal([
      row({ student_id: '1', full_name: 'Ava', present: true }),
      row({ student_id: '2', full_name: 'Ben', present: true, released_mode: 'parent', released_to: 'Pat' }),
      row({ student_id: '3', full_name: 'Cy', present: null }),
      row({ student_id: '4', full_name: 'Di', present: false }),
      row({ section_id: 'b', section_label: 'JV-A', student_id: '5', full_name: 'Ed' }),
    ])
    expect(s.total).toBe(5)
    expect(s.released).toBe(1)
    expect(s.waiting.map(r => r.full_name)).toEqual(['Ava', 'Cy'])
    expect(s.started.map(x => x.label)).toEqual(['PY-A'])
    expect(s.notStarted).toEqual([{ id: 'b', label: 'JV-A', className: 'Python', room: '101', leadName: 'Sam', campers: 1 }])
  })
  it('collects the admin-OK releases, newest first', () => {
    const s = summarizeDismissal([
      row({ student_id: '1', present: true, released_mode: 'admin_ok', released_to: 'May', marked_at: '2027-06-07T21:00:00Z' }),
      row({ student_id: '2', present: true, released_mode: 'admin_ok', released_to: 'Lou', marked_at: '2027-06-07T21:05:00Z' }),
    ])
    expect(s.adminOk.map(r => r.released_to)).toEqual(['Lou', 'May'])
    expect(s.waiting).toEqual([])
  })
})
