import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, ExternalLink, ArrowRight } from 'lucide-react'
import { useFormConfigs } from '../hooks/useFormConfigs'
import { useAppSettings } from '../hooks/useAppSettings'
import { useSessions, activeCampYear } from '../hooks/useSessions'
import { useSeasonSettings } from '../hooks/useSeasonSettings'
import { registrationPhase } from '../lib/registrationStatus'
import { FORM_DEFINITIONS, resolveField, type FieldConfig, type FieldDef, type FormKey } from '../lib/formFields'
import Segmented from '../components/Segmented'
import { AdminPageHead, pageClass } from '../components/AdminTabs'

// One question: Show switch, the label (renamed in place, saved on leaving the field), and whether
// it must be answered. Locked questions can be renamed but not hidden or made optional.
function FieldRow({
  formKey,
  def,
  overrides,
  saving,
  onUpdate,
}: {
  formKey: FormKey
  def: FieldDef
  overrides: Record<string, FieldConfig>
  saving: boolean
  onUpdate: (patch: FieldConfig) => void
}) {
  const resolved = resolveField(formKey, def.key, overrides)
  const [draft, setDraft] = useState(resolved.label)

  // Escape blurs the field too; this tells that blur to discard instead of save.
  const discard = useRef(false)

  // The label field grows to fit its text (field-sizing does this where supported; this covers Safari).
  const box = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  // Save the label when the admin leaves the field (not on every keystroke).
  function commitLabel() {
    if (discard.current) { discard.current = false; setDraft(resolved.label); return }
    const next = draft.trim()
    if (!next) { setDraft(resolved.label); return }
    if (next !== resolved.label) onUpdate({ label: next === def.label ? undefined : next })
  }

  const td = 'px-3 py-2 align-middle max-md:p-0'
  return (
    <tr className="border-t border-border first:border-t-0 max-md:grid max-md:grid-cols-[4rem_minmax(0,1fr)] max-md:items-center max-md:gap-x-2 max-md:py-2">
      <td className={td}>
        {def.locked ? (
          <span className="inline-grid place-items-center w-[52px] h-11 text-ink-muted" title="Always shown: the system depends on this question">
            <Lock size={18} aria-hidden="true" />
            <span className="sr-only">Always shown</span>
          </span>
        ) : (
          <label className="inline-flex items-center min-h-11 cursor-pointer">
            <input
              type="checkbox"
              role="switch"
              className="ui-switch"
              checked={resolved.show}
              disabled={saving}
              aria-label={`Show “${resolved.label}”`}
              onChange={() => onUpdate({ visible: !resolved.show })}
            />
          </label>
        )}
      </td>

      <td className={`${td} ${resolved.show ? '' : 'opacity-60'}`}>
        <label htmlFor={`label-${def.key}`} className="sr-only">Question: {def.label}</label>
        {/* A one-line textarea that grows with the label, so a long question wraps instead of being cut
            off on a phone. Enter saves (no line breaks in a label). */}
        <textarea
          ref={box}
          id={`label-${def.key}`}
          rows={1}
          value={draft}
          onChange={e => setDraft(e.target.value.replace(/\n/g, ' '))}
          onBlur={commitLabel}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() }
            if (e.key === 'Escape') { discard.current = true; (e.target as HTMLTextAreaElement).blur() }
          }}
          disabled={!resolved.show}
          className="block w-full min-h-11 -mx-2.5 px-2.5 py-2 resize-none overflow-hidden [field-sizing:content] rounded border-2 border-transparent bg-transparent text-base font-semibold leading-snug text-ink hover:border-border hover:bg-surface focus-visible:border-focus focus-visible:bg-surface focus-visible:outline-none disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent"
          style={{ width: 'calc(100% + 1.25rem)' }}
        />
        {resolved.label !== def.label && (
          <p className="text-sm text-ink-muted">Default: {def.label}</p>
        )}
      </td>

      <td className={`${td} max-md:col-start-2`}>
        {def.locked ? (
          <span className="text-ink-muted">{def.required ? 'Always required' : 'As needed'}</span>
        ) : (
          <Segmented
            compact
            label={`Answer for “${resolved.label}”`}
            value={resolved.required ? 'required' : 'optional'}
            disabled={!resolved.show || saving}
            onChange={v => onUpdate({ required: v === 'required' })}
            options={[{ value: 'required', label: 'Required' }, { value: 'optional', label: 'Optional' }]}
          />
        )}
      </td>
    </tr>
  )
}

const FORM_TABS: { key: FormKey; short: string; rest: string }[] = [
  { key: 'volunteer_application', short: 'Volunteer', rest: ' application' },
  { key: 'student_registration', short: 'Camper', rest: ' registration' },
]

