import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'
import { useParentProfile } from '../hooks/useParentProfile'
import { useAuth } from '../context/AuthContext'
import { buttonClass } from '../lib/ui'
import { ErrorLine, h2Cls, labelCls } from '../pages/parent/parts'

// "You" on Family details (spec 11): the contact the camp uses for every camper on this account.
// Read-only first, with an inline Edit. The facts sit on the floor between 2px ink rules (no card).
export default function ContactDetailsCard() {
  const { user, profile: account } = useAuth()
  const { profile, loading, saveProfile } = useParentProfile()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ email: '', phone: '', emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function startEditing() {
    setForm({
      email: profile?.email ?? user?.email ?? '',
      phone: profile?.phone ?? '',
      emergency_contact_name: profile?.emergency_contact_name ?? '',
      emergency_contact_phone: profile?.emergency_contact_phone ?? '',
      emergency_contact_relation: profile?.emergency_contact_relation ?? '',
    })
    setErr(null)
    setSaved(false)
    setEditing(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.phone.trim()) { setErr('An email and a phone number are required.'); return }
    if (!form.emergency_contact_name.trim() || !form.emergency_contact_phone.trim()) { setErr('An emergency contact name and phone are required.'); return }
    setSaving(true); setErr(null)
    try {
      await saveProfile({
        email: form.email.trim(), phone: form.phone.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        emergency_contact_relation: form.emergency_contact_relation.trim() || null,
      })
      setEditing(false)
      setSaved(true)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-40 bg-surface-sunken rounded animate-pulse mt-10" />
  // 16px so iOS Safari doesn't zoom the page when the field is focused.
  const input = 'ui-input'
  const label = labelCls
  const dt = 'text-sm text-ink-muted pt-0.5'
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const ec = profile?.emergency_contact_name

  return (
    <section aria-labelledby="contact-heading" className="mt-10">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="contact-heading" className={h2Cls}>You</h2>
        {!editing && (
          <button type="button" onClick={startEditing} className={buttonClass('text', 'gap-1.5')}>
            <Pencil size={16} strokeWidth={2.5} aria-hidden="true" /> Edit<span className="sr-only"> your contact details</span>
          </button>
        )}
      </header>
      {!editing ? (
        <>
          <dl className="border-y-2 border-ink py-3 grid grid-cols-[fit-content(8.5rem)_1fr] gap-x-4 gap-y-1.5">
            <dt className={dt}>Name</dt><dd className="font-bold min-w-0 break-words">{account?.display_name ?? '—'}</dd>
            <dt className={dt}>Email</dt><dd className="font-bold break-words min-w-0">{profile?.email ?? user?.email ?? '—'}</dd>
            <dt className={dt}>Phone</dt><dd className="font-bold">{profile?.phone || 'Not added yet'}</dd>
            <dt className={dt}>Emergency</dt>
            <dd className="font-bold min-w-0 break-words">
              {ec ? <>{ec}{profile?.emergency_contact_relation ? ` (${profile.emergency_contact_relation})` : ''}{profile?.emergency_contact_phone && <><br />{profile.emergency_contact_phone}</>}</> : 'Not added yet'}
            </dd>
          </dl>
          {saved && <p role="status" className="mt-2.5 text-sm font-bold text-success flex items-center gap-1.5"><Check size={16} strokeWidth={2.5} aria-hidden="true" /> Saved</p>}
        </>
      ) : (
        <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} className="border-y-2 border-ink py-4 space-y-5">
          <div><label htmlFor="cd-email" className={label}>Email</label><input id="cd-email" type="email" autoComplete="email" className={input} value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label htmlFor="cd-phone" className={label}>Phone</label><input id="cd-phone" type="tel" autoComplete="tel" className={input} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label htmlFor="cd-ec-name" className={label}>Emergency contact</label><input id="cd-ec-name" className={input} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
          <div className="grid min-[480px]:grid-cols-2 gap-x-4 gap-y-5">
            <div><label htmlFor="cd-ec-phone" className={label}>Their phone</label><input id="cd-ec-phone" type="tel" className={input} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
            <div><label htmlFor="cd-ec-rel" className={label}>Relationship</label><input id="cd-ec-rel" className={input} value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} /></div>
          </div>
          <p className="text-sm text-ink-muted text-pretty">New registrations start with these. Each camper keeps their own emergency contact below.</p>
          {err && <ErrorLine>{err}</ErrorLine>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(false)} className={buttonClass('secondary')}>Cancel</button>
            <button type="submit" disabled={saving} className={buttonClass('primary')}>
              <Check size={20} strokeWidth={2.5} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
