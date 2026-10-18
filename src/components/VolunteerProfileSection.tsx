import { useEffect, useId, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, ImageUp, UserRound } from 'lucide-react'
import { useMyVolunteerProfile, type ProfileInput } from '../hooks/useMyVolunteerProfile'
import { BIO_MAX, bioProblem, photoStatus } from '../lib/onboarding'

// The volunteer's profile (spec 35) on My profile: legal and preferred name, pronunciation, a
// 300-character bio and an opt-in photo. Read-only first with an inline Edit, like Availability.
// Parents see the preferred name, pronunciation, bio and a consented photo on Meet the teachers;
// the legal name is only for letters and certificates.
const h2 = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-ink'
const label = 'block font-bold text-ink mb-1.5'
const hint = 'text-sm text-ink-muted text-pretty'
const optional = <span className="font-normal text-ink-muted"> (optional)</span>

function Photo({ url, size = 'w-24 h-24' }: { url: string | null; size?: string }) {
  return url
    ? <img src={url} alt="Your photo" className={`${size} rounded object-cover border border-border bg-surface`} />
    : <span aria-hidden="true" className={`${size} rounded grid place-items-center bg-shell text-on-shell`}><UserRound size={32} strokeWidth={2.25} /></span>
}

export default function VolunteerProfileSection() {
  const { profile, photoUrl, loading, error, save } = useMyVolunteerProfile()
  const [form, setForm] = useState<ProfileInput | null>(null)
  // undefined: keep the photo; null: remove it; a File: replace it.
  const [photo, setPhoto] = useState<File | null | undefined>(undefined)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const id = useId()

  // A chosen file previews before it's saved; its object URL is freed when replaced or on leaving.
  const previewRef = useRef<string | null>(null)
  function showPreview(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)
  }
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  if (loading) return <div className="h-40 bg-surface-sunken rounded animate-pulse" />
  if (!profile) {
    return error
      ? <p role="alert" title={error} className="font-bold text-danger">Couldn't load your profile. Check your connection and reload the page.</p>
      : null
  }

  const filled = !!(profile.preferred_name || profile.legal_name || profile.bio)
  const shownPhoto = photo === null ? null : photo instanceof File ? preview : photoUrl
  const hasPhoto = photo === null ? false : photo instanceof File || !!profile.photo_path
  const bioErr = form ? bioProblem(form.bio) : null

  function start() {
    setForm({
      legal_name: profile!.legal_name ?? '', preferred_name: profile!.preferred_name ?? '', pronunciation: profile!.pronunciation ?? '',
      bio: profile!.bio ?? '', photo_consent: !!profile!.photo_consent_at, guardian_name: profile!.photo_guardian_name ?? '',
    })
    setPhoto(undefined); setErr(null); setSaved(false)
  }
  const set = (patch: Partial<ProfileInput>) => { setErr(null); setForm(f => (f ? { ...f, ...patch } : f)) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (bioErr) { document.getElementById(`${id}-bio`)?.focus(); return }
    setBusy(true); setErr(null)
    try {
      await save(form, photo)
      setForm(null); setPhoto(undefined); setSaved(true)
    } catch (e) {
      setErr(`Couldn't save your profile. ${e instanceof Error ? e.message : ''} Check your connection and try again.`.replace(/\s+/g, ' '))
      requestAnimationFrame(() => document.getElementById(`${id}-err`)?.focus())
    } finally { setBusy(false) }
  }

  const status = photoStatus({ hasPhoto: !!profile.photo_path, consent: !!profile.photo_consent_at, needsGuardian: profile.needs_guardian, guardianName: profile.photo_guardian_name ?? '' })

  return (
    <section aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id={`${id}-h`} className={h2}>Your volunteer profile</h2>
        {!form && filled && (
          <button type="button" onClick={start} className="ui-btn ui-btn--text">Edit<span className="sr-only"> your volunteer profile</span></button>
        )}
      </div>
      <p className="text-ink-muted text-pretty">
        Parents of campers in your weeks see your preferred name, how to say it, your bio and, if you agree, your photo. Your legal name is only for the camp's letters and certificates.
      </p>

      {!form ? (
        filled ? (
          <>
            <div className="mt-3 py-3 border-y border-border flex flex-wrap items-start gap-4">
              <Photo url={photoUrl} />
              <dl className="flex-1 min-w-[min(100%,14rem)] grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2">
                <dt className="text-ink-muted">Goes by</dt><dd className="font-bold text-ink break-words">{profile.preferred_name || <span className="font-normal text-ink-muted">Not set</span>}</dd>
                <dt className="text-ink-muted">Say it</dt><dd className="font-bold text-ink break-words">{profile.pronunciation || <span className="font-normal text-ink-muted">Not set</span>}</dd>
                <dt className="text-ink-muted">Legal name</dt><dd className="font-bold text-ink break-words">{profile.legal_name || <span className="font-normal text-ink-muted">Not set</span>}</dd>
              </dl>
            </div>
            {profile.bio && <p className="mt-3 max-w-[65ch] text-pretty whitespace-pre-line">{profile.bio}</p>}
            {status && <p className="mt-2 text-sm text-ink-muted text-pretty">{status}</p>}
          </>
        ) : (
          <div className="mt-3">
            <p className="font-bold">Not filled in yet.</p>
            <button type="button" onClick={start} className="ui-btn ui-btn--ink mt-3">Fill in your profile</button>
          </div>
        )
      ) : (
        <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') setForm(null) }} className="mt-4 max-w-[640px]" noValidate>
          <div className="grid gap-4 min-[480px]:grid-cols-2">
            <div>
              <label htmlFor={`${id}-pref`} className={label}>Preferred name</label>
              <input id={`${id}-pref`} className="ui-input" value={form.preferred_name} maxLength={60} autoComplete="nickname"
                onChange={e => set({ preferred_name: e.target.value })} aria-describedby={`${id}-pref-hint`} />
              <p id={`${id}-pref-hint`} className={`${hint} mt-1`}>What campers and parents call you.</p>
            </div>
            <div>
              <label htmlFor={`${id}-say`} className={label}>How to say it{optional}</label>
              <input id={`${id}-say`} className="ui-input" value={form.pronunciation} maxLength={80} placeholder="oh-KAH-for"
                onChange={e => set({ pronunciation: e.target.value })} />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor={`${id}-legal`} className={label}>Legal name</label>
            <input id={`${id}-legal`} className="ui-input" value={form.legal_name} maxLength={100} autoComplete="name"
              onChange={e => set({ legal_name: e.target.value })} aria-describedby={`${id}-legal-hint`} />
            <p id={`${id}-legal-hint`} className={`${hint} mt-1`}>For your service-hours letter and certificate. Parents don't see it.</p>
          </div>
          <div className="mt-4">
            <label htmlFor={`${id}-bio`} className={label}>Short bio{optional}</label>
            <textarea id={`${id}-bio`} className="ui-input min-h-28 resize-y" rows={4} value={form.bio}
              onChange={e => set({ bio: e.target.value })} aria-invalid={!!bioErr || undefined}
              aria-describedby={`${id}-bio-count${bioErr ? ` ${id}-bio-err` : ''}`}
              placeholder="A sentence or two: what you like to code, your school, a fun fact." />
            <p id={`${id}-bio-count`} className={`${hint} mt-1 tabular-nums`}>{form.bio.trim().length} of {BIO_MAX} characters</p>
            {bioErr && <p id={`${id}-bio-err`} role="alert" className="mt-1 flex items-start gap-1.5 text-sm font-bold text-danger"><CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{bioErr}</p>}
          </div>

          <fieldset className="mt-6">
            <legend className={label}>Photo{optional}</legend>
            <div className="flex flex-wrap items-center gap-4">
              <Photo url={shownPhoto} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="ui-btn ui-btn--secondary cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
                  <ImageUp size={18} strokeWidth={2.5} aria-hidden="true" /> {hasPhoto ? 'Choose another photo' : 'Choose a photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setPhoto(f); showPreview(URL.createObjectURL(f)); setErr(null) } e.target.value = '' }} />
                </label>
                {hasPhoto && (
                  <button type="button" onClick={() => { setPhoto(null); showPreview(null) }} className="ui-btn ui-btn--text text-ink-muted">Remove photo</button>
                )}
              </div>
            </div>
            <label className="mt-4 flex items-start gap-3 min-h-[52px] px-4 py-3 bg-surface border-2 border-border has-[:checked]:border-ink rounded text-ink cursor-pointer">
              <input type="checkbox" className="w-[22px] h-[22px] mt-0.5 shrink-0" checked={form.photo_consent}
                onChange={e => set({ photo_consent: e.target.checked })} />
              <span><b className="font-bold">Parents of campers in my weeks may see my photo.</b> <span className="text-ink-muted">Untick this any time and it's hidden.</span></span>
            </label>
            {form.photo_consent && profile.needs_guardian && (
              <div className="mt-4">
                <label htmlFor={`${id}-guardian`} className={label}>Parent or guardian who agrees</label>
                <input id={`${id}-guardian`} className="ui-input" value={form.guardian_name} maxLength={100} autoComplete="off"
                  onChange={e => set({ guardian_name: e.target.value })} aria-describedby={`${id}-guardian-hint`} />
                <p id={`${id}-guardian-hint`} className={`${hint} mt-1`}>You're under 18, so a parent or guardian has to agree too. Typing their full name says they do. Until then, parents don't see your photo.</p>
              </div>
            )}
          </fieldset>

          {err && (
            <p id={`${id}-err`} tabIndex={-1} role="alert" className="mt-4 flex items-start gap-1.5 text-sm font-bold text-danger focus:outline-none">
              <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{err}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5">
            <button type="submit" disabled={busy} aria-busy={busy} className="ui-btn ui-btn--ink">{busy ? 'Saving…' : 'Save profile'}</button>
            <button type="button" onClick={() => { setForm(null); setPhoto(undefined); setErr(null) }} className="ui-btn ui-btn--text text-ink-muted">Cancel</button>
          </div>
        </form>
      )}
      {saved && !form && (
        <p role="status" className="mt-3 flex items-start gap-1.5 font-bold text-success">
          <CircleCheck size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />Profile saved
        </p>
      )}
    </section>
  )
}
