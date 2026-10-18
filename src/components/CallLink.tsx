import { Phone } from 'lucide-react'
import { telHref } from '../lib/campers'
import type { CallLine } from '../lib/campers'

// A tel: link that says who will answer and shows the number as text:
// "Call Grandpa Tran (grandparent, emergency) · 720-555-0137". With `verb` the word "Call" shows;
// without it (the roster, where every line has the same verb) it is for screen readers only.
export default function CallLink({ call, verb = false, className = '' }: { call: CallLine; verb?: boolean; className?: string }) {
  return (
    <a href={telHref(call.number)}
      className={`inline-flex items-start gap-1.5 min-h-11 font-bold text-ink underline underline-offset-[3px] hover:decoration-2 ${className}`}>
      <Phone size={16} strokeWidth={2.5} className="shrink-0 mt-[14px]" aria-hidden="true" />
      <span className="min-w-0 py-2.5 text-pretty">
        <span className={verb ? undefined : 'sr-only'}>Call </span>{call.who} · <span className="whitespace-nowrap">{call.number}</span>
      </span>
    </a>
  )
}
