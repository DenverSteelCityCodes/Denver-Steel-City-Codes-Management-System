import { useState } from 'react'
import { Settings2, Lock, ExternalLink } from 'lucide-react'
import { useFormConfigs } from '../hooks/useFormConfigs'
import { useAppSettings } from '../hooks/useAppSettings'
import { FORM_DEFINITIONS, resolveField, type FieldConfig, type FieldDef, type FormKey } from '../lib/formFields'

function Toggle({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`w-9 h-5 shrink-0 rounded-full relative transition disabled:cursor-not-allowed ${on ? 'bg-brand' : 'bg-border-strong'} ${disabled ? 'opacity-60' : ''}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-4' : 'left-0.5'}`} />
    </button>
  )
}

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

  // Save the label when the admin leaves the field (not on every keystroke).
  function commitLabel() {
    const next = draft.trim()
    if (!next) { setDraft(resolved.label); return }
    if (next !== resolved.label) onUpdate({ label: next === def.label ? undefined : next })
  }

  return (
    <li className={`flex items-center gap-3 sm:gap-4 px-4 py-3 ${!resolved.show ? 'bg-surface-sunken/60' : ''}`}>
      {def.locked ? (
        <span className="w-9 flex justify-center shrink-0" title="Always shown — the system depends on this field">
          <Lock size={14} className="text-ink-faint" />
        </span>
      ) : (
        <Toggle on={resolved.show} disabled={saving} label={`Show ${resolved.label}`} onChange={() => onUpdate({ visible: !resolved.show })} />
      )}

      <div className={`flex-1 min-w-0 ${!resolved.show ? 'opacity-60' : ''}`}>
        <label htmlFor={`label-${def.key}`} className="sr-only">Label for {def.label}</label>
        <input
          id={`label-${def.key}`}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') { setDraft(resolved.label); (e.target as HTMLInputElement).blur() }
          }}
          disabled={!resolved.show}
          className="w-full font-sans text-sm text-ink bg-transparent border-b border-dashed border-border-strong/60 hover:border-border-strong focus:border-brand focus:border-solid focus:outline-none transition py-0.5 disabled:cursor-not-allowed"
        />
        {resolved.label !== def.label && (
          <p className="font-sans text-xs text-ink-faint mt-0.5">Default: {def.label}</p>
        )}
      </div>

      {def.locked ? (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-sunken text-ink-muted">
          {def.required ? 'Required' : 'As needed'}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onUpdate({ required: !resolved.required })}
          disabled={!resolved.show || saving}
          aria-pressed={resolved.required}
          title={resolved.required ? 'Required — click to make optional' : 'Optional — click to make required'}
          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            resolved.required ? 'bg-danger-soft text-danger' : 'bg-surface-sunken text-ink-muted'
          }`}
        >
          {resolved.required ? 'Required' : 'Optional'}
        </button>
      )}
    </li>
  )
}

export default function AdminFormEditor() {
  const { configs, loading, setFormEnabled, updateField } = useFormConfigs()
  const { settings, loading: settingsLoading, updateSetting } = useAppSettings()
  const [activeForm, setActiveForm] = useState<FormKey>('volunteer_application')
  const [saving, setSaving] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const activeConfig = configs.find(c => c.form_key === activeForm)
  const formDef = FORM_DEFINITIONS[activeForm]

  // The volunteer form's open/closed switch is the same setting as Volunteers → "Applications open".
  const isOpen = activeForm === 'volunteer_application'
    ? settings['volunteer_applications_open'] === 'true'
    : activeConfig?.config.enabled !== false

  async function run(key: string, fn: () => Promise<void>) {
    setSaving(key)
    setErr(null)
    try { await fn() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setSaving(null) }
  }

  function toggleOpen() {
    void run('enabled', () => activeForm === 'volunteer_application'
      ? updateSetting('volunteer_applications_open', isOpen ? 'false' : 'true')
      : setFormEnabled(activeForm, !isOpen))
  }

  const overrides = activeConfig?.config.fields ?? {}
  const configurable = formDef.fields.filter(f => !f.locked)
  const hiddenCount = configurable.filter(f => !resolveField(activeForm, f.key, overrides).show).length

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-sans font-bold text-2xl text-ink mb-1">Form editor</h1>
        <p className="font-sans text-sm text-ink-muted">Rename questions, hide optional ones, and choose what's required. Changes apply to the live forms immediately.</p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {(Object.keys(FORM_DEFINITIONS) as FormKey[]).map(key => (
          <button
            key={key}
            role="tab"
            aria-selected={activeForm === key}
            onClick={() => setActiveForm(key)}
            className={`h-9 px-4 font-sans text-sm font-semibold rounded-[8px] transition ${
              activeForm === key
                ? 'bg-brand text-brand-on'
                : 'bg-surface border border-border-strong text-ink-muted hover:text-ink hover:bg-surface-sunken'
            }`}
          >
            {FORM_DEFINITIONS[key].label}
          </button>
        ))}
      </div>

      {err && <p role="alert" className="px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">{err}</p>}

      {loading || settingsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-surface border border-border rounded-[14px] animate-pulse" />)}
        </div>
      ) : !activeConfig ? (
        <div className="bg-surface border border-border rounded-[14px] p-10 text-center">
          <Settings2 size={24} className="text-ink-muted mx-auto mb-3" />
          <p className="font-sans font-semibold text-ink mb-1">This form has no settings yet</p>
          <p className="font-sans text-sm text-ink-muted">The form_configs row for it is missing from the database.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-surface border border-border rounded-[14px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-sans font-bold text-base text-ink">{formDef.label}</h2>
              <p className="font-sans text-xs text-ink-muted mt-0.5">
                {isOpen ? 'Open' : 'Closed'} · {formDef.description}
                {hiddenCount > 0 && ` · ${hiddenCount} question${hiddenCount === 1 ? '' : 's'} hidden`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={activeForm === 'volunteer_application' ? '/apply' : '/parent/register'}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3 font-sans text-sm font-semibold rounded-[8px] border border-border-strong bg-surface text-ink hover:bg-surface-sunken transition flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Preview
              </a>
              <button
                onClick={toggleOpen}
                disabled={saving === 'enabled'}
                className={`h-9 px-4 font-sans text-sm font-semibold rounded-[8px] transition disabled:opacity-50 ${
                  isOpen ? 'bg-danger-soft text-danger hover:bg-danger hover:text-surface' : 'bg-success-soft text-success hover:bg-success hover:text-surface'
                }`}
              >
                {isOpen ? 'Close form' : 'Open form'}
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-surface-sunken flex items-center gap-3 sm:gap-4">
              <p className="w-9 font-sans text-xs text-ink-muted text-center">Show</p>
              <p className="flex-1 font-sans text-xs text-ink-muted">Question label <span className="text-ink-faint">(click to rename)</span></p>
              <p className="font-sans text-xs text-ink-muted shrink-0">Required?</p>
            </div>
            <ul className="divide-y divide-border">
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
            </ul>
          </div>

          <p className="font-sans text-xs text-ink-faint flex items-center gap-1.5">
            <Lock size={12} /> Locked questions can be renamed but not hidden or made optional — the database, camp safety, or eligibility checks depend on them.
          </p>
        </div>
      )}
    </div>
  )
}
