import { TriangleAlert } from 'lucide-react'
import { useUrgentNotices } from '../hooks/useUrgentNotices'
import { formatCampTime } from '../lib/denverTime'

// The alarm sign (DESIGN.md › Sign Band › alarm): white on alarm red, for an urgent safety notice
// (spec 34). First on the parent and volunteer home pages until the end of the day it was posted;
// safety wins the screen. Nothing to dismiss: it leaves at midnight, Denver time.
export default function UrgentBanner({ className = '' }: { className?: string }) {
  const notices = useUrgentNotices()
  if (notices.length === 0) return null
  return (
    <section aria-labelledby="urgent-h" className={`rounded bg-alarm text-white p-4 ${className}`}>
      <h2 id="urgent-h" className="flex items-center gap-2 text-[1.375rem] font-extrabold leading-[1.15]">
        <TriangleAlert size={22} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
        {notices.length === 1 ? 'Urgent notice from camp' : `${notices.length} urgent notices from camp`}
      </h2>
      <ul>
        {notices.map(n => (
          <li key={n.id} className="mt-3 pt-3 border-t border-white/40 first:mt-2 first:pt-0 first:border-t-0">
            <p className="text-sm font-bold">
              <time dateTime={n.created_at}>{formatCampTime(n.created_at)}</time> today · {n.author_name}
            </p>
            <p className="mt-1 text-lg leading-snug whitespace-pre-line text-pretty break-words max-w-[65ch]">{n.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
