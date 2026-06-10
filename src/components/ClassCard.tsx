import type { ClassWithSections } from '../hooks/useClasses'

interface Props {
  classData: ClassWithSections
}

export default function ClassCard({ classData }: Props) {
  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-5">
      <h3 className="font-slab font-bold text-base text-ink">{classData.name}</h3>
      {classData.description && (
        <p className="font-sans text-ink-muted text-sm mt-1">{classData.description}</p>
      )}
      <p className="font-sans text-xs text-ink-faint mt-2">
        {classData.sections.length} section{classData.sections.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
