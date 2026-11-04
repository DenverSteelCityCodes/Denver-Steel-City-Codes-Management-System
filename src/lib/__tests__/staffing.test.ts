import { describe, expect, it } from 'vitest'
import { staffingStatus } from '../staffing'

describe('staffing thresholds and words', () => {
  it.each([
    [0, 0, 'red', 'Short 2 teachers'],
    [0, 1, 'red', 'Short 1 teacher'],
    [0, 2, 'green', 'Under the target'],
    [7, 2, 'green', 'Under the target'],
    [8, 2, 'green', 'At the target'],
    [9, 2, 'amber', 'Above the target'],
    [10, 2, 'amber', 'Above the target'],
    [11, 2, 'red', 'Over the target'],
  ])('%i campers / %i crew', (seated, crew, tone, word) => {
    expect(staffingStatus(seated, crew, 4, 2)).toMatchObject({ tone, word })
  })
  it('honours course overrides, rounds demand up and includes the small-section boundary', () => {
    expect(staffingStatus(8, 2, 4, 3)).toMatchObject({ tone: 'red', required: 3, word: 'Short 1 teacher' })
    expect(staffingStatus(13, 3, 4, 3)).toMatchObject({ required: 4, small: false })
    expect(staffingStatus(12, 3, 4, 3).small).toBe(true)
    expect(staffingStatus(0, 0, 4, 2).ratio).toBeNull()
  })
})
