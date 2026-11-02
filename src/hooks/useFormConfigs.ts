import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { keepLastGood } from '../lib/readResult'

import { FORM_DEFINITIONS, cleanOptions, type FieldConfig, type FormKey } from '../lib/formFields'
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
  // Set when the last read failed; `configs` then still holds the last good copy.
  const [error, setError] = useState<string | null>(null)

  // Writes replace the whole config JSON, so two edits built from the same on-screen copy would
  // overwrite each other. Each write waits for the one before it and merges into a fresh read.
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => { fetchConfigs() }, [])

  // No loading flag on refetch: flipping it would unmount the editor rows and drop a half-typed label.
  // Resolves false when the read failed.
  async function fetchConfigs(): Promise<boolean> {
    const read = await supabase.from('form_configs').select('*').order('form_key')
    setConfigs(prev => keepLastGood<FormConfigRow[]>(prev, read, []).value)
    setError(read.error?.message ?? null)
    setLoading(false)
    return !read.error
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

  // Save a choice question's whole list (the Form editor checks it first). A list that matches the
  // default is stored as no list, so a later change to the default in code still reaches it.
  function saveOptions(formKey: FormKey, fieldKey: string, list: string[]) {
    const def = FORM_DEFINITIONS[formKey].fields.find(f => f.key === fieldKey)
    if (!def?.options) return Promise.reject(new Error(`"${fieldKey}" has no choices`))
    const next = cleanOptions(list, def.other)
    if (!next.some(o => o !== def.other)) return Promise.reject(new Error('A question needs at least one choice'))
    const isDefault = next.join('\n') === cleanOptions(def.options, def.other).join('\n')
    return write(formKey, c => ({ ...c, fields: { ...c.fields, [fieldKey]: { ...c.fields[fieldKey], options: isDefault ? undefined : next } } }))
  }

  return { configs, loading, error, setFormEnabled, updateField, saveOptions, refetch: fetchConfigs }
}

// Where each choice question's answer is saved, so removing a choice can say how many people gave it.
const ANSWER_COLUMNS: Record<string, { table: string; column: string; list?: boolean }> = {
  'student_registration.school_district': { table: 'students', column: 'school_district' },
  'student_registration.shirt_size': { table: 'students', column: 'shirt_size' },
  'student_registration.ethnic_background': { table: 'students', column: 'ethnic_background', list: true },
  'student_registration.how_heard': { table: 'students', column: 'how_heard' },
  'volunteer_application.school': { table: 'volunteer_applications', column: 'school' },
  'volunteer_application.shirtSize': { table: 'volunteer_applications', column: 'shirt_size' },
  'volunteer_application.csLanguages': { table: 'volunteer_applications', column: 'cs_languages', list: true },
}

// How many saved records gave this choice (any year); null when it couldn't be counted.
export async function countChoiceUses(formKey: FormKey, fieldKey: string, choice: string): Promise<number | null> {
  const where = ANSWER_COLUMNS[`${formKey}.${fieldKey}`]
  if (!where) return null
  const query = supabase.from(where.table).select('id', { count: 'exact', head: true })
  const { count, error } = await (where.list ? query.contains(where.column, [choice]) : query.eq(where.column, choice))
  return error ? null : count ?? 0
}
