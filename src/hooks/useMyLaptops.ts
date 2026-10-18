import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MyLaptop } from '../lib/laptopLoans'

// The family's loaner laptops, one per camper-week (spec 29), from my_laptop_loans(): status,
// place in the queue, and whether it can still change online. Reloads when `version` changes (the
// registrations list after a refetch: a cancelled spot releases its laptop in the database).
export interface Laptops {
  byRegistration: Map<string, MyLaptop>
  request: (registrationId: string) => Promise<void>
  release: (registrationId: string) => Promise<void>
}

export function useMyLaptops(version: unknown, enabled: boolean): Laptops {
  const [byRegistration, setByRegistration] = useState<Map<string, MyLaptop>>(new Map())

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_laptop_loans')
    // A failed reload keeps what's on screen rather than showing every week as "Not needed".
    if (error) return null
    return new Map(((data ?? []) as MyLaptop[]).map(l => [l.registration_id, l]))
  }, [])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void load().then(m => { if (alive && m) setByRegistration(m) })
    return () => { alive = false }
  }, [enabled, load, version])

  async function refresh() {
    const m = await load()
    if (m) setByRegistration(m)
  }

  async function request(registrationId: string) {
    const { error } = await supabase.rpc('request_laptop', { p_registration_id: registrationId })
    if (error) throw new Error(error.message)
    await refresh()
  }

  async function release(registrationId: string) {
    const { error } = await supabase.rpc('release_laptop', { p_registration_id: registrationId })
    if (error) throw new Error(error.message)
    await refresh()
  }

  return { byRegistration, request, release }
}
