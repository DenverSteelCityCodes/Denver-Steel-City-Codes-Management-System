import { describe, expect, it } from 'vitest'
import { supportCrewDiff } from '../supportCrewDiff'

describe('supportCrewDiff', () => {
  it('leaves an unchanged support out of both lists', () => {
    expect(supportCrewDiff(['a', 'b'], ['b', 'a'])).toEqual({ add: [], remove: [] })
  })

  it('adds only the new people and removes only the ones who left', () => {
    expect(supportCrewDiff(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'] })
  })

  it('treats duplicates as one person', () => {
    expect(supportCrewDiff(['a', 'a'], ['a', 'b', 'b'])).toEqual({ add: ['b'], remove: [] })
  })

  it('can add onto an empty crew or clear one', () => {
    expect(supportCrewDiff([], ['a'])).toEqual({ add: ['a'], remove: [] })
    expect(supportCrewDiff(['a'], [])).toEqual({ add: [], remove: ['a'] })
  })
})