export default function AdminFormEditor() {
  const { configs, loading, error: configsError, updateField } = useFormConfigs()
  const { settings, loading: settingsLoading, error: settingsError } = useAppSettings()
  const { sessions, loading: sessionsLoading } = useSessions()
  const { settings: season } = useSeasonSettings(sessionsLoading ? null : activeCampYear(sessions))
  const [now] = useState(() => Date.now())
  const [activeForm, setActiveForm] = useState<FormKey>('volunteer_application')
  const [saving, setSaving] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const activeConfig = configs.find(c => c.form_key === activeForm)
  const formDef = FORM_DEFINITIONS[activeForm]

  // Each form opens and closes in one place only (issue #171): volunteer applications on
  // Volunteers › Applications, camper registration in Setup › Season. Here it's just the status.
  const status = activeForm === 'volunteer_application'
    ? (settingsError ? "Couldn't check" : settings['volunteer_applications_open'] === 'true' ? 'Open' : 'Closed')
    : configsError ? "Couldn't check" : { open: 'Open', scheduled: 'Opens at its set time', closed: 'Closed' }[
        registrationPhase(activeConfig?.config.enabled !== false, season?.registration_opens_at, now)]
  const control = activeForm === 'volunteer_application'
    ? { to: '/admin/volunteers?tab=applications', label: 'Open or close it in Volunteers' }
    : { to: '/admin/sessions', label: 'Open or close it in Season' }

  async function run(key: string, fn: () => Promise<void>) {
    setSaving(key)
    setErr(null)
    try { await fn() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setSaving(null) }
  }

  const overrides = activeConfig?.config.fields ?? {}
  const configurable = formDef.fields.filter(f => !f.locked)
  const hiddenCount = configurable.filter(f => !resolveField(activeForm, f.key, overrides).show).length
  const th = 'px-3 py-2.5 text-left text-sm font-bold text-ink-muted border-b border-ink whitespace-nowrap'

  return (
    <div className={pageClass}>
      <AdminPageHead title="Forms" lede="Rename questions, hide optional ones and choose what's required. Changes apply to the live forms immediately." />

      <div className="max-w-[880px]">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Segmented
            label="Form"
            value={activeForm}
            onChange={key => { setActiveForm(key); setErr(null) }}
            options={FORM_TABS.map(f => ({
              value: f.key,
              label: <>{f.short}<span className="max-sm:hidden">{f.rest}</span></>,
            }))}
          />
          <p className="flex flex-wrap items-center gap-x-4 text-pretty">
            <span><b className="font-extrabold">{status}</b> · {formDef.description.replace(/\.$/, '')}</span>
            <a
              href={activeForm === 'volunteer_application' ? '/apply' : '/parent/register'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px]"
            >
              Preview<span className="sr-only"> the {formDef.label.toLowerCase()} (opens a new tab)</span>
              <ExternalLink size={16} strokeWidth={2.5} aria-hidden="true" />
            </a>
            <Link to={control.to} className="inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px]">
              {control.label} <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </p>
        </div>

        {err && <p role="alert" className="mb-4 text-sm font-bold text-danger text-pretty">Couldn't save that change: {err}. Try again.</p>}

        {loading || settingsLoading ? (
          <div aria-busy="true" aria-label="Loading the form" className="border-y-2 border-ink">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 my-1 rounded bg-surface-sunken animate-pulse" />)}
          </div>
        ) : !activeConfig && configsError ? (
          <p role="alert" title={configsError} className="py-4 border-y-2 border-ink font-bold text-danger">
            Couldn't load the form settings. Check your connection, then reload the page.
          </p>
        ) : !activeConfig ? (
          <p className="py-4 border-y-2 border-ink">
            <b className="font-bold">This form has no settings yet.</b> <span className="text-ink-muted">Its form_configs row is missing from the database.</span>
          </p>
        ) : (
          <>
            <table className="w-full table-fixed bg-surface border-y-2 border-ink max-md:block">
              <caption className="sr-only">{formDef.label} questions{hiddenCount > 0 ? `, ${hiddenCount} hidden` : ''}</caption>
              <colgroup><col className="w-[5.25rem]" /><col /><col className="w-[15rem]" /></colgroup>
              <thead className="max-md:sr-only">
                <tr>
                  <th scope="col" className={th}>Show</th>
                  <th scope="col" className={th}>Question</th>
                  <th scope="col" className={th}>Answer</th>
                </tr>
              </thead>
              <tbody className="max-md:block">
                {formDef.fields.map(def => (
                  <FieldRow
                    key={`${activeForm}-${def.key}`}
                    formKey={activeForm}
                    def={def}
                    overrides={overrides}
                    saving={saving === def.key}
                    onUpdate={patch => run(def.key, () => updateField(activeForm, def.key, patch))}
                  />
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-sm text-ink-muted flex items-start gap-1.5 text-pretty">
              <Lock size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
              <span>
                {hiddenCount > 0 && <>{hiddenCount} question{hiddenCount === 1 ? ' is' : 's are'} hidden. </>}
                Locked questions can be renamed but not hidden or made optional: the database, camp safety or eligibility checks depend on them.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
