import { useId, useState } from 'react'
import { CircleAlert, StickyNote } from 'lucide-react'
import { buildNote, parseNote, PICKED_UP_MAX, type NoteTags } from '../lib/rollCallNote'
import Button from './Button'

interface Props {
  name: string
  // The camper is marked for this roll call (a note belongs to a mark).
  marked: boolean
  note: string | null
  // The panel's "Add notes" mode: show the tags to tap.
  editing: boolean
  onSave: (note: string | null) => Promise<void>
}

const chip = 'min-h-11 px-3 rounded border-2 border-ink font-bold inline-flex items-center justify-center transition-colors aria-pressed:bg-ink aria-pressed:text-bg'

// One camper's roll-call note (spec 34): quick tags (Late, Left early, Picked up by …) that write
// roll_call_marks.note. Out of notes mode it's one muted line, and only when there is a note, so the
// roll call stays a list of names and toggles. In notes mode each tag saves on tap.
export default function RollCallNote({ name, marked, note, editing, onSave }: Props) {
  const tags = parseNote(note)
  const [who, setWho] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const pickedUp = who ?? tags.pickedUpBy ?? ''

  async function save(next: NoteTags) {
    setSaving(true)
    setError(null)
    try {
      await onSave(buildNote(next))
      setWho(null)
    } catch {
      setError(`Couldn't save the note for ${name}. Check your connection and try again.`)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return note ? (
      <p className="col-span-2 mt-1 flex items-start gap-1.5 text-sm font-bold text-ink-muted">
        <StickyNote size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />
        <span className="min-w-0 break-words">{note}</span>
      </p>
    ) : null
  }

  if (!marked) {
    return <p className="col-span-2 mt-1 text-sm text-ink-muted">Mark {name.split(' ')[0]} first to add a note.</p>
  }

  return (
    <div role="group" aria-label={`Note for ${name}`} aria-busy={saving || undefined} className="col-span-2 mt-2 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={tags.late} disabled={saving} className={chip}
          onClick={() => void save({ ...tags, late: !tags.late })}>Late</button>
        <button type="button" aria-pressed={tags.leftEarly} disabled={saving} className={chip}
          onClick={() => void save({ ...tags, leftEarly: !tags.leftEarly })}>Left early</button>
      </div>
      <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); void save({ ...tags, pickedUpBy: pickedUp }) }}>
        <div className="flex-1 min-w-0">
          <label htmlFor={inputId} className="block text-sm font-bold text-ink mb-1">Picked up by</label>
          <input id={inputId} className="ui-input" value={pickedUp} maxLength={PICKED_UP_MAX} autoComplete="off"
            placeholder="Who picked them up" onChange={e => setWho(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving || who === null || who.trim() === (tags.pickedUpBy ?? '')}>Save</Button>
      </form>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm font-bold text-danger">
          <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{error}
        </p>
      )}
    </div>
  )
}
