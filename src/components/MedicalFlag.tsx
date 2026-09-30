import { useId, useState } from 'react'
import { HeartPulse } from 'lucide-react'

// Medical / allergy chip that expands the details in place (no modal). Render the chip where it
// belongs in the header and let the note flow below it via `children`-less layout: the note is
// rendered right after the chip, full width, when open.
export default function MedicalFlag({ info }: { info: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-danger-soft text-danger text-xs font-sans font-semibold hover:brightness-95 transition"
      >
        <HeartPulse size={12} />
        Medical
      </button>
      {open && (
        <p id={id} className="basis-full mt-1 px-3 py-2 rounded-[8px] bg-danger-soft border border-danger/20 font-sans text-sm text-ink">
          {info}
          <span className="block mt-1 text-xs text-ink-muted">Shared with your camper's volunteers and camp admins only.</span>
        </p>
      )}
    </>
  )
}
