import { useState } from 'react'
import { Pencil, Check, Phone } from 'lucide-react'
import { useParentProfile } from '../hooks/useParentProfile'
import { useAuth } from '../context/AuthContext'

// "Your contact details" on the parent dashboard (spec 11): the contact the camp uses for every
// camper on this account, editable inline any time.
export default function ContactDetailsCard() {
  const { user } = useAuth()
  const { profile, loading, saveProfile } = useParentProfile()
  const [editing, setEditing] = useState(false)
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
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null
  const input = 'ui-input'
  const label = 'block font-sans text-xs font-semibold text-ink-muted mb-1'
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <section aria-labelledby="contact-heading" className="bg-surface border border-border rounded-xl shadow-sm px-4 sm:px-5 py-4 mb-8">
      <div className="flex items-start justify-between gap-3">
        <h2 id="contact-heading" className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted flex items-center gap-1.5">
          <Phone size={13} /> Your contact details
        </h2>
        {!editing && (
          <button type="button" onClick={startEditing} className="h-9 px-3 text-sm font-sans font-semibold text-ink-muted rounded-[8px] hover:bg-surface-sunken hover:text-ink flex items-center gap-1.5 transition">
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>
      {!editing ? (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-sans text-sm">
          <dt className="text-ink-muted">Email</dt><dd className="text-ink break-words">{profile?.email ?? user?.email ?? '—'}</dd>
          <dt className="text-ink-muted">Phone</dt><dd className="text-ink">{profile?.phone || '—'}</dd>
          <dt className="text-ink-muted">Emergency contact</dt>
          <dd className="text-ink">
            {profile?.emergency_contact_name
              ? `${profile.emergency_contact_name}${profile.emergency_contact_relation ? ` (${profile.emergency_contact_relation})` : ''}${profile.emergency_contact_phone ? ` · ${profile.emergency_contact_phone}` : ''}`
              : 'Not added yet'}
          </dd>
        </dl>
      ) : (
        <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="cd-email" className={label}>Email</label><input id="cd-email" type="email" autoComplete="email" className={input} value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label htmlFor="cd-phone" className={label}>Phone</label><input id="cd-phone" type="tel" autoComplete="tel" className={input} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label htmlFor="cd-ec-name" className={label}>Emergency contact</label><input id="cd-ec-name" className={input} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
            <div><label htmlFor="cd-ec-phone" className={label}>Their phone</label><input id="cd-ec-phone" type="tel" className={input} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
            <div><label htmlFor="cd-ec-rel" className={label}>Relationship</label><input id="cd-ec-rel" className={input} value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} /></div>
          </div>
          <p className="font-sans text-xs text-ink-faint">Each camper also keeps its own emergency contact; edit those on the camper card.</p>
          {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="h-10 px-4 rounded-[8px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition">Cancel</button>
            <button type="submit" disabled={saving} className="ui-btn ui-btn--primary">
              <Check size={15} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
