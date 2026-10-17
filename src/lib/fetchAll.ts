// The API returns at most 1,000 rows per request (Supabase `max_rows`, confirmed 2026-10-17), so
// any list that can grow past that pages through it. `page(from, to)` must build the same ordered
// query each time (order by a unique column last, so pages don't overlap or skip). Spec 18.
export const API_MAX_ROWS = 1000

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = API_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}
