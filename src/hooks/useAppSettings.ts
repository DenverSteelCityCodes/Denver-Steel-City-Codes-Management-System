import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAppSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {}
          for (const row of data) map[row.key] = row.value
          setSettings(map)
        }
        setLoading(false)
      })
  }, [])

  async function updateSetting(key: string, value: string) {
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
    if (error) throw new Error(error.message)
    setSettings(s => ({ ...s, [key]: value }))
  }

  return { settings, loading, updateSetting }
}
