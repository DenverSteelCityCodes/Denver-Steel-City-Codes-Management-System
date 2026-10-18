import { describe, expect, it } from 'vitest'
import { keepLastGood } from '../readResult'

describe('keepLastGood', () => {
  const lastGood = [{ form_key: 'student_registration', enabled: false }]

  it('keeps what was on screen when a refetch fails, and reports why', () => {
    // Without this, a failed read after sleep emptied the list and a missing row read as "open".
    expect(keepLastGood(lastGood, { data: null, error: { message: 'Failed to fetch' } }, []))
      .toEqual({ value: lastGood, error: 'Failed to fetch' })
  })

  it('takes a good read and clears the error', () => {
    const fresh = [{ form_key: 'student_registration', enabled: true }]
    expect(keepLastGood(lastGood, { data: fresh, error: null }, [])).toEqual({ value: fresh, error: null })
  })

  it('reads a good but empty result as empty, not as a failure', () => {
    expect(keepLastGood(lastGood, { data: null, error: null }, [])).toEqual({ value: [], error: null })
  })
})
