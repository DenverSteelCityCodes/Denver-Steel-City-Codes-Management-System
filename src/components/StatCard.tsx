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
  iconBg?: string
  delta?: Delta
}

const TONE: Record<DeltaTone, string> = {
  up: 'text-success',
  warn: 'text-warning',
  info: 'text-info',
  muted: 'text-ink-muted',
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-warning',
  iconBg = 'bg-brand-soft',
  delta,
}: Props) {
  const DeltaIcon = delta?.icon
  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 min-w-0">
      <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={17} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1 break-words">{label}</p>
        <p className="font-sans font-bold text-3xl text-ink tabular-nums leading-none">{value}</p>
        {delta && (
          <p className={`mt-1.5 flex items-center gap-1 font-sans text-[12.5px] font-medium ${TONE[delta.tone ?? 'muted']}`}>
            {DeltaIcon && <DeltaIcon size={14} className="shrink-0" />}
            <span>{delta.text}</span>
          </p>
        )}
      </div>
    </div>
  )
}
