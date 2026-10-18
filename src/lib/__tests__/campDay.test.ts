import { describe, expect, it } from 'vitest'
import { firstName, formatTime, formatTimeRange, heldKeys, localDateISO, markKey, mergeMarks, rollCallForTime, sessionDays, sessionOnDay } from '../campDay'
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

describe('roll-call writes and reads', () => {
  const mark = (student_id: string, present: boolean) => ({ student_id, roll_call: 'arrival' as const, present })
  const a = markKey('a', 'arrival')
  const b = markKey('b', 'arrival')

  it('keeps a tap that a read started before it landed would undo', () => {
    // A was saved before read 3 started; B is still in flight.
    const guards = new Map([[a, 3], [b, Infinity]])
    const onScreen = [mark('a', false), mark('b', false)]
    const read2 = [mark('a', true)]
    const held = heldKeys(guards, 2)
    expect([...held].sort()).toEqual([a, b])
    expect(mergeMarks(onScreen, read2, held)).toEqual(onScreen)
  })

  it('takes the database value once a read includes the write', () => {
    const guards = new Map([[a, 3], [b, Infinity]])
    const held = heldKeys(guards, 3)
    expect([...held]).toEqual([b])
    expect(guards.has(a)).toBe(false)
    // A co-volunteer's "absent" wins over this screen's optimistic "present" for A.
    expect(mergeMarks([mark('a', true), mark('b', true)], [mark('a', false)], held))
      .toEqual([mark('a', false), mark('b', true)])
  })

  it('passes a read through when nothing is held', () => {
    const fresh = [mark('a', true)]
    expect(mergeMarks([mark('a', false)], fresh, heldKeys(new Map(), 1))).toBe(fresh)
  })
})
