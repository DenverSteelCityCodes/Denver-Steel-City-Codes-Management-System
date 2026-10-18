import { describe, expect, it } from 'vitest'
import { crewGroups, type CrewPerson, type CrewSection } from '../sectionCrew'

const sam: CrewPerson = { id: 'sam', name: 'Sam Okafor', level: 'senior', week1: true, week2: true }
const bella: CrewPerson = { id: 'bella', name: 'Bella Nguyen', level: 'senior', week1: true, week2: true }
const harper: CrewPerson = { id: 'harper', name: 'Harper Ito', level: 'senior', week1: true, week2: true }
const aiden: CrewPerson = { id: 'aiden', name: 'Aiden Brooks', level: 'senior', week1: true, week2: false }
const jas: CrewPerson = { id: 'jas', name: 'Jasmine Kaur', level: 'junior', week1: true, week2: true }

const pyB1: CrewSection = { id: 'pyb1', label: 'PY-B', week: 1, lead_id: 'sam', support_ids: [] }
const pyA2: CrewSection = { id: 'pya2', label: 'PY-A', week: 2, lead_id: 'harper', support_ids: ['jas'] }
const pyB2: CrewSection = { id: 'pyb2', label: 'PY-B', week: 2, lead_id: null, support_ids: [] }

const labels = (r: ReturnType<typeof crewGroups>) => r.groups.map(g => g.label)
const texts = (r: ReturnType<typeof crewGroups>, i: number) => r.groups[i].options.map(o => o.text)

describe('section crew options', () => {
  it('lists free seniors first, then busy, then unavailable, saying why', () => {
    const r = crewGroups([jas, aiden, harper, bella, sam], [pyB1, pyA2, pyB2], { sectionId: 'pyb2', week: 2 }, 'lead')
    expect(labels(r)).toEqual(['Free in Week 2', 'Already crewing in Week 2', 'Not available in Week 2'])
    expect(texts(r, 0)).toEqual([
      'Bella Nguyen · senior · free Week 2',
      'Sam Okafor · senior · free Week 2 · leads PY-B Week 1',
    ])
    expect(texts(r, 1)).toEqual([
      'Harper Ito · senior · leads PY-A Week 2',
      'Jasmine Kaur · junior · supports PY-A Week 2',
    ])
    expect(texts(r, 2)).toEqual(['Aiden Brooks · senior · Week 1 only'])
    expect(r.freeSeniors).toBe(2)
  })

  it("doesn't count the section's own crew as busy", () => {
    const r = crewGroups([harper], [pyA2], { sectionId: 'pya2', week: 2 }, 'lead')
    expect(texts(r, 0)).toEqual(['Harper Ito · senior · free Week 2'])
  })

  it('puts juniors first for supports and leaves out the people already chosen', () => {
    const r = crewGroups([sam, bella, jas], [], { week: 1 }, 'support', new Set(['sam']))
    expect(texts(r, 0)).toEqual(['Jasmine Kaur · junior · free Week 1', 'Bella Nguyen · senior · free Week 1'])
    expect(r.freeJuniors).toBe(1)
  })

  it('treats a both-weeks section as needing, and blocking, both weeks', () => {
    const both: CrewSection = { id: 'mc', label: 'MC-1', week: null, lead_id: 'sam', support_ids: [] }
    const r = crewGroups([sam, aiden], [both], { week: 1 }, 'lead')
    expect(labels(r)).toEqual(['Free in Week 1', 'Already crewing in Week 1'])
    expect(texts(r, 1)).toEqual(['Sam Okafor · senior · leads MC-1 both weeks'])
    const r2 = crewGroups([aiden], [], { week: null }, 'lead')
    expect(texts(r2, 0)).toEqual(['Aiden Brooks · senior · Week 1 only'])
    expect(labels(r2)).toEqual(['Not available in both weeks'])
  })

  it('ignores cancelled sections', () => {
    const gone: CrewSection = { ...pyA2, cancelled: true }
    const r = crewGroups([harper], [gone], { week: 2 }, 'lead')
    expect(texts(r, 0)).toEqual(['Harper Ito · senior · free Week 2'])
  })
})
