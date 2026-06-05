import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: number | string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
}

export default function StatCard({ label, value, icon: Icon, iconColor = 'text-warning', iconBg = 'bg-brand-soft' }: Props) {
  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-6 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted mb-1">{label}</p>
        <p className="font-sans font-bold text-3xl text-ink tabular-nums leading-none">{value}</p>
      </div>
    </div>
  )
}
