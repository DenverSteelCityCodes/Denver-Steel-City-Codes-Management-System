import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Lock, X } from 'lucide-react'
import { cleanOptions, type FieldDef, type FormKey } from '../lib/formFields'
import { countChoiceUses } from '../hooks/useFormConfigs'
import Button from './Button'
import { Input } from './Field'
import InlineConfirm from './InlineConfirm'

// A choice question's list on the Forms page (spec 43), opened in place under its row: rename a
// choice where it stands (saved on leaving the field), move it with up/down buttons (no drag,
// WCAG 2.5.7), remove it, or add one. Answers already given keep their text whatever happens here.
//
// The editor works on its own copy of the list, one row per choice with an id that survives
// renames and moves, and saves the whole list after each change. So a move straight after a
// rename, or two quick edits, always act on what's on screen, and every check (repeats, at least
// one choice) runs against that copy before anything is saved. Saves queue in order in
// useFormConfigs; if one fails, the list goes back to the last one saved.

interface Row { id: number; text: string }

let lastId = 0
// Rows for a list, keeping the id of any row whose text is unchanged, so those items (their focus,
// a half-typed rename) stay mounted when the list is put back or refreshed.
const toRows = (list: string[], prev: Row[] = []): Row[] => {
  const ids = new Map(prev.map(r => [r.text, r.id]))
  return list.map(text => ({ id: ids.get(text) ?? ++lastId, text }))
}

const iconBtn = 'inline-grid place-items-center w-11 h-11 shrink-0 rounded border-2 border-border-strong bg-surface text-ink hover:border-ink aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:hover:border-border-strong'

