import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AttendanceAction } from '../types/database'

export interface AttendanceLog {
  id: string
  student_id: string
  section_id: string
  action: AttendanceAction
  timestamp: string
}

export function useAttendance(sectionId: string | undefined) {
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sectionId) { setLoading(false); return }
    fetchLogs()
  }, [sectionId])

  async function fetchLogs() {
    setLoading(true)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('section_id', sectionId!)
      .gte('timestamp', todayStart.toISOString())
      .order('timestamp', { ascending: false })

    setLogs((data ?? []) as AttendanceLog[])
    setLoading(false)
  }

  function getStatus(studentId: string): AttendanceAction | null {
    return logs.find(l => l.student_id === studentId)?.action ?? null
  }

  async function logAction(studentId: string, sectionId: string, action: AttendanceAction) {
    const optimistic: AttendanceLog = {
      id: crypto.randomUUID(),
      student_id: studentId,
      section_id: sectionId,
      action,
      timestamp: new Date().toISOString(),
    }
    setLogs(prev => [optimistic, ...prev.filter(l => l.student_id !== studentId)])

    const { error } = await supabase
      .from('attendance_logs')
      .insert({ student_id: studentId, section_id: sectionId, action })

    if (error) {
      setLogs(prev => prev.filter(l => l.id !== optimistic.id))
      throw new Error(error.message)
    }
  }

  return { logs, loading, getStatus, logAction }
}
