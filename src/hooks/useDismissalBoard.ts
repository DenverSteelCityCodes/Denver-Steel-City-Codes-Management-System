import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DismissalRow } from '../lib/pickups'

// Today's dismissal for every section (spec 36), from the admin-only dismissal_board() RPC. Reloads
// whenever `version` changes (the attendance board's minute refresh), keeping the last good rows
// on screen if a reload fails.
export function useDismissalBoard(version: unknown) {
  const [rows, setRows] = useState<DismissalRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('dismissal_board')
    if (error) { setError(error.message); return }
    setRows((data ?? []) as DismissalRow[])
    setError(null)
  }, [])

  useEffect(() => {
    // Deferred a tick so the effect doesn't set state synchronously.
    void Promise.resolve().then(load)
  }, [load, version])

  return { rows, error }
}
