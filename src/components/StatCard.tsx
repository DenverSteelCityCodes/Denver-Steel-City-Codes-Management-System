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
    <div className="bg-surface border border-border rounded-xl shadow-sm p-6 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted mb-1">{label}</p>
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
