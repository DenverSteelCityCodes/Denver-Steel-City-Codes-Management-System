import { describe, expect, it } from 'vitest'
import { bioProblem, checklistState, dueLabel, hoursLabel, initials, isOverdue, photoStatus, taskDueAt, validHelpUrl, validMeetingUrl } from '../onboarding'
import type { ChecklistItem } from '../onboarding'

// Monday, October 19, 2026, 2:00 PM in Denver (MDT, UTC−6).
const NOW = new Date('2026-10-19T20:00:00Z')
const item = (key: string, due_at: string | null, done_at: string | null = null): ChecklistItem =>
  ({ key, label: key, help_url: null, due_at, done_at, verified: false })

describe('dueLabel', () => {
  it('says today, tomorrow or the day, in Denver time', () => {
    expect(dueLabel('2026-10-20T04:00:00Z', NOW)).toBe('Due today at 10:00 PM')
    expect(dueLabel('2026-10-20T15:00:00Z', NOW)).toBe('Due tomorrow at 9:00 AM')
    expect(dueLabel('2026-10-22T15:00:00Z', NOW)).toBe('Due Thu, Oct 22 at 9:00 AM')
  })
  it('says overdue once the time has passed', () => {
    expect(dueLabel('2026-10-19T19:00:00Z', NOW)).toBe('Overdue since today at 1:00 PM')
    expect(dueLabel('2026-10-17T15:00:00Z', NOW)).toBe('Overdue since Sat, Oct 17 at 9:00 AM')
  })
  it('has nothing to say without a due time', () => {
    expect(dueLabel(null, NOW)).toBeNull()
  })
})

describe('checklistState', () => {
  it('counts done and late items and picks the next one due', () => {
    const items = [
      item('a', '2026-10-19T18:00:00Z'),
      item('b', '2026-10-20T18:00:00Z', '2026-10-19T17:00:00Z'),
      item('c', null),
      item('d', '2026-10-21T18:00:00Z'),
    ]
    const s = checklistState(items, NOW)
    expect(s).toMatchObject({ done: 1, total: 4, overdue: 1, complete: false })
    expect(s.next?.key).toBe('a')
  })
  it('is complete when every item is done, and never for an empty list', () => {
    expect(checklistState([item('a', null, '2026-10-19T17:00:00Z')], NOW).complete).toBe(true)
    expect(checklistState([], NOW).complete).toBe(false)
  })
  it('a done item is never overdue', () => {
    expect(isOverdue(item('a', '2026-10-18T00:00:00Z', '2026-10-19T00:00:00Z'), NOW)).toBe(false)
  })
})

describe('links', () => {
  it('help links: https or a path in the app', () => {
    expect(validHelpUrl('https://discord.gg/abc')).toBe(true)
    expect(validHelpUrl('/volunteer/profile')).toBe(true)
    expect(validHelpUrl('//evil.example')).toBe(false)
    expect(validHelpUrl('javascript:alert(1)')).toBe(false)
    expect(validHelpUrl('http://plain.example')).toBe(false)
  })
  it('meeting links: https only', () => {
    expect(validMeetingUrl('https://zoom.us/j/123')).toBe(true)
    expect(validMeetingUrl('zoom.us/j/123')).toBe(false)
    expect(validMeetingUrl('https://a b')).toBe(false)
  })
})

describe('profile', () => {
  it('limits the bio to 300 characters, ignoring outer spaces', () => {
    expect(bioProblem('x'.repeat(300) + '  ')).toBeNull()
    expect(bioProblem('x'.repeat(301))).toBe("Keep your bio to 300 characters. It's 301 now.")
  })
  it('explains who sees the photo', () => {
    expect(photoStatus({ hasPhoto: false, consent: true, needsGuardian: false, guardianName: '' })).toBeNull()
    expect(photoStatus({ hasPhoto: true, consent: false, needsGuardian: false, guardianName: '' })).toMatch(/Only you/)
    expect(photoStatus({ hasPhoto: true, consent: true, needsGuardian: true, guardianName: ' ' })).toMatch(/until a parent or guardian agrees/)
    expect(photoStatus({ hasPhoto: true, consent: true, needsGuardian: true, guardianName: 'Pat' })).toMatch(/Parents of campers/)
  })
  it('makes initials and hour labels', () => {
    expect(initials('Mary Kate')).toBe('MK')
    expect(initials('Sam')).toBe('S')
    expect(hoursLabel(24)).toBe('1 day')
    expect(hoursLabel(48)).toBe('2 days')
    expect(hoursLabel(36)).toBe('36 hours')
  })
})

describe('taskDueAt', () => {
  it('counts from acceptance, or from when the item was added if later', () => {
    expect(taskDueAt('2026-10-19T03:00:00Z', '2026-01-01T00:00:00Z', 24)).toBe('2026-10-20T03:00:00.000Z')
    expect(taskDueAt('2026-06-01T00:00:00Z', '2026-10-19T12:00:00Z', 48)).toBe('2026-10-21T12:00:00.000Z')
  })
  it('has no due time for someone accepted before checklists', () => {
    expect(taskDueAt(null, '2026-01-01T00:00:00Z', 24)).toBeNull()
  })
})
