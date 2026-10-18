import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, CircleCheck, Clock3, ExternalLink } from 'lucide-react'
import { useMyOnboarding } from '../hooks/useMyOnboarding'
import { checklistState, dueLabel, isOverdue } from '../lib/onboarding'
import StatusWord from './StatusWord'

const linkCls = 'ui-btn ui-btn--text'

// The volunteer's onboarding checklist (spec 35) on Today: what the camp needs from them after
// acceptance, each with its due time (Denver), ticked by the volunteer. Late items are ink with a
// clock (needs a person soon), never red. Gone once everything is done.
export default function OnboardingChecklist() {
  const { items, error, setDone } = useMyOnboarding()
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const now = new Date()

  if (error) {
    return <p role="alert" title={error} className="mt-8 font-bold text-danger">Couldn't load your checklist. Reload the page to try again.</p>
  }
  if (!items || items.length === 0) return null
  const state = checklistState(items, now)
  if (state.complete) return null
  const nextDue = state.next ? dueLabel(state.next.due_at, now) : null

  async function toggle(key: string, done: boolean, label: string) {
    setBusy(key); setFailed(null)
    try { await setDone(key, done) } catch {
      setFailed(`Couldn't save "${label}". Check your connection, then try again.`)
    } finally { setBusy(null) }
  }

  return (
    <section aria-labelledby="checklist-h" className="mt-8">
      <h2 id="checklist-h" className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-ink">Your onboarding checklist</h2>
      <p className="mt-1 text-ink text-pretty">
        <b className="font-bold">{state.done} of {state.total} done.</b>{' '}
        {state.overdue > 0
          ? `${state.overdue} ${state.overdue === 1 ? 'is' : 'are'} past due, so please do ${state.overdue === 1 ? 'it' : 'them'} today.`
          : nextDue ? `${nextDue.replace(/^Due/, 'Next one is due')}.` : 'Tick each one when it\'s done.'}
      </p>
      {failed && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-bold text-danger">
          <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-px" aria-hidden="true" />{failed}
        </p>
      )}
      <ul className="mt-3 border-y-2 border-ink">
        {items.map(item => {
          const late = isOverdue(item, now)
          const due = dueLabel(item.due_at, now)
          const internal = item.help_url?.startsWith('/')
          return (
            <li key={item.key} className="py-3 border-t border-border first:border-t-0">
              <label className="flex items-start gap-3 min-h-11 cursor-pointer has-[input:disabled]:cursor-progress">
                <input type="checkbox" className="w-6 h-6 mt-0.5 shrink-0" checked={!!item.done_at}
                  disabled={busy === item.key} aria-busy={busy === item.key}
                  onChange={e => { void toggle(item.key, e.target.checked, item.label) }} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-lg font-bold leading-[1.3] text-pretty ${item.done_at ? 'text-ink-muted' : 'text-ink'}`}>{item.label}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    {item.done_at
                      ? <StatusWord tone="ok" icon={CircleCheck}>{item.verified ? 'Done, checked by the camp' : 'Done'}</StatusWord>
                      : due && (late
                        ? <StatusWord tone="waiting" icon={Clock3}>{due}</StatusWord>
                        : <span className="text-sm text-ink-muted">{due}</span>)}
                  </span>
                </span>
              </label>
              {item.help_url && !item.done_at && (
                <div className="pl-9">
                  {internal
                    ? <Link to={item.help_url} className={linkCls}>Open it<span className="sr-only">: {item.label}</span></Link>
                    : <a href={item.help_url} target="_blank" rel="noreferrer" className={`${linkCls} inline-flex items-center gap-1.5`}>
                        Open the link<span className="sr-only"> for {item.label} (opens in a new tab)</span>
                        <ExternalLink size={16} strokeWidth={2.5} aria-hidden="true" />
                      </a>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
