import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// section_id → lead's first name, for roles that can't read profiles (parents).
export function useSectionLeadNames() {
  const [names, setNames] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let cancelled = false
    supabase.rpc('section_lead_names').then(({ data }) => {
      if (cancelled) return
      setNames(new Map(((data ?? []) as { section_id: string; lead_first_name: string }[])
        .map(r => [r.section_id, r.lead_first_name])))
    })
    return () => { cancelled = true }
  }, [])
  return names
}
