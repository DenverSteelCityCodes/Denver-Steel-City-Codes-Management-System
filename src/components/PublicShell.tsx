import type { ReactNode, Ref } from 'react'
import { BrandBar } from './Wordmark'
import { CONTACT_EMAIL } from '../lib/authErrors'
import { buttonClass } from '../lib/ui'

// The signed-out frame (DESIGN.md › Layout › Signed out): the ink bar alone, not sticky, then one
// 640px column on the concourse floor, and the camp's address at the foot so no page is a dead end.
// `bar` puts one link at the bar's right (the camp page's "Sign in").
export default function PublicShell({ children, footer = true, bar }: { children: ReactNode; footer?: boolean; bar?: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-bg text-ink">
      <BrandBar>{bar}</BrandBar>
      <main className="flex-1 w-full max-w-[640px] mx-auto px-4 md:px-8 pt-5 pb-10">{children}</main>
      {footer && (
        <footer className="w-full max-w-[640px] mx-auto px-4 md:px-8 pt-2 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-sm text-ink-muted">
          Questions? <ContactLink />
        </footer>
      )}
    </div>
  )
}

export function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`} className={buttonClass('text', 'text-sm')}>{CONTACT_EMAIL}</a>
}

// The page title: the one Josefin line on the screen. A heading that a state change lands on
// takes `headingRef` (focusOnMount) so screen readers hear the new state.
export function PageHead({ title, lede, ledeRole, headingRef }: {
  title: ReactNode
  lede?: ReactNode
  ledeRole?: 'status' | 'alert'
  headingRef?: Ref<HTMLHeadingElement>
}) {
  return (
    <div className="mb-5">
      <h1
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance focus:outline-none"
      >
        {title}
      </h1>
      {lede && <p role={ledeRole} className="mt-2 text-ink-muted text-pretty">{lede}</p>}
    </div>
  )
}

// A line of links under a form ("Already have an account? Sign in").
export function AsideLine({ children }: { children: ReactNode }) {
  return <p className="text-ink-muted">{children}</p>
}
