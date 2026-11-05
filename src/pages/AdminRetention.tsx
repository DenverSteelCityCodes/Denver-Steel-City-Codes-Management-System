import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppSettings } from '../hooks/useAppSettings'
import AdminPageHead, { pageClass, h2Class } from '../components/AdminPageHead'
import { Input } from '../components/Field'
import Button from '../components/Button'
import InlineConfirm from '../components/InlineConfirm'
import { closeAndFocus, focusOnMount } from '../lib/focus'
import type { FamilyHold, RetentionRun, RetentionRunItem } from '../types/database'

const RULES: Record<string, string> = {
  clear_medical: 'Clear medical text',
  anonymize_camper: 'Anonymize camper',
  clear_place_with: 'Clear place-with notes',
  delete_pickup: 'Delete pickup adults',
  delete_parent_contact: 'Delete parent contact',
  anonymize_parent_contact: 'Clear parent contact and keep the family id',
  delete_parent_account: 'Delete parent profile',
  anonymize_parent_name: 'Rename a parent profile that other records still need',
  delete_volunteer_application: 'Delete volunteer application',
  clear_volunteer_record: 'Clear volunteer record',
  delete_volunteer_notes: 'Delete volunteer notes',
  clear_waiver: 'Clear waiver signatures',
  delete_release_consent: 'Delete walk-home consent',
  delete_camper_incident: 'Delete camper incident',
  delete_roll_call: 'Delete roll call',
  delete_camper_audit: 'Delete camper audit rows',
  delete_conduct_incident: 'Delete conduct incident',
  delete_interest_signup: 'Delete notify-me signup',
  skipped_hold: 'Skipped, family on hold',
  season_totals: 'Season totals',
}

const denver = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  dateStyle: 'medium',
  timeStyle: 'short',
})

type HoldConfirm = { parentId: string; next: boolean }

