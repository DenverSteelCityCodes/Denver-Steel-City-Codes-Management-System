import { supabase } from './supabase'

export interface SectionFill {
  active: number    // confirmed + pending — what counts against capacity
  waitlist: number
}

// True per-section totals from the section_fill_counts() RPC. An embedded registrations(count)
// is filtered by the caller's RLS, so for parents it only ever counted their own campers.
export async function fetchSectionFill(): Promise<Map<string, SectionFill>> {
  const { data, error } = await supabase.rpc('section_fill_counts')
  if (error) throw new Error(error.message)
  const fill = new Map<string, SectionFill>()
  for (const row of (data ?? []) as { section_id: string; active_count: number; waitlist_count: number }[]) {
    fill.set(row.section_id, { active: row.active_count, waitlist: row.waitlist_count })
  }
  return fill
}
