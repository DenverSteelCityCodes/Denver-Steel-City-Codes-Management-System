import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface FieldConfig {
  visible?: boolean
  required?: boolean
  label?: string
}

export interface FormConfig {
  enabled: boolean
  fields: Record<string, FieldConfig>
}

export interface FormConfigRow {
  id: string
  form_key: string
  config: FormConfig
  updated_at: string
}

export function useFormConfigs() {
  const [configs, setConfigs] = useState<FormConfigRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchConfigs() }, [])

  async function fetchConfigs() {
    setLoading(true)
    const { data } = await supabase.from('form_configs').select('*').order('form_key')
    setConfigs(data ?? [])
    setLoading(false)
  }

  async function setFormEnabled(formKey: string, enabled: boolean) {
    const existing = configs.find(c => c.form_key === formKey)
    if (!existing) throw new Error(`Form "${formKey}" not found`)
    const merged = { ...existing.config, enabled }
    const { error } = await supabase
      .from('form_configs')
      .update({ config: merged, updated_at: new Date().toISOString() })
      .eq('form_key', formKey)
    if (error) throw error
    await fetchConfigs()
  }

  async function updateField(formKey: string, fieldKey: string, patch: FieldConfig) {
    const existing = configs.find(c => c.form_key === formKey)
    if (!existing) throw new Error(`Form "${formKey}" not found`)
    const merged = {
      ...existing.config,
      fields: {
        ...existing.config.fields,
        [fieldKey]: { ...existing.config.fields[fieldKey], ...patch },
      },
    }
    const { error } = await supabase
      .from('form_configs')
      .update({ config: merged, updated_at: new Date().toISOString() })
      .eq('form_key', formKey)
    if (error) throw error
    await fetchConfigs()
  }

  return { configs, loading, setFormEnabled, updateField, refetch: fetchConfigs }
}
