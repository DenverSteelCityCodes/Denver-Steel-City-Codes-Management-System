import type { LucideIcon } from 'lucide-react'

type DeltaTone = 'up' | 'warn' | 'info' | 'muted'

interface Delta {
  text: string
  tone?: DeltaTone
  icon?: LucideIcon
}

interface Props {
  label: string
  value: number | string
  icon: LucideIcon
  iconColor?: string
  // Kept so existing callers compile; the figure no longer sits on a tinted tile.
  iconBg?: string
  delta?: Delta
}

const TONE: Record<DeltaTone, string> = {
  up: 'text-success',
  warn: 'text-ink font-bold',
  info: 'text-ink-muted',
  muted: 'text-ink-muted',
}

// A labelled figure (DESIGN.md: no cards, no icon tiles, no uppercase labels): a 2px ink rule, the
// label with its drawn icon, then the number in tabular figures. Red only when the caller marks
// the figure as a safety problem (iconColor "text-danger", e.g. campers unaccounted for).
export default function StatCard({ label, value, icon: Icon, iconColor, delta }: Props) {
  const danger = iconColor === 'text-danger'
  const DeltaIcon = delta?.icon
  return (
    <div className="min-w-0 pt-3 border-t-2 border-ink">
      <p className={`flex items-start gap-1.5 text-sm font-bold text-pretty ${danger ? 'text-danger' : 'text-ink-muted'}`}>
        <Icon size={16} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{label}</span>
      </p>
      <p className={`mt-1 text-[2rem] font-extrabold leading-none tabular-nums ${danger ? 'text-danger' : 'text-ink'}`}>{value}</p>
      {delta && (
        <p className={`mt-1.5 flex items-center gap-1.5 text-sm ${TONE[delta.tone ?? 'muted']}`}>
          {DeltaIcon && <DeltaIcon size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />}
          <span>{delta.text}</span>
        </p>
      )}
    </div>
  )
}
