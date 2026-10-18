import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A volunteer's own week availability and course choices (spec 25, decided Q-V1: preferences only,
// admins assign). Read and written through RPCs; volunteers have no UPDATE on `volunteers`.
export interface VolunteerPrefs {
  availability_week_1: boolean
  availability_week_2: boolean
  course_first_choice: string | null
  course_second_choice: string | null
}

export function useVolunteerPrefs() {
  const [prefs, setPrefs] = useState<VolunteerPrefs | null>(null)
  const [courses, setCourses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void Promise.all([supabase.rpc('my_volunteer_prefs'), supabase.rpc('course_names')]).then(([p, c]) => {
      if (!alive) return
      setError(p.error?.message ?? null)
      setPrefs(((p.data ?? []) as VolunteerPrefs[])[0] ?? null)
      setCourses((c.data ?? []) as string[])
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  async function save(next: VolunteerPrefs) {
    const { error } = await supabase.rpc('update_my_volunteer_prefs', {
      p_week1: next.availability_week_1, p_week2: next.availability_week_2,
      p_first: next.course_first_choice ?? '', p_second: next.course_second_choice ?? '',
    })
    if (error) throw new Error(error.message)
    setPrefs(next)
  }

  return { prefs, courses, loading, error, save }
}

// "Week 1 and Week 2" / "Week 2" / "No weeks yet"
export function weeksLabel(p: Pick<VolunteerPrefs, 'availability_week_1' | 'availability_week_2'>): string {
  const weeks = [p.availability_week_1 && 'Week 1', p.availability_week_2 && 'Week 2'].filter(Boolean)
  return weeks.length ? weeks.join(' and ') : 'No weeks yet'
}
