import { describe, expect, it } from 'vitest'
import {
  classRuleLine, courseRuleReason, gradeReason, gradeWords, isCourseRuleError, prerequisiteMet,
  repeatNote, repeatWarning, ruleSummary, takenClasses, type RuleClass, type TakenClass,
} from '../courseRules'

// Spec 31: the rules live on the class (from the database), never in its name.
const intro: RuleClass = { id: 'intro', name: 'Intro to Python', next_class_id: 'inter' }
const inter: RuleClass = { id: 'inter', name: 'Intermediate Python', next_class_id: 'mc' }
const mc: RuleClass = {
  id: 'mc', name: 'Microcontrollers', grades_allowed: ['7th', '8th', '9th'], requires_class_id: 'inter',
  requirement_note: 'Taking Intermediate Python in Week 1 counts.',
}
// Named like nothing in particular, so no rule can come from a name.
const robots: RuleClass = { id: 'rb', name: 'Microcontrollers for Beginners' }
const classes = [intro, inter, mc, robots]
const week2 = { year: 2027, week: 2 }

describe('gradeWords', () => {
  it('words a run of grades as a range, the same as the database', () => {
    expect(gradeWords(['7th', '8th', '9th'])).toBe('grades 7–9')
    expect(gradeWords(['9th', '7th', '8th'])).toBe('grades 7–9')
    expect(gradeWords(['7th'])).toBe('grade 7')
  })
  it('lists grades that skip, and keeps grades without a number as written', () => {
    expect(gradeWords(['4th', '6th', '8th'])).toBe('grades 4, 6 and 8')
    expect(gradeWords(['K', '1st'])).toBe('grades K and 1st')
  })
})

describe('gradeReason', () => {
  it('refuses a grade outside the class, and a camper with no grade on file', () => {
    expect(gradeReason(mc, '6th')).toBe('Microcontrollers is for grades 7–9 this fall.')
    expect(gradeReason(mc, null)).toBe('Microcontrollers is for grades 7–9 this fall.')
    expect(gradeReason(mc, '8th')).toBeNull()
  })
  it('lets anyone into a class without a grade limit, whatever its name', () => {
    expect(gradeReason(intro, '4th')).toBeNull()
    expect(gradeReason(robots, '4th')).toBeNull()
    expect(gradeReason({ ...intro, grades_allowed: [] }, '4th')).toBeNull()
  })
})

describe('prerequisiteMet', () => {
  const seat = (week: number | null, year = 2027, s = true): TakenClass => ({ classId: 'inter', year, week, seat: s })
  it('counts a held seat in an earlier week this year, or in any past year', () => {
    expect(prerequisiteMet('inter', [seat(1)], week2)).toBe(true)
    expect(prerequisiteMet('inter', [seat(2, 2026)], week2)).toBe(true)
    expect(prerequisiteMet('inter', [seat(null, 2025)], { year: 2027, week: 1 })).toBe(true)
  })
  it("doesn't count the same or a later week, a both-weeks class, a waitlist place or another class", () => {
    expect(prerequisiteMet('inter', [seat(2)], week2)).toBe(false)
    expect(prerequisiteMet('inter', [seat(2)], { year: 2027, week: 1 })).toBe(false)
    expect(prerequisiteMet('inter', [seat(null)], week2)).toBe(false)
    expect(prerequisiteMet('inter', [seat(1, 2027, false)], week2)).toBe(false)
    expect(prerequisiteMet('inter', [{ classId: 'intro', year: 2027, week: 1, seat: true }], week2)).toBe(false)
    expect(prerequisiteMet('inter', [seat(1)], { year: 2027, week: null })).toBe(false)
  })
})

describe('courseRuleReason', () => {
  const tookInter: TakenClass[] = [{ classId: 'inter', year: 2027, week: 1, seat: true }]
  it('gives the grade reason first, then the prerequisite, in the database\'s words', () => {
    expect(courseRuleReason(mc, classes, '6th', tookInter, week2)).toBe('Microcontrollers is for grades 7–9 this fall.')
    expect(courseRuleReason(mc, classes, '7th', [], week2)).toBe('Microcontrollers needs Intermediate Python first.')
    expect(courseRuleReason(mc, classes, '7th', tookInter, week2)).toBeNull()
  })
  it('applies the rules of any class that has them', () => {
    const adv: RuleClass = { id: 'adv', name: 'Java Projects', requires_class_id: 'rb' }
    expect(courseRuleReason(adv, [...classes, adv], '5th', [], week2)).toBe('Java Projects needs Microcontrollers for Beginners first.')
    expect(courseRuleReason(robots, classes, '4th', [], week2)).toBeNull()
  })
})

