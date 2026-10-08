import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

import type { FieldConfig } from '../lib/formFields'
export type { FieldConfig }

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

  // Writes replace the whole config JSON, so two edits built from the same on-screen copy would
  // overwrite each other. Each write waits for the one before it and merges into a fresh read.
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => { fetchConfigs() }, [])

  // No loading flag on refetch: flipping it would unmount the editor rows and drop a half-typed label.
  async function fetchConfigs() {
    const { data } = await supabase.from('form_configs').select('*').order('form_key')
    setConfigs(data ?? [])
    setLoading(false)
  }

  function write(formKey: string, change: (current: FormConfig) => FormConfig): Promise<void> {
    const job = queue.current.catch(() => {}).then(async () => {
      const { data, error: readError } = await supabase
        .from('form_configs').select('config').eq('form_key', formKey).maybeSingle()
      if (readError) throw new Error(readError.message)
      if (!data) throw new Error(`Form "${formKey}" not found`)
      const current = data.config as Partial<FormConfig>
      const { error } = await supabase
        .from('form_configs')
        .update({
          config: change({ enabled: current.enabled !== false, fields: current.fields ?? {} }),
          updated_at: new Date().toISOString(),
        })
        .eq('form_key', formKey)
      if (error) throw new Error(error.message)
      await fetchConfigs()
    })
    queue.current = job
    return job
  }

  function setFormEnabled(formKey: string, enabled: boolean) {
    return write(formKey, c => ({ ...c, enabled }))
  }

  function updateField(formKey: string, fieldKey: string, patch: FieldConfig) {
    return write(formKey, c => ({ ...c, fields: { ...c.fields, [fieldKey]: { ...c.fields[fieldKey], ...patch } } }))
  }

  return { configs, loading, setFormEnabled, updateField, refetch: fetchConfigs }
}
