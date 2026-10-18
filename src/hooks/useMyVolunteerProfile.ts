import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export const PHOTO_BUCKET = 'volunteer-photos'

export interface MyVolunteerProfile {
  legal_name: string | null
  preferred_name: string | null
  pronunciation: string | null
  bio: string | null
  photo_path: string | null
  photo_consent_at: string | null
  photo_guardian_name: string | null
  photo_guardian_consent_at: string | null
  // Under 18 by their application (or unknown): a photo needs a guardian's consent too.
  needs_guardian: boolean
  // Parents can see the photo now (the database's rule).
  photo_visible: boolean
}

export interface ProfileInput {
  legal_name: string
  preferred_name: string
  pronunciation: string
  bio: string
  photo_consent: boolean
  guardian_name: string
}

// A phone photo is several megabytes; parents see it at about 100px. Shrink it to 800px JPEG in
// the browser before it uploads (the bucket takes up to 2 MB).
async function shrink(file: File, max = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), 'image/jpeg', 0.85))
}

async function fetchProfile() {
  const { data, error } = await supabase.rpc('my_volunteer_profile').maybeSingle()
  const profile = (data as MyVolunteerProfile | null) ?? null
  let photoUrl: string | null = null
  if (profile?.photo_path) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(profile.photo_path, 3600)
    photoUrl = signed?.signedUrl ?? null
  }
  return { profile, photoUrl, error: error?.message ?? null }
}

// The signed-in volunteer's profile (spec 35): names, pronunciation, bio and an opt-in photo in a
// private bucket, shown to the volunteer through a short-lived signed URL.
export function useMyVolunteerProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<MyVolunteerProfile | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((x: Awaited<ReturnType<typeof fetchProfile>>) => {
    setError(x.error)
    if (!x.error) { setProfile(x.profile); setPhotoUrl(x.photoUrl) }
    setLoading(false)
  }, [])
  const load = useCallback(async () => apply(await fetchProfile()), [apply])

  useEffect(() => {
    if (!user) return
    let alive = true
    void fetchProfile().then(x => { if (alive) apply(x) })
    return () => { alive = false }
  }, [user, apply])

  // photo: a File to upload, null to remove the photo, undefined to keep it.
  async function save(input: ProfileInput, photo?: File | null) {
    if (!user || !profile) return
    let path = profile.photo_path
    if (photo) {
      const blob = await shrink(photo)
      const next = `${user.id}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(next, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw new Error(`Couldn't upload the photo: ${error.message}`)
      path = next
    } else if (photo === null) path = null

    const { error } = await supabase.rpc('update_my_volunteer_profile', {
      p_legal_name: input.legal_name, p_preferred_name: input.preferred_name, p_pronunciation: input.pronunciation,
      p_bio: input.bio, p_photo_path: path, p_photo_consent: input.photo_consent, p_guardian_name: input.guardian_name,
    })
    if (error) {
      // Don't leave a new upload behind when the save didn't take it.
      if (path && path !== profile.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([path])
      throw new Error(error.message)
    }
    // The old file goes once nothing points at it.
    if (profile.photo_path && profile.photo_path !== path) await supabase.storage.from(PHOTO_BUCKET).remove([profile.photo_path])
    await load()
  }

  return { profile, photoUrl, loading, error, save }
}
