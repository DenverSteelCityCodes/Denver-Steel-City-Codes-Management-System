import type { ReactNode } from 'react'
import wordmark from '../../assets/sccdenver.png'

// The gold {STEEL CITY CODES} //DENVER wordmark. It's gold on transparent, so it only reads on
// ink — never place it on the floor.
export default function Wordmark({ className = 'h-8 w-auto' }: { className?: string }) {
  return <img src={wordmark} alt="Steel City Codes // Denver" className={className} />
}

// The ink bar for pages outside the role shells (signed out, account notices). Nothing in it acts,
// so it isn't sticky and scrolls away with the page (DESIGN.md › Layout › Signed out). Its content
// lines up with the 640px signed-out column.
export function BrandBar({ children }: { children?: ReactNode }) {
  return (
    <header className="shrink-0 bg-shell text-on-shell pt-[env(safe-area-inset-top)] dark:shadow-[inset_0_-1px_0_var(--border)]">
      <div className="h-14 max-w-[640px] mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
        <Wordmark className="h-7 w-auto" />
        {children}
      </div>
    </header>
  )
}
