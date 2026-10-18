import { Link } from 'react-router-dom'
import { ChevronDown, CircleHelp } from 'lucide-react'
import HelpText from './HelpText'
import { TIPS, type TipKey } from '../content/help/tips'
import type { HelpTip } from '../content/help/types'

// A contextual tip (issue #186): a small "How this works" disclosure that sits right under the
// control it explains and opens in place. No modal, no popover, closed until asked for.
//
//   <HowItWorks tip="registration-switch" />
//
// The words live in content/help/tips.ts, keyed, so pages share one checked source.
export default function HowItWorks({ tip, className }: { tip: TipKey; className?: string }) {
  const t: HelpTip = TIPS[tip]
  return (
    <details className={`group/tip ${className ?? ''}`}>
      <summary className="inline-flex items-center gap-1.5 min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-bold text-ink underline underline-offset-[3px] decoration-[1.5px] hover:decoration-[3px]">
        <CircleHelp size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
        {t.label ?? 'How this works'}
        <ChevronDown size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 transition-transform group-open/tip:rotate-180" />
      </summary>
      <div className="mt-1 mb-2 max-w-[65ch] space-y-2 text-ink-muted text-pretty">
        {t.body.map((p, i) => <p key={i}><HelpText text={p} /></p>)}
        {t.more && (
          <p>
            <Link to={t.more} className="inline-flex items-center min-h-11 font-bold text-ink underline underline-offset-[3px]">
              More in Help
            </Link>
          </p>
        )}
      </div>
    </details>
  )
}
