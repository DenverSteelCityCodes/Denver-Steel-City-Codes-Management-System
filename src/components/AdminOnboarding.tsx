import { useState } from 'react'
import { ChevronDown, CircleCheck, Clock3 } from 'lucide-react'
import { useAdminOnboarding, type OnboardingVolunteer, type OverdueItem } from '../hooks/useAdminOnboarding'
import { formatCampSlot } from '../lib/denverTime'
import { hoursLabel, taskDueAt, validHelpUrl } from '../lib/onboarding'
import { supabase } from '../lib/supabase'
import type { OnboardingTask, VolunteerTask } from '../types/database'
import Button from './Button'
import { Input, Textarea } from './Field'
import HistoryStrip from './HistoryStrip'
import InlineConfirm from './InlineConfirm'
import StatusWord from './StatusWord'

// Volunteers › Onboarding (spec 35): the overdue list first (the one thing that needs a person),
// then every volunteer's checklist, the checklist items themselves, and who was removed this season.
// Overdue is ink with a clock, never red (DESIGN.md › The Meaningful Red Rule); removal is the one
// destructive action and confirms inline with a reason that goes in the email and in History.
const h2 = 'text-lg font-bold leading-[1.3]'
const label = 'block font-bold mb-1.5'
const textBtn = 'ui-btn ui-btn--text'

function ErrorLine({ text }: { text: string }) {
  return <p role="alert" className="mt-2 text-sm font-bold text-danger text-pretty">{text}</p>
}