describe('rule lines', () => {
  it('sums the rules up in one line, with the class\'s own note', () => {
    expect(ruleSummary(['7th', '8th', '9th'], 'Intermediate Python')).toBe('Grades 7–9 this fall, after Intermediate Python.')
    expect(ruleSummary(['7th'], null)).toBe('Grade 7 this fall.')
    expect(ruleSummary(null, 'Intro to Java')).toBe('After Intro to Java.')
    expect(ruleSummary([], null)).toBeNull()
    expect(classRuleLine(mc, classes)).toBe('Grades 7–9 this fall, after Intermediate Python. Taking Intermediate Python in Week 1 counts.')
    expect(classRuleLine(intro, classes)).toBeNull()
  })
})

describe('repeat warning', () => {
  const tookIntro: TakenClass[] = [{ classId: 'intro', year: 2027, week: 1, seat: true }]
  const offered = new Set(['intro', 'inter', 'mc'])
  it('warns when the camper already holds this course in the other week, and suggests the next one', () => {
    expect(repeatWarning(intro, classes, '6th', tookIntro, week2, offered))
      .toBe('Already taking Intro to Python in Week 1. Try Intermediate Python?')
    expect(repeatNote('Web Development', 1)).toBe('Already taking Web Development in Week 1.')
  })
  it("doesn't suggest a next course that isn't offered that week or that the camper can't take", () => {
    expect(repeatWarning(intro, classes, '6th', tookIntro, week2, new Set(['intro'])))
      .toBe('Already taking Intro to Python in Week 1.')
    const tookInter: TakenClass[] = [{ classId: 'inter', year: 2027, week: 1, seat: true }]
    expect(repeatWarning(inter, classes, '6th', tookInter, week2, offered)).toBe('Already taking Intermediate Python in Week 1.')
    expect(repeatWarning(inter, classes, '8th', tookInter, week2, offered))
      .toBe('Already taking Intermediate Python in Week 1. Try Microcontrollers?')
  })
  it('stays quiet for another year, a waitlist place or the same week', () => {
    expect(repeatWarning(intro, classes, '6th', [{ classId: 'intro', year: 2026, week: 1, seat: true }], week2, offered)).toBeNull()
    expect(repeatWarning(intro, classes, '6th', [{ classId: 'intro', year: 2027, week: 1, seat: false }], week2, offered)).toBeNull()
    expect(repeatWarning(intro, classes, '6th', [{ classId: 'intro', year: 2027, week: 2, seat: true }], week2, offered)).toBeNull()
  })
})

describe('takenClasses', () => {
  it("keeps one camper's registrations, with whether each held a seat", () => {
    const regs = [
      { student_id: 'a', status: 'confirmed', year: 2027, sections: { class_id: 'inter', week: 1 } },
      { student_id: 'a', status: 'waitlisted', year: 2027, sections: { class_id: 'mc', week: 2 } },
      { student_id: 'a', status: 'cancelled', year: 2026, sections: { class_id: 'intro', week: 1 } },
      { student_id: 'b', status: 'confirmed', year: 2027, sections: { class_id: 'intro', week: 1 } },
    ]
    expect(takenClasses(regs, 'a')).toEqual([
      { classId: 'inter', year: 2027, week: 1, seat: true },
      { classId: 'mc', year: 2027, week: 2, seat: false },
      { classId: 'intro', year: 2026, week: 1, seat: false },
    ])
  })
})

describe('isCourseRuleError', () => {
  it('spots the database\'s course-rule hint', () => {
    expect(isCourseRuleError({ message: 'x', hint: 'course_rule' })).toBe(true)
    expect(isCourseRuleError(new Error('x'))).toBe(false)
    expect(isCourseRuleError(null)).toBe(false)
  })
})
