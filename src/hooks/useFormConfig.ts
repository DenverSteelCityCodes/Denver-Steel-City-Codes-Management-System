import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolveField, type FieldConfig, type FormKey, type ResolvedField } from '../lib/formFields'

// Read-side of the admin Form editor for the public forms: field(key) gives the label to show,
// whether to render the field at all, and whether to require it.
export function useFormConfig(formKey: FormKey) {
  const [overrides, setOverrides] = useState<Record<string, FieldConfig> | undefined>(undefined)
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('form_configs')
      .select('config')
      .eq('form_key', formKey)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const config = data?.config as { enabled?: boolean; fields?: Record<string, FieldConfig> } | undefined
        setOverrides(config?.fields ?? {})
        setEnabled(config?.enabled !== false)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [formKey])

  function field(key: string): ResolvedField {
    return resolveField(formKey, key, overrides)
  }

  return { field, enabled, loading }
}
