import { YOUNGEST_CAMP_AGE } from './campers'

// Periods the nightly job uses. The database is the source of truth
// (private.apply_retention in migration_retention.sql); these match it.
export const RETENTION_PERIODS = {
  medicalDays: 90,
  anonymizeYears: 2,
  parentYears: 2,
  rejectedApplicationYears: 1,
  volunteeredYears: 2,
  interestSignupDays: 60,
  conductIncidentYears: 1,
  waiverAge: 21,
} as const

// 1 January AFTER the year a camper turns 21, assuming they were the youngest age the camp
// takes (4th grade) in their first registration year. A later grade would make them look
// older and end the hold too soon. Same date as private.turns_21(). Unknown year → no date.
// SCC still has to confirm this conservative default.
export function turns21On(firstRegistrationYear: number | null | undefined): string | null {
  if (firstRegistrationYear == null || !Number.isInteger(firstRegistrationYear) || firstRegistrationYear < 1) return null
  const year = firstRegistrationYear - YOUNGEST_CAMP_AGE + RETENTION_PERIODS.waiverAge + 1
  if (year < 1 || year > 9999) return null
  return `${String(year).padStart(4, '0')}-01-01`
}