export default function AdminRetention() {
  const { settings, loading: settingsLoading, error: settingsError } = useAppSettings()
  const [run, setRun] = useState<RetentionRun | null>(null)
  const [items, setItems] = useState<RetentionRunItem[]>([])
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [families, setFamilies] = useState<FamilyHold[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [confirm, setConfirm] = useState<HoldConfirm | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: runErr } = await supabase
        .from('retention_runs')
        .select('id, started_at, finished_at, dry_run, live_setting')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (runErr) {
        setReportError(runErr.message)
        setReportLoading(false)
        return
      }
      const latest = data as RetentionRun | null
      setRun(latest)
      if (!latest) {
        setReportLoading(false)
        return
      }
      const { data: rows, error: itemErr } = await supabase
        .from('retention_run_items')
        .select('id, run_id, rule, subject_count, detail, subject_ids')
        .eq('run_id', latest.id)
        .order('id')
      if (cancelled) return
      if (itemErr) setReportError(itemErr.message)
      else setItems((rows ?? []) as RetentionRunItem[])
      setReportLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const liveOn = settings.retention_live?.trim().toLowerCase() === 'true'

  async function lookUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStatus(null)
    setConfirm(null)
    const q = query.trim()
    if (q.length < 2) {
      setFamilies([])
      setSearched(true)
      setError('Type at least two characters.')
      return
    }
    setSearching(true)
    const { data, error: rpcError } = await supabase.rpc('admin_search_families', { p_query: q })
    setSearching(false)
    if (rpcError) {
      setFamilies([])
      setSearched(true)
      setError(rpcError.message)
      return
    }
    setFamilies((data ?? []) as FamilyHold[])
    setSearched(true)
  }

  async function applyHold(family: FamilyHold, next: boolean) {
    setBusyId(family.parent_id)
    setError(null)
    const { error: rpcError } = await supabase.rpc('set_family_legal_hold', {
      p_parent_id: family.parent_id,
      p_hold: next,
    })
    setBusyId(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setFamilies(list => list.map(f => f.parent_id === family.parent_id ? { ...f, on_hold: next } : f))
    setStatus(next ? `${family.display_name} is on hold.` : `The hold on ${family.display_name} is cleared.`)
    closeAndFocus(() => setConfirm(null), `hold-${family.parent_id}`)
  }

  return (
    <div className={pageClass}>
      <AdminPageHead
        title="Retention"
        lede="The nightly job’s latest report, and legal holds. A hold pauses deletion for that whole family. The job stays a dry run until SCC signs the schedule and the database setting is turned on."
      />

      <section className="mb-10" aria-labelledby="retention-report">
        <h2 id="retention-report" className={h2Class}>Latest report</h2>
        {settingsError ? (
          <p role="alert" tabIndex={-1} ref={focusOnMount} className="mt-3 font-bold text-danger">
            Couldn’t read whether the nightly job is live. {settingsError}
          </p>
        ) : settingsLoading ? (
          <p className="mt-3 text-ink-muted">Loading the nightly switch…</p>
        ) : (
          <p className="mt-3 text-pretty max-w-[65ch]">
            The nightly job is {liveOn ? 'live: it changes records.' : 'a dry run: it only writes this report.'}
          </p>
        )}
        {reportError ? (
          <p role="alert" tabIndex={-1} ref={settingsError ? undefined : focusOnMount} className="mt-3 font-bold text-danger">
            Couldn’t load the report. {reportError}
          </p>
        ) : reportLoading ? (
          <p className="mt-3 text-ink-muted">Loading the report…</p>
        ) : !run ? (
          <p className="mt-3 text-pretty">No report yet. The nightly job writes one.</p>
        ) : (
          <>
            <p className="mt-3 text-pretty max-w-[65ch]">
              {denver.format(new Date(run.started_at))} Denver time.
              {' '}This run was {run.dry_run ? 'a dry run' : 'live'}.
              {' '}The switch was {run.live_setting ? 'on' : 'off'} when it started.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[28rem] bg-surface border-y-2 border-ink">
                <caption className="sr-only">Counts from the latest retention run</caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-2.5 text-left font-bold border-b border-ink">Rule</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-bold border-b border-ink">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-ink">
                      <th scope="row" className="px-3 py-2.5 text-left font-normal">
                        {RULES[item.rule] ?? item.rule}
                        {item.detail && <span className="block text-sm text-ink-muted">{item.detail}</span>}
                      </th>
                      <td className="px-3 py-2.5 text-right tabular-nums">{item.subject_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="retention-holds">
        <h2 id="retention-holds" className={h2Class}>Legal hold</h2>
        <p className="mt-3 text-pretty max-w-[65ch] text-ink-muted">
          Look up a parent by name or by the email on their parent profile. Putting them on hold also marks every camper of theirs.
        </p>
        <form onSubmit={lookUp} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="grid gap-1 flex-1 min-w-[16rem]">
            <label htmlFor="retention-query" className="font-bold">Parent name or email</label>
            <Input
              id="retention-query"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={searching} aria-busy={searching}>
            {searching ? 'Looking…' : 'Look up'}
          </Button>
        </form>

        {error && (
          <p key={error} role="alert" tabIndex={-1} ref={focusOnMount} className="mt-3 font-bold text-danger text-pretty">
            {error}
          </p>
        )}
        {status && !error && (
          <p role="status" className="mt-3 text-pretty">{status}</p>
        )}

        {searched && !error && families.length === 0 && (
          <p className="mt-4">No parent matches that.</p>
        )}
        {families.length > 0 && (
          <ul className="mt-4 border-t-2 border-ink">
            {families.map(family => {
              const clearing = family.on_hold
              const open = confirm?.parentId === family.parent_id
              return (
                <li key={family.parent_id} className="border-b border-ink py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <div>
                      <p className="font-bold">{family.display_name}</p>
                      <p className="text-ink-muted">
                        {family.email ?? 'No email on the parent profile'}
                        {' · '}
                        {family.campers} {family.campers === 1 ? 'camper' : 'campers'}
                        {' · '}
                        {family.on_hold ? 'On hold' : 'Not on hold'}
                      </p>
                    </div>
                    <Button
                      id={`hold-${family.parent_id}`}
                      variant="secondary"
                      onClick={() => {
                        setError(null)
                        setStatus(null)
                        setConfirm(open ? null : { parentId: family.parent_id, next: !family.on_hold })
                      }}
                    >
                      {family.on_hold ? 'Clear hold' : 'Put on hold'}
                    </Button>
                  </div>
                  {open && (
                    <div className="mt-3">
                      <InlineConfirm
                        tone={clearing ? 'danger' : 'neutral'}
                        message={clearing
                          ? 'Clear this hold? The nightly job can anonymize or delete this family’s records again.'
                          : 'Put this family on legal hold? The nightly job will skip them until an admin clears it.'}
                        confirmLabel={clearing ? 'Clear the hold' : 'Put on hold'}
                        cancelLabel="Cancel"
                        busy={busyId === family.parent_id}
                        onCancel={() => closeAndFocus(() => setConfirm(null), `hold-${family.parent_id}`)}
                        onConfirm={() => applyHold(family, !family.on_hold)}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
