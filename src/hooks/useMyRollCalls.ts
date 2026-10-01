import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRefetchOnFocus } from './useRefetchOnFocus'
import type { RollCallMark } from '../types/database'

// Today's roll-call marks the signed-in user may see (parents: their own campers, via RLS).
export function useMyRollCalls(day: string) {
  const [marks, setMarks] = useState<RollCallMark[]>([])
  const fetchMarks = useCallback(() => supabase
    .from('roll_call_marks')
    .select('*')
    .eq('day', day)
    .then(({ data }) => { setMarks((data ?? []) as RollCallMark[]) }), [day])
  useEffect(() => { void fetchMarks() }, [fetchMarks])
  useRefetchOnFocus(fetchMarks, 60_000)
  return marks
}
