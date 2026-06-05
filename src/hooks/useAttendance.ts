import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AttendanceAction } from '../types/database'

export interface AttendanceLog {
  id: string
  student_id: string
  class_id: string
  action: AttendanceAction
  timestamp: string
}

export function useAttendance(classId: string | undefined) {
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!classId) { setLoading(false); return }
    fetchLogs()
  }, [classId])

  async function fetchLogs() {
    setLoading(true)

    // Only today's logs
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('class_id', classId!)
      .gte('timestamp', todayStart.toISOString())
      .order('timestamp', { ascending: false })

    setLogs((data ?? []) as AttendanceLog[])
    setLoading(false)
  }

  // Returns the latest action for a student today
  function getStatus(studentId: string): AttendanceAction | null {
    return logs.find(l => l.student_id === studentId)?.action ?? null
  }

  async function logAction(studentId: string, classId: string, action: AttendanceAction) {
    // Optimistic update
    const optimistic: AttendanceLog = {
      id: crypto.randomUUID(),
      student_id: studentId,
      class_id: classId,
      action,
      timestamp: new Date().toISOString(),
    }
    setLogs(prev => [optimistic, ...prev.filter(l => l.student_id !== studentId)])

    const { error } = await supabase
      .from('attendance_logs')
      .insert({ student_id: studentId, class_id: classId, action })

    if (error) {
      // Rollback optimistic update
      setLogs(prev => prev.filter(l => l.id !== optimistic.id))
      throw new Error(error.message)
    }
  }

  return { logs, loading, getStatus, logAction }
}
