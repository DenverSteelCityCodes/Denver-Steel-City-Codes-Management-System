// Course rules (spec 31): a class's grade limit, the class to take first, and the repeat-course
// warning. The rules are columns on `classes` (migration_course_rules.sql) and the database
// enforces them for parents (registrations_before_insert(), the swap). These helpers only word the
// same rules for the screens, in the database's own sentences (private.course_rule_block()), so a
// class the UI greys out is one the database would refuse.

export interface RuleClass {
  id: string
  name: string
  grades_allowed?: string[] | null
  requires_class_id?: string | null
  requirement_note?: string | null
  next_class_id?: string | null
}

// One registration of the camper, in any year: which class, when, and whether it held a seat
// (confirmed, or a legacy pending). A waitlist place or a cancelled spot doesn't count.
export interface TakenClass {
  classId: string
  year: number | null
  week: number | null
  seat: boolean
}

// The class the camper would join: its camp year and week (null = runs both weeks).
export interface RuleTarget {
  year: number
  week: number | null
}

// "Microcontrollers and Web Development", "A, B and C".
function listWords(words: string[]): string {
  return words.length <= 1 ? words[0] ?? '' : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

// ['7th','8th','9th'] → 'grades 7–9'; ['7th'] → 'grade 7'; ['4th','6th'] → 'grades 4 and 6'.
// Grades without a number ('K') are kept as written. Mirrors private.grade_words().
export function gradeWords(grades: readonly string[]): string {
  const nums = grades.map(g => /^\s*(\d+)(st|nd|rd|th)?\s*$/i.exec(g)?.[1])
  let words: string[] = [...grades]
  if (nums.every(n => n !== undefined)) {
    const sorted = [...new Set(nums.map(Number))].sort((a, b) => a - b)
    if (sorted.length === 1) return `grade ${sorted[0]}`
    if (sorted[sorted.length - 1] - sorted[0] === sorted.length - 1) return `grades ${sorted[0]}–${sorted[sorted.length - 1]}`
    words = sorted.map(String)
  }
  return words.length === 1 ? `grade ${words[0]}` : `grades ${listWords(words)}`
}

const hasGrades = (cls: RuleClass): cls is RuleClass & { grades_allowed: string[] } =>
  !!cls.grades_allowed && cls.grades_allowed.length > 0

// "Microcontrollers is for grades 7–9 this fall." when the camper's grade (the one they enter this
// fall) isn't allowed; a camper with no grade on file doesn't qualify either. Else null.
export function gradeReason(cls: RuleClass, grade: string | null | undefined): string | null {
  if (!hasGrades(cls)) return null
  if (grade && cls.grades_allowed.includes(grade)) return null
  return `${cls.name} is for ${gradeWords(cls.grades_allowed)} this fall.`
}

// Has the camper taken `requiredId` before the target? A held seat in an earlier week of the same
// camp year, or in any past year. Mirrors private.prerequisite_met().
export function prerequisiteMet(requiredId: string, taken: readonly TakenClass[], target: RuleTarget): boolean {
  return taken.some(t => t.classId === requiredId && t.seat && t.year !== null && (
    t.year < target.year ||
    (t.year === target.year && t.week !== null && target.week !== null && t.week < target.week)))
}

// Why the class's own rules refuse this camper, or null. The grade comes first, as in the database.
export function courseRuleReason(cls: RuleClass, classes: readonly RuleClass[], grade: string | null | undefined,
  taken: readonly TakenClass[], target: RuleTarget): string | null {
  const byGrade = gradeReason(cls, grade)
  if (byGrade) return byGrade
  if (cls.requires_class_id && !prerequisiteMet(cls.requires_class_id, taken, target)) {
    const required = classes.find(c => c.id === cls.requires_class_id)
    return `${cls.name} needs ${required?.name ?? 'another class'} first.`
  }
  return null
}

// The rules in one line for families: "Grades 7–9 this fall, after Intermediate Python."
export function ruleSummary(grades: readonly string[] | null | undefined, requiresName: string | null | undefined): string | null {
  const g = grades && grades.length > 0 ? gradeWords(grades) : null
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (g && requiresName) return `${cap(g)} this fall, after ${requiresName}.`
  if (g) return `${cap(g)} this fall.`
  if (requiresName) return `After ${requiresName}.`
  return null
}

// The rule line plus the class's own note, for a class row.
export function classRuleLine(cls: RuleClass, classes: readonly RuleClass[]): string | null {
  const required = cls.requires_class_id ? classes.find(c => c.id === cls.requires_class_id)?.name ?? null : null
  const line = [ruleSummary(cls.grades_allowed, required), cls.requirement_note?.trim() || null].filter(Boolean).join(' ')
  return line || null
}

// The other week this camp year in which the camper already holds a seat in this class, or null.
export function repeatWeek(classId: string, taken: readonly TakenClass[], target: RuleTarget): number | null {
  const t = taken.find(x => x.classId === classId && x.seat && x.year === target.year && x.week !== null && x.week !== target.week)
  return t?.week ?? null
}

// "Already taking Intro to Python in Week 1. Try Intermediate Python?" (a warning, never a block).
export function repeatNote(className: string, week: number, nextName?: string | null): string {
  return `Already taking ${className} in Week ${week}.${nextName ? ` Try ${nextName}?` : ''}`
}

// The repeat warning for a class row, suggesting the class's next course only when it runs that
// week (`offeredIds`) and the camper meets its rules. Null when the camper isn't repeating.
export function repeatWarning(cls: RuleClass, classes: readonly RuleClass[], grade: string | null | undefined,
  taken: readonly TakenClass[], target: RuleTarget, offeredIds: ReadonlySet<string>): string | null {
  const week = repeatWeek(cls.id, taken, target)
  if (week === null) return null
  const next = cls.next_class_id ? classes.find(c => c.id === cls.next_class_id) : undefined
  const suggest = next && offeredIds.has(next.id) && !courseRuleReason(next, classes, grade, taken, target) ? next.name : null
  return repeatNote(cls.name, week, suggest)
}

// A camper's registrations as TakenClass, from rows shaped like useRegistrations()'s.
export function takenClasses(regs: readonly {
  student_id: string
  status: string
  year: number | null
  sections: { class_id?: string | null; week: number | null } | null
}[], studentId: string): TakenClass[] {
  return regs
    .filter(r => r.student_id === studentId && r.sections?.class_id)
    .map(r => ({
      classId: r.sections!.class_id as string,
      year: r.year ?? null,
      week: r.sections!.week ?? null,
      seat: r.status === 'confirmed' || r.status === 'pending',
    }))
}

// The database marks a refusal under a class's own rules with this hint (the family may then ask
// for an exception).
export const COURSE_RULE_HINT = 'course_rule'
export const isCourseRuleError = (e: unknown): boolean =>
  !!e && typeof e === 'object' && (e as { hint?: unknown }).hint === COURSE_RULE_HINT
