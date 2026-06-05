import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import type { Student } from '../types/database'

interface Props {
  onAdd: (payload: Pick<Student, 'full_name' | 'age' | 'medical_info'>) => Promise<void>
  onClose: () => void
}

export default function AddStudentForm({ onAdd, onClose }: Props) {
  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  const [medicalInfo, setMedicalInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await onAdd({
        full_name: fullName.trim(),
        age: Number(age),
        medical_info: medicalInfo.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />

      <div className="relative w-full max-w-md bg-surface-raised rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sans font-semibold text-xl text-ink">Add a camper</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink transition p-1 rounded-[10px]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="fullName">
              Full name <span className="text-danger">*</span>
            </label>
            <input
              id="fullName"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Alex Smith"
              className="w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="age">
              Age <span className="text-danger">*</span>
            </label>
            <input
              id="age"
              type="number"
              required
              min={1}
              max={17}
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="10"
              className="w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-sans font-semibold text-sm text-ink" htmlFor="medicalInfo">
              Medical / allergy info{' '}
              <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            {/* Highlighted container signals sensitivity to volunteers reading it */}
            <div className="rounded-[10px] bg-danger-soft p-0.5">
              <textarea
                id="medicalInfo"
                rows={3}
                value={medicalInfo}
                onChange={e => setMedicalInfo(e.target.value)}
                placeholder="e.g. peanut allergy, carries EpiPen"
                className="w-full px-3 py-2.5 rounded-[8px] bg-surface border border-danger/30 text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition resize-none"
              />
            </div>
            <p className="text-xs font-sans text-ink-muted">
              Visible to your camper's assigned volunteer and admins only.
            </p>
          </div>

          {error && (
            <p className="text-danger text-sm font-sans">⚠ {error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
              ) : (
                <UserPlus size={16} />
              )}
              {loading ? 'Adding…' : 'Add camper'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
