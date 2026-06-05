import { useState } from 'react'
import { HeartPulse, X } from 'lucide-react'

interface Props {
  info: string
}

export default function MedicalFlag({ info }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-danger-soft text-danger text-xs font-sans font-semibold hover:brightness-95 transition"
        title="Medical / allergy info"
      >
        <HeartPulse size={12} />
        Medical
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-danger-soft border border-danger/30 rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-danger font-sans font-semibold text-sm">
                <HeartPulse size={16} />
                Medical / allergy info
              </div>
              <button onClick={() => setOpen(false)} className="text-danger/60 hover:text-danger transition">
                <X size={18} />
              </button>
            </div>
            <p className="font-sans text-sm text-ink leading-relaxed">{info}</p>
            <p className="mt-3 text-xs font-sans text-ink-muted">Visible to assigned volunteers and admins only.</p>
          </div>
        </div>
      )}
    </>
  )
}
