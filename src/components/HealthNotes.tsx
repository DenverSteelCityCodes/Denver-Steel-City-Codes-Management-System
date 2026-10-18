import { HeartPulse } from 'lucide-react'
import type { HealthLine } from '../lib/campers'

// A camper's health notes in danger ink, one line per kind ("Allergy: peanuts"). Always visible on
// the crew's screens, never behind a tap, and never truncated.
export default function HealthNotes({ lines, className = '' }: { lines: HealthLine[]; className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 font-bold leading-snug text-danger ${className}`}>
      <HeartPulse size={16} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />
      <span className="min-w-0 text-pretty break-words">
        {lines.map(l => (
          <span key={l.label} className="block"><b className="font-extrabold">{l.label}:</b> {l.text}</span>
        ))}
      </span>
    </p>
  )
}
