import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Student, OnboardingConfirmation } from '../types/database'
import { gradeToAge } from '../lib/campers'
import { guardedUpdate, EditConflictError } from '../lib/editConflict'

// The confirmation panel edits a single full-name field, but CamperEditor rebuilds full_name from
// first_name/last_name — so a corrected name must update those too or the next edit reverts it.
// Keep whichever part is unchanged; otherwise split at the first space (CamperEditor's fallback).
function splitName(fullName: string, prev: Student | undefined): { first_name: string; last_name: string } {
  const name = fullName.trim().replace(/\s+/g, ' ')
  const first = prev?.first_name?.trim()
  const last = prev?.last_name?.trim()
  if (first && last && name === `${first} ${last}`) return { first_name: first, last_name: last }
  if (first && name.startsWith(`${first} `)) return { first_name: first, last_name: name.slice(first.length + 1) }
  if (last && name.endsWith(` ${last}`)) return { first_name: name.slice(0, -last.length - 1), last_name: last }
  const [head, ...rest] = name.split(' ')
  return { first_name: head ?? '', last_name: rest.join(' ') }
}

export function useStudents() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchStudents()
  }, [user])

  async function fetchStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', user!.id)
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setStudents(data ?? [])
    setLoading(false)
  }


  // Refuses to overwrite a change someone else (e.g. an admin) saved since this list loaded. On a
  // conflict the latest version replaces ours in state, so saving again deliberately replaces it.
  async function save(id: string, payload: Record<string, unknown>): Promise<Student> {
    const original = students.find(s => s.id === id)
    try {
      const data = original
        ? await guardedUpdate<Student & Record<string, unknown>>('students', original as unknown as { id: string } & Record<string, unknown>, payload)
        : await supabase.from('students').update(payload).eq('id', id).select().single()
            .then(({ data, error }) => { if (error) throw new Error(error.message); return data as Student & Record<string, unknown> })
      setStudents(prev => prev.map(s => (s.id === id ? data : s)))
      return data
    } catch (e) {
      if (e instanceof EditConflictError && e.latest) {
        const latest = e.latest as unknown as Student
        setStudents(prev => prev.map(s => (s.id === id ? latest : s)))
      }
      throw e
    }
  }

  async function updateStudent(id: string, payload: Partial<Omit<Student, 'id' | 'parent_id' | 'created_at'>>) {
    return save(id, payload as Record<string, unknown>)
  }

  // Per-summer re-confirmation (#42): persist the reviewed/edited onboarding fields, re-sign the
  // waiver, and stamp registration_year to the active camp year — which is what unlocks session
  // registration for that year. Also mirrors medical_conditions into the legacy medical_info column.
  async function confirmOnboarding(id: string, fields: OnboardingConfirmation, campYear: number) {
    return save(id, {
      ...fields,
      ...(fields.full_name ? splitName(fields.full_name, students.find(s => s.id === id)) : {}),
      // Grade moves up each summer; age drives section eligibility, so keep them in step.
      ...(gradeToAge(fields.grade) ? { age: gradeToAge(fields.grade) } : {}),
      medical_info: fields.medical_conditions ?? null,
      registration_year: campYear,
      waiver_signed_at: new Date().toISOString(),
    })
  }

  return { students, loading, error, updateStudent, confirmOnboarding, refetch: fetchStudents }
}
