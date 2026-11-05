// Which support rows a save has to add and which it has to drop. Unchanged people are in
// neither list, so a save never deletes and re-inserts someone who was already on the section.
export function supportCrewDiff(current: readonly string[], next: readonly string[]): { add: string[]; remove: string[] } {
  const have = new Set(current)
  const want = new Set(next)
  return {
    add: [...want].filter(id => !have.has(id)),
    remove: [...have].filter(id => !want.has(id)),
  }
}
