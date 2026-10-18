import { useState } from 'react'
import { Check, CircleAlert } from 'lucide-react'
import { useParentProfile } from '../hooks/useParentProfile'
import { useAuth } from '../context/AuthContext'
import { Input } from './Field'
import Button from './Button'
import type { ParentProfile } from '../types/database'

type Form = { email: string; phone: string; emergency_contact_name: string; emergency_contact_phone: string; emergency_contact_relation: string }

const label = 'block font-bold mb-1.5'

// "Your contact details" (spec 11), reached from the avatar menu: the contact the camp uses for
// every camper on this account, as a form that opens with the saved answers.
export default function ContactDetailsCard() {
  const { user } = useAuth()
  const { profile, loading, saveProfile } = useParentProfile()
  if (loading) return <div className="h-72 bg-surface-sunken rounded animate-pulse" aria-busy="true" />
  return <ContactForm profile={profile} fallbackEmail={user?.email ?? ''} save={saveProfile} />
}

function ContactForm({ profile, fallbackEmail, save }: {
  profile: ParentProfile | null
  fallbackEmail: string
  save: ReturnType<typeof useParentProfile>['saveProfile']
}) {
  const [form, setForm] = useState<Form>({
    email: profile?.email ?? fallbackEmail,
    phone: profile?.phone ?? '',
    emergency_contact_name: profile?.emergency_contact_name ?? '',
    emergency_contact_phone: profile?.emergency_contact_phone ?? '',
    emergency_contact_relation: profile?.emergency_contact_relation ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.phone.trim()) { setErr('Enter an email and a phone number the camp can reach you on.'); return }
    if (!form.emergency_contact_name.trim() || !form.emergency_contact_phone.trim()) { setErr("Enter your emergency contact's name and phone."); return }
    setSaving(true); setErr(null)
    try {
      await save({
        email: form.email.trim(), phone: form.phone.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        emergency_contact_relation: form.emergency_contact_relation.trim() || null,
      })
      setSaved(true)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="contact-you" noValidate>
      <h2 id="contact-you" className="sr-only">You</h2>
      <div>
        <label htmlFor="cd-email" className={label}>Email</label>
        <Input id="cd-email" type="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} />
      </div>
      <div className="mt-5">
        <label htmlFor="cd-phone" className={label}>Phone</label>
        <Input id="cd-phone" type="tel" autoComplete="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
      </div>

      <h2 className="mt-8 text-lg font-bold">Your emergency contact</h2>
      <div className="mt-3">
        <label htmlFor="cd-ec-name" className={label}>Name</label>
        <Input id="cd-ec-name" autoComplete="off" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
      </div>
      <div className="mt-5 grid gap-5 min-[480px]:grid-cols-2 min-[480px]:gap-4">
        <div>
          <label htmlFor="cd-ec-phone" className={label}>Their phone</label>
          <Input id="cd-ec-phone" type="tel" autoComplete="off" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} />
        </div>
        <div>
          <label htmlFor="cd-ec-rel" className={label}>Relationship</label>
          <Input id="cd-ec-rel" autoComplete="off" value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} />
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-muted">Each camper also keeps their own emergency contact. Change it with Edit on the camper, on Home.</p>

      {err && (
        <p role="alert" className="mt-5 flex items-start gap-1.5 text-sm font-bold text-danger">
          <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-0.5" aria-hidden="true" /> {err}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" variant="ink" disabled={saving}>{saving ? 'Saving…' : 'Save your details'}</Button>
        {saved && (
          <p role="status" className="inline-flex items-center gap-1.5 font-bold text-success">
            <Check size={16} strokeWidth={2.5} aria-hidden="true" /> Saved
          </p>
        )}
      </div>
    </form>
  )
}
