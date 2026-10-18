import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'
import { useParentProfile } from '../hooks/useParentProfile'
import { useAuth } from '../context/AuthContext'

// "You" on Family details (spec 11): the contact the camp uses for every camper on this account.
// Read-only first, with an inline Edit.
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

  if (loading) return <div className="h-40 bg-surface-sunken rounded-[14px] animate-pulse mt-7" />
  // 16px so iOS Safari doesn't zoom the page when the field is focused.
  const input = 'ui-input'
  const label = 'block font-sans text-sm font-semibold text-ink-muted mb-1'
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const ec = profile?.emergency_contact_name

  return (
    <section aria-labelledby="contact-heading" className="mt-7">
      <header className="flex items-center justify-between gap-3 mb-2">
        <h2 id="contact-heading" className="font-sans font-bold text-lg text-ink">You</h2>
        {!editing && (
          <button type="button" onClick={startEditing} className="h-11 px-3 font-sans font-semibold text-[15px] text-ink-muted rounded-[10px] hover:bg-surface-sunken hover:text-ink flex items-center gap-1.5 transition">
            <Pencil size={15} /> Edit
          </button>
        )}
      </header>
      {!editing ? (
        <>
          <dl className="bg-surface border border-border rounded-[14px] p-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 font-sans text-base">
            <dt className="text-ink-muted">Name</dt><dd className="text-ink font-semibold">{account?.display_name ?? '—'}</dd>
            <dt className="text-ink-muted">Email</dt><dd className="text-ink font-semibold break-words min-w-0">{profile?.email ?? user?.email ?? '—'}</dd>
            <dt className="text-ink-muted">Phone</dt><dd className="text-ink font-semibold">{profile?.phone || 'Not added yet'}</dd>
            <dt className="text-ink-muted">Emergency</dt>
            <dd className="text-ink font-semibold">
              {ec ? <>{ec}{profile?.emergency_contact_relation ? ` (${profile.emergency_contact_relation})` : ''}{profile?.emergency_contact_phone && <><br />{profile.emergency_contact_phone}</>}</> : 'Not added yet'}
            </dd>
          </dl>
          {saved && <p role="status" className="mt-2.5 font-sans text-[15px] font-semibold text-success flex items-center gap-1.5"><Check size={16} /> Saved</p>}
        </>
      ) : (
        <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} className="bg-surface border border-border rounded-[14px] p-4 space-y-3.5">
          <div><label htmlFor="cd-email" className={label}>Email</label><input id="cd-email" type="email" autoComplete="email" className={input} value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label htmlFor="cd-phone" className={label}>Phone</label><input id="cd-phone" type="tel" autoComplete="tel" className={input} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label htmlFor="cd-ec-name" className={label}>Emergency contact</label><input id="cd-ec-name" className={input} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="cd-ec-phone" className={label}>Their phone</label><input id="cd-ec-phone" type="tel" className={input} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
            <div><label htmlFor="cd-ec-rel" className={label}>Relationship</label><input id="cd-ec-rel" className={input} value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} /></div>
          </div>
          <p className="font-sans text-sm text-ink-muted">New registrations start with these. Each camper keeps their own emergency contact below.</p>
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="h-11 px-4 rounded-[10px] border border-border-strong bg-surface font-sans font-semibold text-[15px] text-ink hover:bg-surface-sunken transition">Cancel</button>
            <button type="submit" disabled={saving} className="ui-btn ui-btn--primary">
              <Check size={16} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
