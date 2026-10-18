import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PHOTO_BUCKET } from './useMyVolunteerProfile'

// One crew member in one section, as meet_the_crew() returns it (spec 35): preferred name,
// pronunciation, bio, and a photo path only when the photo may be shown.
export interface CrewRow {
  session_id: string | null
  session_name: string | null
  week: number | null
  start_date: string | null
  end_date: string | null
  section_id: string
  class_name: string
  section_label: string
  room: string | null
  my_campers: string | null
  volunteer_id: string
  crew_role: 'lead' | 'support'
  name: string
  pronunciation: string | null
  bio: string | null
  photo_path: string | null
}

// The crew of every week the parent has a seated camper in, with short-lived signed photo URLs
// (the bucket is private; the storage policy lets a parent read only these photos).
export function useMeetTheCrew() {
  const [rows, setRows] = useState<CrewRow[] | null>(null)
  const [photos, setPhotos] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data, error } = await supabase.rpc('meet_the_crew')
      if (!alive) return
      if (error) { setError(error.message); setRows([]); return }
      const list = (data ?? []) as CrewRow[]
      setRows(list)
      const paths = [...new Set(list.map(r => r.photo_path).filter((p): p is string => !!p))]
      if (paths.length === 0) return
      const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600)
      if (!alive) return
      setPhotos(new Map((signed ?? []).flatMap(s => (s.signedUrl && s.path ? [[s.path, s.signedUrl] as [string, string]] : []))))
    })()
    return () => { alive = false }
  }, [])

  return { rows, photos, error }
}
