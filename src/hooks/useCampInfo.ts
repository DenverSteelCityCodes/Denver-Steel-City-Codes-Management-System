import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CampInfo } from '../lib/campInfo'

// The public camp page's data: one call that signed-out visitors may make (spec 30).
export function useCampInfo() {
  const [info, setInfo] = useState<CampInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('public_camp_info')
    if (error) setError(error.message)
    else { setInfo(data as CampInfo); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    void supabase.rpc('public_camp_info').then(({ data, error }) => {
      if (!alive) return
      if (error) setError(error.message)
      else setInfo(data as CampInfo)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  return { info, error, loading, retry: load }
}
