import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Class, Section } from '../types/database'

export interface SectionWithCount extends Section {
  registered_count: number
}

export interface ClassWithSections extends Class {
  sections: SectionWithCount[]
}

export function useClasses() {
  const [classes, setClasses] = useState<ClassWithSections[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClasses()
  }, [])

  async function fetchClasses() {
    setLoading(true)

    const { data, error } = await supabase
      .from('classes')
      .select(`*, sections(*, registrations(count))`)
      .order('name', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const shaped: ClassWithSections[] = (data ?? []).map((c: any) => ({
      ...c,
      sections: (c.sections ?? []).map((s: any) => ({
        ...s,
        registered_count: s.registrations?.[0]?.count ?? 0,
      })),
    }))

    setClasses(shaped)
    setLoading(false)
  }

  return { classes, loading, error, refetch: fetchClasses }
}
