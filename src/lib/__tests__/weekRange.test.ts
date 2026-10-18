import { describe, expect, it } from 'vitest'
import { mondayOf, shortRange } from '../weekRange'

describe('shortRange', () => {
  it('names the month once inside one month', () => expect(shortRange('2026-10-19', '2026-10-23')).toBe('Oct 19–23'))
  it('names both months across a month', () => expect(shortRange('2026-10-29', '2026-11-02')).toBe('Oct 29 – Nov 2'))
})

describe('mondayOf', () => {
  it('keeps a Monday', () => expect(mondayOf('2026-10-19')).toBe('2026-10-19'))
  it('walks a Friday and a Sunday back to their Monday', () => {
    expect(mondayOf('2026-10-23')).toBe('2026-10-19')
    expect(mondayOf('2026-10-25')).toBe('2026-10-19')
  })
})