// One volunteer's items with the admin's actions: Mark done (and so checked), Confirm a tick, Undo.
function ItemsFor({ volunteer, tasks, done, onlyKeys, actions }: {
  volunteer: OnboardingVolunteer
  tasks: OnboardingTask[]
  done: Map<string, VolunteerTask>
  onlyKeys?: Set<string>
  actions: ReturnType<typeof useAdminOnboarding>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  async function act(key: string, fn: () => Promise<void>, fail: string) {
    setBusy(key); setErr(null)
    try { await fn() } catch (e) { setErr(`${fail}: ${e instanceof Error ? e.message : 'unknown error'}`) } finally { setBusy(null) }
  }

  return (
    <>
      <ul>
        {tasks.filter(t => !onlyKeys || onlyKeys.has(t.key)).map(t => {
          const row = done.get(t.key)
          const due = taskDueAt(volunteer.accepted_at, t.created_at, t.due_hours_after_accept)
          const late = !row && !!due && new Date(due).getTime() <= now
          return (
            <li key={t.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
              <span className="flex-[1_1_16rem] min-w-0 text-pretty">{t.label}</span>
              <span className="flex flex-wrap items-center gap-x-3">
                {row
                  ? <StatusWord tone="ok" icon={CircleCheck}>{row.verified_by ? 'Done, checked' : 'Done'}</StatusWord>
                  : due
                    ? (late ? <StatusWord tone="waiting" icon={Clock3}>Due {formatCampSlot(due)}</StatusWord> : <span className="text-sm text-ink-muted">Due {formatCampSlot(due)}</span>)
                    : <span className="text-sm text-ink-muted">Not done</span>}
                {!row && (
                  <button type="button" className={textBtn} disabled={busy === t.key} aria-busy={busy === t.key}
                    onClick={() => void act(t.key, () => actions.markDone(volunteer.id, t.key), "Couldn't mark it done")}>
                    Mark done<span className="sr-only">: {t.label}, for {volunteer.name}</span>
                  </button>
                )}
                {row && !row.verified_by && (
                  <button type="button" className={textBtn} disabled={busy === t.key} aria-busy={busy === t.key}
                    onClick={() => void act(t.key, () => actions.markDone(volunteer.id, t.key), "Couldn't confirm it")}>
                    Confirm<span className="sr-only">: {t.label}, for {volunteer.name}</span>
                  </button>
                )}
                {row && (
                  <button type="button" className={`${textBtn} text-ink-muted`} disabled={busy === t.key} aria-busy={busy === t.key}
                    onClick={() => void act(t.key, () => actions.undo(volunteer.id, t.key), "Couldn't undo it")}>
                    Undo<span className="sr-only">: {t.label}, for {volunteer.name}</span>
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {err && <ErrorLine text={err} />}
    </>
  )
}

// Remove from the season: a red inline frame with the reason (required; it is emailed and logged).
function RemovePanel({ volunteer, onRemove, onCancel }: {
  volunteer: OnboardingVolunteer
  onRemove: (reason: string) => Promise<void>
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const id = `remove-${volunteer.id}`

  async function confirm() {
    if (!reason.trim()) { setErr('Give a reason. It goes in the email to them and in History.'); document.getElementById(`${id}-reason`)?.focus(); return }
    setBusy(true); setErr(null)
    try { await onRemove(reason.trim()) } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong'); setBusy(false) }
  }

  return (
    <div role="group" aria-labelledby={`${id}-q`} onKeyDown={e => { if (e.key === 'Escape' && !busy) onCancel() }}
      className="mt-3 p-4 rounded border-2 border-danger bg-surface max-w-[640px]">
      <p id={`${id}-q`} className="font-bold text-pretty">
        Remove {volunteer.name} from this season? Their class spots and upcoming duties open up, they lose the volunteer pages, and they get an email with your reason.
      </p>
      <label htmlFor={`${id}-reason`} className="block mt-3 mb-1.5 font-bold">Reason</label>
      <Textarea id={`${id}-reason`} rows={2} className="resize-y" maxLength={500} value={reason}
        aria-invalid={!!err || undefined} aria-describedby={err ? `${id}-err` : undefined}
        placeholder="For example, didn't finish onboarding in time" onChange={e => { setReason(e.target.value); setErr(null) }} />
      {err && <p id={`${id}-err`} role="alert" className="mt-2 text-sm font-bold text-danger text-pretty">{err}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        <Button autoFocus onClick={onCancel} disabled={busy}>Keep {volunteer.name.split(' ')[0]}</Button>
        <Button variant="danger" onClick={() => void confirm()} disabled={busy} aria-busy={busy}>
          {busy ? 'Removing…' : `Remove ${volunteer.name.split(' ')[0]}`}
        </Button>
      </div>
    </div>
  )
}

// Add or edit one checklist item.
function TaskForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: OnboardingTask
  submitLabel: string
  onSubmit: (t: { label: string; help_url: string | null; due_hours_after_accept: number }) => Promise<void>
  onCancel?: () => void
}) {
  const [text, setText] = useState(initial?.label ?? '')
  const [url, setUrl] = useState(initial?.help_url ?? '')
  const [hours, setHours] = useState(String(initial?.due_hours_after_accept ?? 24))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const id = `task-${initial?.key ?? 'new'}`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const h = Number(hours)
    if (!text.trim()) { setErr('Say what to do.'); return }
    if (url.trim() && !validHelpUrl(url.trim())) { setErr('The link has to start with https:// (or be a page here, like /volunteer/profile).'); return }
    if (!Number.isInteger(h) || h < 1 || h > 2160) { setErr('Due within: a whole number of hours, 1 to 2160.'); return }
    setBusy(true); setErr(null)
    try {
      await onSubmit({ label: text.trim(), help_url: url.trim() || null, due_hours_after_accept: h })
      if (!initial) { setText(''); setUrl('') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape' && onCancel) onCancel() }} noValidate
      aria-label={initial ? `Edit ${initial.label}` : 'Add a checklist item'} className="flex flex-wrap items-end gap-3">
      <div className="flex-[2_1_18rem] min-w-0">
        <label htmlFor={`${id}-label`} className={label}>What to do</label>
        <Input id={`${id}-label`} value={text} maxLength={160} autoFocus={!!initial} onChange={e => { setText(e.target.value); setErr(null) }} placeholder="Join the crew Discord" />
      </div>
      <div className="flex-[2_1_14rem] min-w-0">
        <label htmlFor={`${id}-url`} className={label}>Link <span className="font-normal text-ink-muted">(optional)</span></label>
        <Input id={`${id}-url`} type="url" inputMode="url" value={url} onChange={e => { setUrl(e.target.value); setErr(null) }} placeholder="https://…" />
      </div>
      <div>
        <label htmlFor={`${id}-hours`} className={label}>Due within (hours)</label>
        <Input id={`${id}-hours`} type="number" inputMode="numeric" min={1} max={2160} value={hours} onChange={e => { setHours(e.target.value); setErr(null) }} className="w-[7rem]" />
      </div>
      <div className="flex flex-wrap gap-2">
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant={initial ? 'ink' : 'secondary'} disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
      {err && <p role="alert" className="basis-full text-sm font-bold text-danger text-pretty">{err}</p>}
    </form>
  )
}

export default function AdminOnboarding() {
  const actions = useAdminOnboarding()
  const { tasks, volunteers, done, overdue, loading, error, reload } = actions
  const [open, setOpen] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [taskErr, setTaskErr] = useState<string | null>(null)

  if (loading) {
    return <div aria-busy="true" aria-label="Loading onboarding" className="border-y-2 border-ink">{[1, 2, 3].map(i => <div key={i} className="h-12 my-1 rounded bg-surface-sunken animate-pulse" />)}</div>
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p title={error} className="flex-1 font-bold text-danger">Couldn't load onboarding. Check your connection, then try again.</p>
        <Button onClick={() => void reload()}>Try again</Button>
      </div>
    )
  }

  const current = volunteers.filter(v => !v.removed_at)
  const removed = volunteers.filter(v => v.removed_at).sort((a, b) => b.removed_at!.localeCompare(a.removed_at!))
  const doneBy = new Map<string, Map<string, VolunteerTask>>()
  for (const d of done) {
    const m = doneBy.get(d.volunteer_id) ?? new Map<string, VolunteerTask>()
    m.set(d.task_key, d); doneBy.set(d.volunteer_id, m)
  }
  const overdueBy = overdue.reduce<Map<string, OverdueItem[]>>((m, o) => m.set(o.volunteer_id, [...(m.get(o.volunteer_id) ?? []), o]), new Map())
  const byId = new Map(volunteers.map(v => [v.id, v]))

  async function remove(v: OnboardingVolunteer, reason: string) {
    const freed = await actions.removeFromSeason(v.id, reason)
    setRemoving(null)
    setNote(`${v.name} is off this season's crew and has been emailed.${freed > 0 ? ` ${freed} crew ${freed === 1 ? 'spot is' : 'spots are'} open again: fill ${freed === 1 ? 'it' : 'them'} on the Crew tab.` : ''}`)
  }

  const removeControl = (v: OnboardingVolunteer) => removing === v.id
    ? <RemovePanel volunteer={v} onRemove={reason => remove(v, reason)} onCancel={() => setRemoving(null)} />
    : (
      <button type="button" onClick={() => { setNote(null); setRemoving(v.id) }} className={`${textBtn} text-danger`}>
        Remove from the season<span className="sr-only">: {v.name}</span>
      </button>
    )

  return (
    <div className="space-y-10">
      {note && <p role="status" className="flex items-start gap-1.5 font-bold text-success text-pretty"><CircleCheck size={18} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />{note}</p>}

      {/* ── Overdue ── */}
      <section aria-labelledby="overdue-h">
        <h2 id="overdue-h" className={h2}>Overdue ({overdue.length})</h2>
        <p className="mt-1 text-sm text-ink-muted text-pretty">Checklist items past their due time. Each is due a set number of hours after the volunteer was accepted.</p>
        {overdueBy.size === 0 ? (
          <p className="mt-3 py-4 border-y-2 border-ink font-bold">Nothing overdue. Everyone is on track.</p>
        ) : (
          <ul className="mt-3 border-y-2 border-ink">
            {[...overdueBy].map(([vid, items]) => {
              const v = byId.get(vid)
              if (!v) return null
              return (
                <li key={vid} className="py-4 border-t border-border first:border-t-0">
                  <p className="text-lg font-bold leading-[1.3]">{v.name} <span className="font-normal text-base text-ink-muted">· {items.length} overdue</span></p>
                  <ItemsFor volunteer={v} tasks={tasks} done={doneBy.get(vid) ?? new Map()} onlyKeys={new Set(items.map(i => i.task_key))} actions={actions} />
                  {removeControl(v)}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Everyone ── */}
      <section aria-labelledby="everyone-h">
        <h2 id="everyone-h" className={h2}>Every volunteer</h2>
        {current.length === 0 ? (
          <p className="mt-3 py-4 border-y-2 border-ink font-bold">No volunteers yet. Accepted applicants show up here.</p>
        ) : (
          <ul className="mt-3 border-y-2 border-ink">
            {current.map(v => {
              const mine = doneBy.get(v.id) ?? new Map<string, VolunteerTask>()
              const n = tasks.filter(t => mine.has(t.key)).length
              const late = overdueBy.get(v.id)?.length ?? 0
              const isOpen = open === v.id
              return (
                <li key={v.id} className="border-t border-border first:border-t-0">
                  <button type="button" onClick={() => setOpen(isOpen ? null : v.id)} aria-expanded={isOpen} aria-controls={`ob-${v.id}`}
                    className="w-full grid grid-cols-[1fr_auto] items-center gap-x-3 min-h-11 py-2 text-left cursor-pointer hover:bg-ink/[0.03]">
                    <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 min-w-0">
                    <span className="min-w-0 font-bold">
                      {v.name}{v.preferred_name && v.preferred_name !== v.name.split(' ')[0] ? <span className="font-normal text-ink-muted"> (goes by {v.preferred_name})</span> : null}
                    </span>
                    {tasks.length > 0 && n === tasks.length
                      ? <StatusWord tone="ok" icon={CircleCheck}>All {tasks.length} done</StatusWord>
                      : late > 0
                        ? <StatusWord tone="waiting" icon={Clock3}>{n} of {tasks.length} done · {late} overdue</StatusWord>
                        : <span className="text-sm text-ink-muted">{n} of {tasks.length} done</span>}
                    </span>
                    <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div id={`ob-${v.id}`} className="pb-4">
                      {v.accepted_at
                        ? <p className="text-sm text-ink-muted">Accepted {formatCampSlot(v.accepted_at)}</p>
                        : <p className="text-sm text-ink-muted">Accepted before checklists, so nothing is due.</p>}
                      <ItemsFor volunteer={v} tasks={tasks} done={mine} actions={actions} />
                      {removeControl(v)}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── The checklist itself ── */}
      <section aria-labelledby="items-h">
        <h2 id="items-h" className={h2}>Checklist items</h2>
        <p className="mt-1 text-sm text-ink-muted text-pretty">What every accepted volunteer does, each within a set time of being accepted. They tick items off on their Today page, and the welcome email lists them.</p>
        {tasks.length === 0
          ? <p className="mt-3 py-4 border-y-2 border-ink font-bold">No checklist items. Add one below.</p>
          : (
            <ol className="mt-3 border-y-2 border-ink">
              {tasks.map(t => (
                <li key={t.key} className="py-3 border-t border-border first:border-t-0">
                  {editing === t.key ? (
                    <TaskForm initial={t} submitLabel="Save item" onCancel={() => setEditing(null)}
                      onSubmit={async patch => { await actions.updateTask(t.key, patch); setEditing(null) }} />
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex-[1_1_18rem] min-w-0">
                          <p className="font-bold text-pretty">{t.label}</p>
                          <p className="text-sm text-ink-muted break-all">Within {hoursLabel(t.due_hours_after_accept)}{t.help_url ? ` · ${t.help_url}` : ' · no link'}</p>
                        </div>
                        <span className="inline-flex gap-x-4">
                          <button type="button" className={textBtn} onClick={() => { setDeleting(null); setEditing(t.key) }}>Edit<span className="sr-only">: {t.label}</span></button>
                          <button type="button" className={`${textBtn} text-ink-muted`} aria-expanded={deleting === t.key} onClick={() => setDeleting(t.key)}>Delete<span className="sr-only">: {t.label}</span></button>
                        </span>
                      </div>
                      {deleting === t.key && (
                        <div className="mt-2">
                          <InlineConfirm message={`Delete "${t.label}"? It leaves every volunteer's checklist, with their ticks.`} confirmLabel="Delete item" cancelLabel="Keep it" busy={busy}
                            onCancel={() => setDeleting(null)}
                            onConfirm={async () => {
                              setBusy(true); setTaskErr(null)
                              try { await actions.deleteTask(t.key); setDeleting(null) } catch (e) { setTaskErr(`Couldn't delete it: ${e instanceof Error ? e.message : 'unknown error'}`) } finally { setBusy(false) }
                            }} />
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        {taskErr && <ErrorLine text={taskErr} />}
        <div className="mt-4">
          <TaskForm submitLabel="Add item" onSubmit={actions.addTask} />
        </div>
      </section>

      {/* ── Removed ── */}
      {removed.length > 0 && (
        <section aria-labelledby="removed-h">
          <h2 id="removed-h" className={h2}>Removed this season ({removed.length})</h2>
          <p className="mt-1 text-sm text-ink-muted text-pretty">Accepting a new application from them puts them back on the crew.</p>
          <ul className="mt-3 border-y-2 border-ink">
            {removed.map(v => (
                <li key={v.id} className="py-3 border-t border-border first:border-t-0">
                  <p className="font-bold">{v.name} <span className="font-normal text-sm text-ink-muted">· removed {formatCampSlot(v.removed_at!)}</span></p>
                  {v.removed_reason && <p className="text-pretty">{v.removed_reason}</p>}
                  <details className="group mt-1">
                    <summary className="inline-flex items-center gap-1.5 min-h-11 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      History<span className="sr-only"> for {v.name}</span>
                      <ChevronDown size={18} aria-hidden="true" className="transition-transform group-open:rotate-180" />
                    </summary>
                    <HistoryStrip heading={false} tableName="volunteers"
                      load={() => supabase.rpc('admin_history', { p_table: 'volunteers', p_row_id: v.id, p_limit: 10 })} />
                  </details>
                </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
