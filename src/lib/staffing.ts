import type { StaffingTone } from '../types/database'

// Spec 39: planned crew, regardless of absences. Keep in step with private.staffing_status().
export function staffingStatus(seated: number, crew: number, target: number, minimum: number) {
  const ratio = crew > 0 ? seated / crew : null
  const short = minimum - crew
  let tone: StaffingTone
  let word: string
  if (short > 0) {
    tone = 'red'
    word = `Short ${short} ${short === 1 ? 'teacher' : 'teachers'}`
  } else if (ratio! > target * 1.25) {
    tone = 'red'; word = 'Over the target'
  } else if (ratio! > target) {
    tone = 'amber'; word = 'Above the target'
  } else {
    tone = 'green'; word = ratio === target ? 'At the target' : 'Under the target'
  }
  return { tone, word, ratio, required: Math.max(minimum, Math.ceil(seated / target)), small: seated <= target * minimum }
}
