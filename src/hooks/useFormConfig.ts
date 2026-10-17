import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolveField, type FieldConfig, type FormKey, type ResolvedField } from '../lib/formFields'

// Read-side of the admin Form editor for the public forms: field(key) gives the label to show,
// whether to render the field at all, and whether to require it.
export function useFormConfig(formKey: FormKey) {
  const [overrides, setOverrides] = useState<Record<string, FieldConfig> | undefined>(undefined)
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('form_configs')
      .select('config')
      .eq('form_key', formKey)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        // Couldn't read the switch: don't present the form as open. (The database also refuses
        // registrations while the form is closed.)
        if (error) { setOverrides({}); setEnabled(false); setLoadError(error.message); setLoading(false); return }
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

  return { field, enabled, loading, loadError }
}
