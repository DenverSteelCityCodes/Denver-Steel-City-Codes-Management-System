import { describe, expect, it } from 'vitest'
import { buildNote, parseNote } from '../rollCallNote'
import { isUrgentLive, URGENT_PRESETS } from '../urgent'
import { overdueParentNotice } from '../incidents'

describe('roll-call notes', () => {
  it('reads and writes the quick tags', () => {
    const tags = parseNote('Late · Picked up by Grandma Rose')
    expect(tags).toEqual({ late: true, leftEarly: false, pickedUpBy: 'Grandma Rose', other: [] })
    expect(buildNote({ ...tags, leftEarly: true })).toBe('Late · Left early · Picked up by Grandma Rose')
  })
  it('keeps words it does not know', () => {
    const tags = parseNote('Left early · dentist appointment')
    expect(tags.other).toEqual(['dentist appointment'])
    expect(buildNote({ ...tags, leftEarly: false })).toBe('dentist appointment')
  })
  it('is empty with nothing tagged, and tidies the pickup name', () => {
    expect(parseNote(null)).toEqual({ late: false, leftEarly: false, pickedUpBy: null, other: [] })
    expect(buildNote(parseNote(''))).toBeNull()
    expect(buildNote({ late: false, leftEarly: false, pickedUpBy: '   ', other: [] })).toBeNull()
    expect(buildNote({ late: false, leftEarly: false, pickedUpBy: '  Mom   and  Dad ', other: [] })).toBe('Picked up by Mom and Dad')
    expect(buildNote({ late: false, leftEarly: false, pickedUpBy: 'x'.repeat(90), other: [] })!.length).toBe('Picked up by '.length + 60)
  })
})

describe('urgent banner', () => {
  it('stays up until the end of the Denver day it was posted', () => {
    const posted = '2026-07-14T15:00:00Z' // 9:00 AM in Denver
    expect(isUrgentLive(posted, Date.parse('2026-07-15T05:59:00Z'))).toBe(true)   // 11:59 PM Denver
    expect(isUrgentLive(posted, Date.parse('2026-07-15T06:01:00Z'))).toBe(false)  // 12:01 AM next day
  })
  it('has the three prewritten starts', () => {
    expect(URGENT_PRESETS.map(p => p.label)).toEqual(['Site hold', 'Weather', 'Early dismissal'])
  })
})

describe('incident parent notice', () => {
  const now = Date.parse('2026-07-15T18:00:00Z')
  it('is overdue after 24 hours with a camper and no notice', () => {
    expect(overdueParentNotice({ student_id: 's', parent_notified_at: null, created_at: '2026-07-14T17:59:00Z' }, now)).toBe(true)
    expect(overdueParentNotice({ student_id: 's', parent_notified_at: null, created_at: '2026-07-14T18:01:00Z' }, now)).toBe(false)
    expect(overdueParentNotice({ student_id: 's', parent_notified_at: '2026-07-14T19:00:00Z', created_at: '2026-07-14T10:00:00Z' }, now)).toBe(false)
    expect(overdueParentNotice({ student_id: null, parent_notified_at: null, created_at: '2026-07-10T10:00:00Z' }, now)).toBe(false)
  })
})
