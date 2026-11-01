import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import Button from './Button'
import Segmented from './Segmented'
import { toCsv, downloadCsv } from '../lib/csv'
import { CAMPER_ANSWERS, CAMPER_GROUPS, camperCsv, camperCsvRowCount, type CamperGroup, type CsvCamper, type RowShape } from '../lib/camperAnswers'

// Campers › Export (spec 39): an inline panel, never a modal. The admin picks the column groups
// and the row shape; it exports what the list's current filter shows. The choice is remembered on
// this device only.

const STORE = 'scc:camper-export'
const DEFAULT_GROUPS: CamperGroup[] = ['camper', 'parent', 'health']

function loadChoice(): { groups: CamperGroup[]; shape: RowShape } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as { groups?: unknown; shape?: unknown } | null
    const known = new Set<string>(CAMPER_GROUPS.map(g => g.key))
    const groups = Array.isArray(saved?.groups) ? saved.groups.filter((g): g is CamperGroup => known.has(g)) : DEFAULT_GROUPS
    return { groups, shape: saved?.shape === 'camper' ? 'camper' : 'class' }
  } catch {
    return { groups: DEFAULT_GROUPS, shape: 'class' }
  }
}

export default function CamperExport({ id, campers, scope, onClose }: {
  id: string
  campers: CsvCamper[]
  // What the list shows, in words: "all 212 campers", "the 40 waitlisted campers".
  scope: string
  onClose: () => void
}) {
  const [choice, setChoice] = useState(loadChoice)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(choice)) } catch { /* private window: not remembered */ }
  }, [choice])

  const toggle = (g: CamperGroup, on: boolean) =>
    setChoice(c => ({ ...c, groups: on ? [...c.groups, g] : c.groups.filter(x => x !== g) }))
  const rows = camperCsvRowCount(campers, choice.shape)

  function download() {
    const { headers, rows } = camperCsv(campers, choice.groups, choice.shape)
    downloadCsv(`campers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows))
  }

  return (
    <section id={id} aria-labelledby={`${id}-h`} onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      className="mb-8 p-4 sm:p-5 rounded border-2 border-ink bg-surface">
      <h2 id={`${id}-h`} ref={heading} tabIndex={-1} className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] focus:outline-none">
        Export campers
      </h2>
      <p className="mt-1 text-ink-muted text-pretty">Exports {scope}, as the list shows them now.</p>

      <fieldset className="mt-4">
        <legend className="font-bold">Columns</legend>
        <p id={`${id}-cols-hint`} className="text-sm text-ink-muted text-pretty">The camper's name and classes are always included.</p>
        <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {CAMPER_GROUPS.map(g => (
            <label key={g.key} className="flex items-start gap-3 min-h-11 py-1.5 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 mt-0.5 shrink-0" checked={choice.groups.includes(g.key)}
                aria-describedby={`${id}-cols-hint`} onChange={e => toggle(g.key, e.target.checked)} />
              <span className="min-w-0">
                <span className="block font-bold">{g.label}</span>
                <span className="block text-sm text-ink-muted text-pretty">
                  {CAMPER_ANSWERS.filter(a => a.group === g.key).map(a => a.label).join(', ')}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <p id={`${id}-shape`} className="font-bold mb-1.5">One row per</p>
        <Segmented mode="radio" labelledBy={`${id}-shape`} value={choice.shape}
          onChange={shape => setChoice(c => ({ ...c, shape }))}
          options={[{ value: 'class', label: 'Class' }, { value: 'camper', label: 'Camper' }]} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button variant="ink" onClick={download} disabled={campers.length === 0}>
          <Download size={18} strokeWidth={2.25} aria-hidden="true" /> Download CSV
        </Button>
        <Button variant="text" onClick={onClose}>Close</Button>
        <p aria-live="polite" className="text-sm text-ink-muted tabular-nums">
          {rows} {rows === 1 ? 'row' : 'rows'}
        </p>
      </div>
    </section>
  )
}
