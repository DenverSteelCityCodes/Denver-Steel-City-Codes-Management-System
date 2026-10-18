// Where camp happens. Each week's place is sessions.location (spec 30), set on Setup › Sessions;
// it used to be one hard-coded venue, though building moves have happened.
type Placed = { name: string; location?: string | null }

const placeOf = (s: Placed) => s.location?.trim() || null

// The one place every given week shares, else null (no place yet, or the weeks differ).
export function sharedPlace(weeks: Placed[]): string | null {
  const places = weeks.map(placeOf)
  return places.length > 0 && places[0] && places.every(p => p === places[0]) ? places[0] : null
}

// "Camp is held at Cherry Creek High School." · "Week 1 is at A. Week 2 is at B." · null when no
// week has a place yet.
export function placeSentence(weeks: Placed[]): string | null {
  const shared = sharedPlace(weeks)
  if (shared) return `Camp is held at ${shared}.`
  const known = weeks.filter(placeOf)
  if (known.length === 0) return null
  return known.map(w => `${w.name} is at ${placeOf(w)}.`).join(' ')
}