function ChoiceItem({
  inputId,
  row,
  index,
  count,
  taken,
  onRename,
  onMove,
  onRemove,
  register,
  children,
}: {
  inputId: string
  row: Row
  index: number
  count: number
  taken: (name: string) => boolean
  onRename: (next: string) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
  register: (el: HTMLElement | null) => void
  // The remove confirmation, when it's open for this choice.
  children?: React.ReactNode
}) {
  const [draft, setDraft] = useState(row.text)
  const [problem, setProblem] = useState<string | null>(null)
  const discard = useRef(false)

  function commit() {
    if (discard.current) { discard.current = false; setDraft(row.text); setProblem(null); return }
    const next = draft.trim()
    if (!next || next === row.text) { setDraft(row.text); setProblem(null); return }
    if (taken(next)) { setProblem(`“${next}” is already on the list.`); return }
    setProblem(null)
    setDraft(next)
    onRename(next)
  }

  const first = index === 0
  const last = index === count - 1
  return (
    <li className="py-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={inputId} className="sr-only">Choice {index + 1} of {count}</label>
        <Input
          id={inputId}
          value={draft}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${inputId}-problem` : undefined}
          onChange={e => { setDraft(e.target.value); setProblem(null) }}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
            if (e.key === 'Escape') { e.stopPropagation(); discard.current = true; e.currentTarget.blur() }
          }}
          className="flex-1 min-w-0"
        />
        <button type="button" className={iconBtn} aria-label={`Move “${row.text}” up`} aria-disabled={first || undefined}
          onClick={() => { if (!first) onMove(-1) }}>
          <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <button type="button" className={iconBtn} aria-label={`Move “${row.text}” down`} aria-disabled={last || undefined}
          onClick={() => { if (!last) onMove(1) }}>
          <ArrowDown size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <button ref={register} type="button" className={iconBtn} aria-label={`Remove “${row.text}”`}
          aria-disabled={count === 1 || undefined} title={count === 1 ? 'A question needs at least one choice' : undefined}
          onClick={() => { if (count > 1) onRemove() }}>
          <X size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      {problem && <p id={`${inputId}-problem`} role="alert" className="mt-1 text-sm font-bold text-danger">{problem}</p>}
      {children && <div className="mt-2">{children}</div>}
    </li>
  )
}

export default function ChoiceListEditor({
  id,
  formKey,
  def,
  options,
  questionLabel,
  answeredBy,
  onSave,
}: {
  id: string
  formKey: FormKey
  def: FieldDef
  // The saved list as resolved, "other" last. A newer saved list is taken in once no save of this
  // editor's is in flight (e.g. it was reopened while an earlier save was still finishing).
  options: string[]
  questionLabel: string
  // Who gives this answer, for "12 campers chose it".
  answeredBy: { one: string; many: string }
  onSave: (list: string[]) => Promise<void>
}) {
  const defaults = cleanOptions(def.options ?? [], def.other)
  const [rows, setRows] = useState<Row[]>(() => toRows(options.filter(o => o !== def.other)))
  const saved = useRef(options)
  const pending = useRef(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newChoice, setNewChoice] = useState('')
  const [addProblem, setAddProblem] = useState<string | null>(null)
  const [removing, setRemoving] = useState<{ id: number; uses: number | null } | null>(null)
  const [resetting, setResetting] = useState(false)
  const addBox = useRef<HTMLInputElement>(null)
  const resetBtn = useRef<HTMLButtonElement>(null)
  const removeBtns = useRef(new Map<number, HTMLElement>())
  // After a removal, focus goes to the remove button of the row that took its place.
  const focusAfter = useRef<number | null>(null)
  // The rows on screen, for the one step that finishes after a wait (counting a choice's answers).
  const latest = useRef(rows)
  useEffect(() => { latest.current = rows }, [rows])

  const withOther = (list: string[]) => def.other ? [...list, def.other] : list
  const withoutOther = (list: string[]) => list.filter(o => o !== def.other)
  const isDefault = withOther(rows.map(r => r.text)).join('\n') === defaults.join('\n')

  const optionsKey = options.join('\n')
  const [seen, setSeen] = useState(optionsKey)
  if (optionsKey !== seen && !saving) {
    setSeen(optionsKey)
    if (optionsKey !== withOther(rows.map(r => r.text)).join('\n')) setRows(toRows(withoutOther(options), rows))
  }

  useEffect(() => {
    if (focusAfter.current === null) return
    const row = rows[Math.min(focusAfter.current, rows.length - 1)]
    ;(row && removeBtns.current.get(row.id) || addBox.current)?.focus()
    focusAfter.current = null
  }, [rows])

  const taken = (name: string, exceptId?: number) => {
    const n = name.trim().toLowerCase()
    return rows.some(r => r.id !== exceptId && r.text.toLowerCase() === n) || def.other?.toLowerCase() === n
  }

  // Show the change at once and save the whole list behind it.
  async function change(next: Row[]) {
    setRows(next)
    setError(null)
    const list = withOther(next.map(r => r.text))
    pending.current++
    setSaving(true)
    try {
      await onSave(list)
      saved.current = list
      // A later save carries every earlier change, so it also makes good one that failed.
      setError(null)
    } catch (e) {
      const why = e instanceof Error ? e.message : 'Something went wrong'
      // A later save still queued carries this change too; let that one settle the list.
      if (pending.current === 1) {
        setError(`${why}. The list is back to how it was last saved.`)
        setRows(prev => toRows(withoutOther(saved.current), prev))
        setRemoving(null)
      } else {
        setError(`${why}. Saving again with your next change.`)
      }
    } finally {
      if (--pending.current === 0) setSaving(false)
    }
  }

  function move(rowId: number, by: -1 | 1) {
    const i = rows.findIndex(r => r.id === rowId)
    const j = i + by
    if (i < 0 || j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    change(next)
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    const next = newChoice.trim()
    if (!next) { setAddProblem('Type the new choice first.'); return }
    if (taken(next)) { setAddProblem(`“${next}” is already on the list.`); return }
    setAddProblem(null)
    setNewChoice('')
    change([...rows, ...toRows([next])])
  }

  // Ask first only when someone already gave this answer. If the choice was renamed or removed
  // while counting, the count no longer fits it, so nothing happens.
  async function askRemove(row: Row) {
    const uses = await countChoiceUses(formKey, def.key, row.text)
    if (latest.current.find(r => r.id === row.id)?.text !== row.text) return
    if (uses === 0) return remove(row.id)
    setRemoving({ id: row.id, uses })
  }

  function remove(rowId: number) {
    const current = latest.current
    if (current.length < 2 || !current.some(r => r.id === rowId)) return
    focusAfter.current = current.findIndex(r => r.id === rowId)
    setRemoving(null)
    change(current.filter(r => r.id !== rowId))
  }

  const who = (n: number) => `${n} ${n === 1 ? answeredBy.one : answeredBy.many}`

  return (
    <div id={id} className="mt-1 mb-3 p-4 max-sm:p-3 rounded border-2 border-border bg-surface-sunken">
      <h3 className="font-bold text-pretty">Choices for “{questionLabel}”</h3>
      <p className="text-sm text-ink-muted text-pretty max-w-[60ch]">
        The live form shows these in this order. Renaming or removing a choice doesn't change answers already given.
      </p>

      <ol className="mt-2">
        {rows.map((row, i) => (
          <ChoiceItem
            key={row.id}
            inputId={`${id}-${row.id}`}
            row={row}
            index={i}
            count={rows.length}
            taken={name => taken(name, row.id)}
            onRename={next => change(rows.map(r => r.id === row.id ? { ...r, text: next } : r))}
            onMove={by => move(row.id, by)}
            onRemove={() => askRemove(row)}
            register={el => { if (el) removeBtns.current.set(row.id, el); else removeBtns.current.delete(row.id) }}
          >
            {removing?.id === row.id && (
              <InlineConfirm
                message={removing.uses === null
                  ? `Couldn't check whether anyone chose “${row.text}”. Remove it from the form anyway? Answers already given stay as they are.`
                  : `${who(removing.uses)} chose “${row.text}”. Remove it from the form? Their answers stay as they are.`}
                confirmLabel="Remove"
                onConfirm={() => remove(row.id)}
                onCancel={() => { setRemoving(null); removeBtns.current.get(row.id)?.focus() }}
              />
            )}
          </ChoiceItem>
        ))}
        {def.other && (
          <li className="py-1.5 flex items-center gap-2 min-h-12 text-ink-muted">
            <Lock size={16} aria-hidden="true" className="shrink-0" />
            <span className="text-pretty"><b className="font-bold text-ink">{def.other}</b> stays last: it opens a box to type in.</span>
          </li>
        )}
      </ol>

      <form onSubmit={add} className="mt-2 flex flex-wrap items-start gap-2" noValidate>
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor={`${id}-new`} className="sr-only">New choice</label>
          <Input
            ref={addBox}
            id={`${id}-new`}
            value={newChoice}
            placeholder="New choice"
            aria-invalid={addProblem ? true : undefined}
            aria-describedby={addProblem ? `${id}-new-problem` : undefined}
            onChange={e => { setNewChoice(e.target.value); setAddProblem(null) }}
            className="w-full"
          />
          {addProblem && <p id={`${id}-new-problem`} role="alert" className="mt-1 text-sm font-bold text-danger">{addProblem}</p>}
        </div>
        <Button type="submit" variant="secondary">Add choice</Button>
      </form>

      {error && <p role="alert" className="mt-2 text-sm font-bold text-danger text-pretty">Couldn't save that change: {error}</p>}
      <p aria-live="polite" className="sr-only">{saving ? 'Saving…' : ''}</p>

      {!isDefault && (
        resetting ? (
          <div className="mt-3">
            <InlineConfirm
              tone="neutral"
              message={`Go back to the default list of ${defaults.length} choices? Answers already given stay as they are.`}
              confirmLabel="Use the default list"
              onConfirm={() => {
                setResetting(false)
                setRemoving(null)
                change(toRows(withoutOther(defaults), rows))
                addBox.current?.focus()
              }}
              onCancel={() => { setResetting(false); requestAnimationFrame(() => resetBtn.current?.focus()) }}
            />
          </div>
        ) : (
          <Button ref={resetBtn} variant="text" className="mt-2" onClick={() => setResetting(true)}>Use the default list</Button>
        )
      )}
    </div>
  )
}
