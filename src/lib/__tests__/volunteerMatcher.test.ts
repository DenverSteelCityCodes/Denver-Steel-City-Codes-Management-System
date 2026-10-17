import { describe, expect, it } from 'vitest'
import { matchVolunteers } from '../volunteerMatcher'
import type { VolunteerWithProfile } from '../../hooks/useVolunteers'

// Only the fields the matcher reads.
const vol = (id: string, level: 'senior' | 'junior', w1 = true, w2 = true) =>
  ({ id, experience_level: level, availability_week_1: w1, availability_week_2: w2 }) as unknown as VolunteerWithProfile
const sec = (id: string, week: 1 | 2 | null, lead_id: string | null = null, supports: string[] = []) =>
  ({ id, class_id: 'c', label: id, week, lead_id, supports: supports.map(s => ({ id: s })) }) as unknown as Parameters<typeof matchVolunteers>[1][number]

describe('matchVolunteers', () => {
  it('pairs one senior lead and one junior support per section', () => {
    const [pair] = matchVolunteers([vol('s1', 'senior'), vol('j1', 'junior')], [sec('A', 1)], 1)
    expect(pair.lead?.id).toBe('s1')
    expect(pair.support?.id).toBe('j1')
  })

  it('never puts the same volunteer on two sections in one week', () => {
    const pairs = matchVolunteers([vol('s1', 'senior'), vol('j1', 'junior')], [sec('A', 1), sec('B', 1)], 1)
    expect(pairs[0].lead?.id).toBe('s1')
    expect(pairs[1].lead).toBeNull()
    expect(pairs[1].support).toBeNull()
  })

  it('needs both weeks free for a both-weeks section', () => {
    const pairs = matchVolunteers([vol('s1', 'senior', true, false), vol('s2', 'senior')], [sec('BOTH', null)], null)
    expect(pairs[0].lead?.id).toBe('s2')
  })

  it('counts existing crews on sections outside the run', () => {
    // s1 already leads a Week 2 section, so a both-weeks section in a Week 1 run can't take them.
    const pairs = matchVolunteers([vol('s1', 'senior')], [sec('W2', 2, 's1'), sec('BOTH', null)], 1)
    expect(pairs.find(p => p.sectionId === 'BOTH')?.lead).toBeNull()
  })

  it('leaves sections that already have a lead or supports alone', () => {
    const [pair] = matchVolunteers([vol('s2', 'senior'), vol('j2', 'junior')], [sec('A', 1, 's1', ['j1'])], 1)
    expect(pair.lead).toBeNull()
    expect(pair.support).toBeNull()
  })

  it('respects availability', () => {
    const [pair] = matchVolunteers([vol('s1', 'senior', false, true)], [sec('A', 1)], 1)
    expect(pair.lead).toBeNull()
  })
})
