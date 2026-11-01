import { describe, expect, it } from 'vitest'
import { campPhase, countLabel, currentItem, daysBetween, dutyDropLocked, dutyWeekLine, dutyYear, groupDutyWeeks, neededForMinimum, relativeDay } from '../volunteerHome'
import type { Session } from '../../types/database'

const session = (id: string, start: string, end: string): Session =>
  ({ id, name: id === 'w1' ? 'Week 1' : 'Week 2', year: 2026, start_date: start, end_date: end, is_active: true, created_at: '' })
const W1 = session('w1', '2026-06-08', '2026-06-12')
const W2 = session('w2', '2026-06-15', '2026-06-19')

describe('campPhase', () => {
  const both = [{ session_id: 'w1' }, { session_id: 'w2' }]
  it('is upcoming before the first week', () => {
    expect(campPhase(both, [W1, W2], '2026-06-06')).toEqual({ kind: 'upcoming', session: W1 })
  })
  it('numbers the camp day inside a running week', () => {
    expect(campPhase(both, [W1, W2], '2026-06-10')).toEqual({ kind: 'today', session: W1, day: 3, days: 5 })
  })
  it('treats the weekend between weeks as upcoming', () => {
    expect(campPhase(both, [W1, W2], '2026-06-13')).toEqual({ kind: 'upcoming', session: W2 })
  })
  it('ignores sessions the volunteer is not crewed for', () => {
    expect(campPhase([{ session_id: 'w2' }], [W1, W2], '2026-06-10')).toEqual({ kind: 'upcoming', session: W2 })
  })
  it('is over after the last week', () => {
    expect(campPhase(both, [W1, W2], '2026-06-20')).toEqual({ kind: 'over' })
  })
  it('is unscheduled when sections have no session', () => {
    expect(campPhase([{ session_id: null }], [W1], '2026-06-10')).toEqual({ kind: 'unscheduled' })
  })
})

describe('relativeDay', () => {
  it('names nearby days', () => {
    expect(relativeDay('2026-06-06', '2026-06-06')).toBe('today')
    expect(relativeDay('2026-06-06', '2026-06-07')).toBe('tomorrow')
    expect(relativeDay('2026-06-06', '2026-06-08')).toBe('Monday')
    expect(relativeDay('2026-05-30', '2026-06-08')).toBe('Monday, June 8')
  })
  it('counts days across a month boundary', () => {
    expect(daysBetween('2026-05-30', '2026-06-08')).toBe(9)
  })
})

describe('currentItem', () => {
  const items = [
    { start_time: '08:30:00', end_time: '09:00:00', title: 'Drop-off' },
    { start_time: '09:00:00', end_time: null, title: 'Morning session' },
    { start_time: '10:30:00', end_time: '10:45:00', title: 'Snack' },
  ]
  it('finds the running block', () => {
    expect(currentItem(items, 8 * 60 + 45)?.title).toBe('Drop-off')
  })
  it('runs an open-ended block until the next one starts', () => {
    expect(currentItem(items, 10 * 60)?.title).toBe('Morning session')
  })
  it('is null outside the day', () => {
    expect(currentItem(items, 7 * 60)).toBeNull()
    expect(currentItem(items, 11 * 60)).toBeNull()
  })
})

describe('groupDutyWeeks', () => {
  it('groups by session then day, in date order, keeping session-less slots', () => {
    const slots = [
      { id: 'b', slot_date: '2026-06-16', session_id: 'w2' },
      { id: 'a', slot_date: '2026-06-08', session_id: 'w1' },
      { id: 'c', slot_date: '2026-06-08', session_id: 'w1' },
      { id: 'd', slot_date: '2026-06-24', session_id: null },
    ]
    const weeks = groupDutyWeeks(slots, [W1, W2])
    expect(weeks.map(w => w.label)).toEqual(['Week 1', 'Week 2', 'Week of Jun 22'])
    expect(weeks[0].days).toEqual([{ date: '2026-06-08', slots: [slots[1], slots[2]] }])
  })
})

describe('countLabel', () => {
  it('pluralises', () => {
    expect(countLabel(1, 'duty', 'duties')).toBe('1 duty')
    expect(countLabel(3, 'duty', 'duties')).toBe('3 duties')
  })
})

describe('dutyDropLocked', () => {
  const today = '2026-06-08'
  it('locks a duty 3 days out with the default lock', () => {
    expect(dutyDropLocked({ slot_date: '2026-06-11' }, today, 3)).toBe(true)
  })
  it('leaves a duty 4 days out open', () => {
    expect(dutyDropLocked({ slot_date: '2026-06-12' }, today, 3)).toBe(false)
  })
  it('locks today and the past', () => {
    expect(dutyDropLocked({ slot_date: today }, today, 0)).toBe(true)
    expect(dutyDropLocked({ slot_date: '2026-06-01' }, today, 0)).toBe(true)
  })
  it('locks a slot an admin locked, however far out', () => {
    expect(dutyDropLocked({ slot_date: '2026-08-01', locked: true }, today, 3)).toBe(true)
  })
  it('counts days across a month end', () => {
    expect(dutyDropLocked({ slot_date: '2026-07-03' }, '2026-06-29', 3)).toBe(false)
  })
})

describe('dutyYear', () => {
  it("uses the session's year, else the date's", () => {
    expect(dutyYear({ slot_date: '2027-01-02', session_id: 'w1' }, [W1])).toBe(2026)
    expect(dutyYear({ slot_date: '2027-01-02', session_id: null }, [W1])).toBe(2027)
  })
})

describe('dutyWeekLine', () => {
  const w = { name: 'Week 2', required_minutes: 60, my_minutes: 30, deadline: '2026-06-08' }
  it('says how many more minutes and by when', () => {
    expect(dutyWeekLine(w, '2026-06-05')).toEqual({ met: false, lead: 'Week 2: 30 of 60 duty minutes.', rest: 'Sign up for 30 more by Monday, Jun 8.' })
  })
  it('says today on the deadline itself', () => {
    expect(dutyWeekLine(w, '2026-06-08').rest).toBe('Sign up for 30 more by today.')
  })
  it('warns after the deadline', () => {
    expect(dutyWeekLine(w, '2026-06-09').rest).toBe('Sign-ups closed Jun 8, so the camp may add you. Pick a duty to choose it yourself.')
  })
  it('confirms a met minimum', () => {
    expect(dutyWeekLine({ ...w, my_minutes: 75 }, '2026-06-09')).toEqual({ met: true, lead: 'Week 2: 75 duty minutes.', rest: "You've met the 60-minute minimum." })
  })
})

describe('neededForMinimum', () => {
  const weeks = [{ start_date: '2026-06-15', end_date: '2026-06-19', required_minutes: 60, my_minutes: 90, deadline: '2026-06-08' }]
  it('holds a duty whose drop would go under the minimum after the deadline', () => {
    expect(neededForMinimum({ slot_date: '2026-06-16' }, 45, weeks, '2026-06-09')).toBe(true)
  })
  it('frees a duty the minimum can spare', () => {
    expect(neededForMinimum({ slot_date: '2026-06-16' }, 15, weeks, '2026-06-09')).toBe(false)
  })
  it('frees everything before the deadline', () => {
    expect(neededForMinimum({ slot_date: '2026-06-16' }, 45, weeks, '2026-06-08')).toBe(false)
  })
  it('ignores duties outside the week', () => {
    expect(neededForMinimum({ slot_date: '2026-06-22' }, 45, weeks, '2026-06-09')).toBe(false)
  })
})
