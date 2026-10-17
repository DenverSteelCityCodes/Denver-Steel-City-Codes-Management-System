import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Class, Section } from '../types/database'
import { fetchSectionFill } from '../lib/sectionFill'

export interface SectionWithCount extends Section {
  registered_count: number   // confirmed + pending
  waitlist_count: number
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

    const [{ data, error }, fill] = await Promise.all([
      supabase.from('classes').select(`*, sections(*)`).order('name', { ascending: true }),
      fetchSectionFill().catch(() => new Map()),
    ])

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as (Class & { sections: Section[] | null })[]
    const shaped: ClassWithSections[] = rows.map(c => ({
      ...c,
      sections: (c.sections ?? []).map(s => ({
        ...s,
        registered_count: fill.get(s.id)?.active ?? 0,
        waitlist_count: fill.get(s.id)?.waitlist ?? 0,
      })),
    }))

    setClasses(shaped)
    setLoading(false)
  }

  return { classes, loading, error, refetch: fetchClasses }
}
