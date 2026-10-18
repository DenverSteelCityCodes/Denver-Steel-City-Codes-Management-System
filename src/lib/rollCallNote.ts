// Roll-call notes (spec 34): quick tags a volunteer adds to one camper's mark. Stored as a short
// readable line in roll_call_marks.note ("Late · Picked up by Grandma"), so the admin board and the
// CSV can show it as is. Text the tags don't recognise (an older note, an admin's words) is kept.

export interface NoteTags {
  late: boolean
  leftEarly: boolean
  // The person who picked the camper up, or null.
  pickedUpBy: string | null
  // Anything else in the note, kept as it was.
  other: string[]
}

const SEP = ' · '
const PICKED = 'Picked up by '
export const PICKED_UP_MAX = 60

export function parseNote(note: string | null | undefined): NoteTags {
  const tags: NoteTags = { late: false, leftEarly: false, pickedUpBy: null, other: [] }
  for (const raw of (note ?? '').split(SEP)) {
    const part = raw.trim()
    if (!part) continue
    if (part === 'Late') tags.late = true
    else if (part === 'Left early') tags.leftEarly = true
    else if (part.startsWith(PICKED) && part.length > PICKED.length) tags.pickedUpBy = part.slice(PICKED.length).trim()
    else tags.other.push(part)
  }
  return tags
}

// The note to store, or null when nothing is tagged.
export function buildNote(tags: NoteTags): string | null {
  const who = tags.pickedUpBy?.replace(/\s+/g, ' ').trim().slice(0, PICKED_UP_MAX)
  const parts = [
    tags.late && 'Late',
    tags.leftEarly && 'Left early',
    who && `${PICKED}${who}`,
    ...tags.other,
  ].filter(Boolean) as string[]
  return parts.length ? parts.join(SEP) : null
}
