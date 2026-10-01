import type { ReactNode } from 'react'
import wordmark from '../../assets/sccdenver.png'

// The gold {STEEL CITY CODES} //DENVER wordmark. It's gold on transparent, so it only reads on
// the ink bar (design_system §2) — never place it on the cream page background.
export default function Wordmark({ className = 'h-8 w-auto' }: { className?: string }) {
  return <img src={wordmark} alt="Steel City Codes // Denver" className={className} />
}

// Standalone ink top bar for pages outside the admin/parent shells (auth, apply, volunteer).
export function BrandBar({ children }: { children?: ReactNode }) {
  return (
    <header className="h-16 shrink-0 bg-ink-950 flex items-center justify-between gap-4 px-5 sticky top-0 z-10">
      <Wordmark />
      {children}
    </header>
  )
}
