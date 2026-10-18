// A refetch that fails must not wipe what's on screen, or a dropped connection after a laptop
// sleeps reads as "no rows" — and for the registration switch, a missing row reads as "open".
// Keep the last good value, and surface the error so the screen can say it couldn't check.
export interface ReadResult<T> { value: T; error: string | null }

export function keepLastGood<T>(
  previous: T,
  read: { data: T | null; error: { message: string } | null },
  empty: T,
): ReadResult<T> {
  if (read.error) return { value: previous, error: read.error.message }
  return { value: read.data ?? empty, error: null }
}
