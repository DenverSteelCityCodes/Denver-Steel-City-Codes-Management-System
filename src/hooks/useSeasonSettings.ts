import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// One camp year's registration settings (migration_season_settings.sql, spec 13). No row means
// no scheduled opening and the decided defaults (14-day change deadline, 48 h / 12 h offers).
export interface SeasonSettings {
  year: number
  registration_opens_at: string | null
  change_deadline_days: number
  offer_hours: number
  offer_hours_final_week: number
  updated_at?: string
}

export const DEFAULT_SEASON_SETTINGS = { registration_opens_at: null, change_deadline_days: 14, offer_hours: 48, offer_hours_final_week: 12 }

export function useSeasonSettings(year: number | null) {
  const [settings, setSettings] = useState<SeasonSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (y: number) => {
    const { data, error } = await supabase.from('season_settings').select('*').eq('year', y).maybeSingle()
    return { data: (data as SeasonSettings | null) ?? { year: y, ...DEFAULT_SEASON_SETTINGS }, error: error?.message ?? null }
  }, [])

  useEffect(() => {
    if (!year) return
    let alive = true
    void load(year).then(({ data, error }) => {
      if (!alive) return
      // A failed read keeps the last good settings; a later good read clears the error.
      setError(error)
      if (!error) setSettings(data)
      setLoading(false)
    })
    return () => { alive = false }
  }, [year, load])

  // Resolves false when the read failed.
  async function fetchSettings(): Promise<boolean> {
    if (!year) return true
    const { data, error } = await load(year)
    setError(error)
    if (!error) setSettings(data)
    return !error
  }

  // Admin only (RLS). Upserts the year's row; updated_at is stamped by the database.
  async function save(patch: Partial<Omit<SeasonSettings, 'year' | 'updated_at'>>) {
    if (!year) return
    const { data, error } = await supabase
      .from('season_settings')
      .upsert({ year, ...DEFAULT_SEASON_SETTINGS, ...settings, ...patch, updated_at: undefined })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setSettings(data as SeasonSettings)
  }

  return { settings, loading, error, save, refetch: fetchSettings }
}

// True once the scheduled opening has passed (or there's no scheduled opening).
export function registrationIsOpen(settings: SeasonSettings | null, now: number = Date.now()): boolean {
  return !settings?.registration_opens_at || new Date(settings.registration_opens_at).getTime() <= now
}
