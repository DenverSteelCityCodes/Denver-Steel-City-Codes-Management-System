import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Class } from '../types/database'

export interface ClassWithCount extends Class {
  registered_count: number
}

export function useClasses() {
  const [classes, setClasses] = useState<ClassWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClasses()
  }, [])

  async function fetchClasses() {
    setLoading(true)

    // Fetch classes and confirmed/pending registration counts in one query
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        registrations(count)
      `)
      .in('registrations.status', ['confirmed', 'pending'])
      .order('name', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const withCounts: ClassWithCount[] = (data ?? []).map((c: Class & { registrations: { count: number }[] }) => ({
      ...c,
      registered_count: c.registrations?.[0]?.count ?? 0,
    }))

    setClasses(withCounts)
    setLoading(false)
  }

  return { classes, loading, error, refetch: fetchClasses }
}
