import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface AdminStats {
  totalStudents: number
  totalClasses: number
  totalVolunteers: number
  confirmedRegistrations: number
  waitlistedRegistrations: number
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    setLoading(true)

    const [students, classes, volunteers, confirmed, waitlisted] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('volunteers').select('id', { count: 'exact', head: true }),
      supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'waitlisted'),
    ])

    setStats({
      totalStudents: students.count ?? 0,
      totalClasses: classes.count ?? 0,
      totalVolunteers: volunteers.count ?? 0,
      confirmedRegistrations: confirmed.count ?? 0,
      waitlistedRegistrations: waitlisted.count ?? 0,
    })
    setLoading(false)
  }

  return { stats, loading, refetch: fetchStats }
}
