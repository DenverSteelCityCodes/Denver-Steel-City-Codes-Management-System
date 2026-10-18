import { isSameCampDay } from './denverTime'

// Urgent notices (spec 34): an admin's safety notice to an audience. The database emails everyone
// in it at once; the dashboards show it as a banner until the end of the camp day it was posted.

// Prewritten starts for the composer. The admin edits the details before sending.
export const URGENT_PRESETS = [
  {
    key: 'site_hold',
    label: 'Site hold',
    body: 'The school has asked everyone to stay inside: a site hold is in place right now. All campers are safe in their classrooms with their crew. Please don\'t come to the building until we write again. We\'ll send an update as soon as the hold is lifted.',
  },
  {
    key: 'weather',
    label: 'Weather',
    body: 'Because of the weather, campers are staying inside the building. Everyone is safe. If this changes pickup, we\'ll tell you here and by email before the end of the day.',
  },
  {
    key: 'early_dismissal',
    label: 'Early dismissal',
    body: 'Camp is ending early today. Please pick up your camper at [time] from [place]. If you can\'t make it, reply to this email or call the camp so we can keep your camper safe until you arrive.',
  },
] as const

// Is this urgent notice still a banner? Until the end of the Denver day it was posted.
export function isUrgentLive(createdAt: string, now: number = Date.now()): boolean {
  return isSameCampDay(createdAt, now)
}
