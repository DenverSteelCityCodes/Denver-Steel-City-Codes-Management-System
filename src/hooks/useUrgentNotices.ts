import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isUrgentLive } from '../lib/urgent'
import { useRefetchOnFocus } from './useRefetchOnFocus'
import type { Update } from '../types/database'

export type UrgentNotice = Pick<Update, 'id' | 'body' | 'author_name' | 'created_at'>

// Urgent notices (spec 34) the signed-in user may read (RLS decides), newest first, while they
// are live: until the end of the Denver day they were posted. Checks again every minute on focus.
export function useUrgentNotices() {
  const [notices, setNotices] = useState<UrgentNotice[]>([])

  const fetchNotices = useCallback(() => supabase
    .from('updates')
    .select('id, body, author_name, created_at')
    .eq('urgent', true)
    // A day and a half back covers "today" in Denver from any device clock.
    .gte('created_at', new Date(Date.now() - 36 * 3600_000).toISOString())
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      // A failed check keeps what was on screen: a safety banner shouldn't blink away.
      if (!error) setNotices((data ?? []) as UrgentNotice[])
    }), [])

  useEffect(() => { void fetchNotices() }, [fetchNotices])
  useRefetchOnFocus(fetchNotices, 60_000)

  return notices.filter(n => isUrgentLive(n.created_at))
}
