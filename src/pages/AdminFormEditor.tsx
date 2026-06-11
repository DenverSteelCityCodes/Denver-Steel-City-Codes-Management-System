import { useState } from 'react'
import { ArrowLeft, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFormConfigs } from '../hooks/useFormConfigs'
import type { FieldConfig } from '../hooks/useFormConfigs'

const FORM_DEFINITIONS: Record<string, { label: string; fields: { key: string; defaultLabel: string; defaultRequired?: boolean }[] }> = {
  volunteer_application: {
    label: 'Volunteer application',
    fields: [
      { key: 'first_name', defaultLabel: 'First name', defaultRequired: true },
      { key: 'last_name', defaultLabel: 'Last name', defaultRequired: true },
      { key: 'email', defaultLabel: 'Email address', defaultRequired: true },
      { key: 'phone', defaultLabel: 'Phone number', defaultRequired: true },
      { key: 'age', defaultLabel: 'Age', defaultRequired: true },
      { key: 'grade', defaultLabel: 'Grade level', defaultRequired: true },
      { key: 'school', defaultLabel: 'School', defaultRequired: true },
      { key: 'shirt_size', defaultLabel: 'Shirt size', defaultRequired: true },
      { key: 'availability_week_1', defaultLabel: 'Available: week 1' },
      { key: 'availability_week_2', defaultLabel: 'Available: week 2' },
      { key: 'why_volunteer', defaultLabel: 'Why do you want to volunteer?', defaultRequired: true },
      { key: 'previous_scc_volunteer', defaultLabel: 'Previous SCC volunteer?' },
      { key: 'cs_languages', defaultLabel: 'Programming languages', defaultRequired: true },
      { key: 'cs_classes', defaultLabel: 'CS classes taken' },
      { key: 'experience_children', defaultLabel: 'Experience with children' },
      { key: 'course_first_choice', defaultLabel: 'Course first choice', defaultRequired: true },
      { key: 'course_second_choice', defaultLabel: 'Course second choice', defaultRequired: true },
      { key: 'other_curricula', defaultLabel: 'Other curricula interest' },
      { key: 'volunteer_signature', defaultLabel: 'Volunteer signature', defaultRequired: true },
      { key: 'guardian_signature', defaultLabel: 'Guardian signature' },
    ],
  },
  student_registration: {
    label: 'Student registration',
    fields: [
      { key: 'full_name', defaultLabel: 'Student full name', defaultRequired: true },
      { key: 'email', defaultLabel: 'Student email' },
      { key: 'school_district', defaultLabel: 'School district', defaultRequired: true },
      { key: 'school_name', defaultLabel: 'School name', defaultRequired: true },
      { key: 'grade', defaultLabel: 'Grade', defaultRequired: true },
      { key: 'shirt_size', defaultLabel: 'Shirt size', defaultRequired: true },
      { key: 'laptop_available', defaultLabel: 'Has laptop?' },
      { key: 'ethnic_background', defaultLabel: 'Ethnic background' },
      { key: 'gender', defaultLabel: 'Gender identity' },
      { key: 'parent_name', defaultLabel: 'Parent/guardian name', defaultRequired: true },
      { key: 'parent_phone', defaultLabel: 'Parent/guardian phone', defaultRequired: true },
      { key: 'emergency_contact_name', defaultLabel: 'Emergency contact name', defaultRequired: true },
      { key: 'emergency_contact_phone', defaultLabel: 'Emergency contact phone', defaultRequired: true },
      { key: 'emergency_contact_relation', defaultLabel: 'Emergency contact relation', defaultRequired: true },
      { key: 'allergies', defaultLabel: 'Allergies' },
      { key: 'medical_conditions', defaultLabel: 'Medical conditions' },
      { key: 'free_reduced_lunch', defaultLabel: 'Free/reduced lunch eligible?' },
      { key: 'how_heard', defaultLabel: 'How did you hear about us?' },
      { key: 'previous_program', defaultLabel: 'Attended before?' },
      { key: 'candy_consent', defaultLabel: 'Candy/snack consent', defaultRequired: true },
      { key: 'waiver_signature', defaultLabel: 'Student signature', defaultRequired: true },
      { key: 'guardian_signature', defaultLabel: 'Guardian signature', defaultRequired: true },
    ],
  },
}

function FieldRow({
  fieldKey,
  defaultLabel,
  defaultRequired,
  config,
  onUpdate,
}: {
  fieldKey: string
  defaultLabel: string
  defaultRequired?: boolean
  config: FieldConfig
  onUpdate: (patch: FieldConfig) => void
}) {
  const visible = config.visible !== false
  const required = config.required !== undefined ? config.required : (defaultRequired ?? false)
  const label = config.label ?? defaultLabel

  return (
    <div className={`flex items-center gap-4 px-4 py-3 ${!visible ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onUpdate({ visible: !visible })}
        className={`w-9 h-5 rounded-full relative transition ${visible ? 'bg-brand' : 'bg-border-strong'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${visible ? 'left-4' : 'left-0.5'}`} />
      </button>

      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={label}
          onChange={e => onUpdate({ label: e.target.value })}
          disabled={!visible}
          className="w-full font-sans text-sm text-ink bg-transparent border-b border-transparent hover:border-border-strong focus:border-brand focus:outline-none transition py-0.5 disabled:cursor-not-allowed"
        />
        <p className="font-mono text-xs text-ink-faint mt-0.5">{fieldKey}</p>
      </div>

      <button
        onClick={() => onUpdate({ required: !required })}
        disabled={!visible}
        title={required ? 'Required — click to make optional' : 'Optional — click to make required'}
        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold transition ${
          required
            ? 'bg-danger-soft text-danger'
            : 'bg-surface-sunken text-ink-muted'
        } disabled:cursor-not-allowed`}
      >
        {required ? 'Required' : 'Optional'}
      </button>
    </div>
  )
}

export default function AdminFormEditor() {
  const navigate = useNavigate()
  const { configs, loading, setFormEnabled, updateField } = useFormConfigs()
  const [activeForm, setActiveForm] = useState<string>('volunteer_application')
  const [saving, setSaving] = useState<string | null>(null)

  const activeConfig = configs.find(c => c.form_key === activeForm)
  const formDef = FORM_DEFINITIONS[activeForm]

  async function handleToggleEnabled() {
    if (!activeConfig) return
    setSaving('enabled')
    try { await setFormEnabled(activeForm, !activeConfig.config.enabled) }
    finally { setSaving(null) }
  }

  async function handleUpdateField(fieldKey: string, patch: FieldConfig) {
    setSaving(fieldKey)
    try { await updateField(activeForm, fieldKey, patch) }
    finally { setSaving(null) }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-16 bg-ink-900 flex items-center px-6 gap-4 shadow-sm">
        <button onClick={() => navigate('/admin')} className="text-white/60 hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <span className="font-sans font-bold text-white text-base tracking-tight">Form editor</span>
      </header>

      <main className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        {/* Form selector */}
        <div className="flex gap-2">
          {Object.entries(FORM_DEFINITIONS).map(([key, def]) => (
            <button
              key={key}
              onClick={() => setActiveForm(key)}
              className={`h-9 px-4 font-sans text-sm font-semibold rounded-[8px] transition ${
                activeForm === key
                  ? 'bg-brand text-brand-on'
                  : 'bg-surface border border-border-strong text-ink-muted hover:text-ink hover:bg-surface-sunken'
              }`}
            >
              {def.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-surface border border-border rounded-[14px] animate-pulse" />)}
          </div>
        ) : !activeConfig ? (
          <div className="bg-surface border border-border rounded-[14px] p-10 text-center">
            <Settings2 size={24} className="text-ink-muted mx-auto mb-3" />
            <p className="font-sans text-sm text-ink-muted">Form config not found in database.</p>
            <p className="font-sans text-xs text-ink-faint mt-1">Apply <code>migration_form_configs.sql</code> first.</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Form header */}
            <div className="bg-surface border border-border rounded-[14px] p-4 flex items-center justify-between">
              <div>
                <h2 className="font-sans font-bold text-base text-ink">{formDef.label}</h2>
                <p className="font-sans text-xs text-ink-muted mt-0.5">
                  {activeConfig.config.enabled ? 'Form is live' : 'Form is disabled'} ·
                  Last updated {new Date(activeConfig.updated_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={handleToggleEnabled}
                disabled={saving === 'enabled'}
                className={`h-9 px-4 font-sans text-sm font-semibold rounded-[8px] transition disabled:opacity-50 ${
                  activeConfig.config.enabled
                    ? 'bg-danger-soft text-danger hover:bg-danger hover:text-white'
                    : 'bg-success-soft text-success hover:bg-success hover:text-white'
                }`}
              >
                {activeConfig.config.enabled ? 'Disable form' : 'Enable form'}
              </button>
            </div>

            {/* Fields list */}
            <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-surface-sunken flex items-center gap-4">
                <p className="w-9 font-sans text-xs text-ink-muted text-center">Show</p>
                <p className="flex-1 font-sans text-xs text-ink-muted">Field label</p>
                <p className="font-sans text-xs text-ink-muted shrink-0">Required?</p>
              </div>
              {formDef.fields.map((field, idx) => (
                <div key={field.key} className={idx < formDef.fields.length - 1 ? 'border-b border-border' : ''}>
                  <FieldRow
                    fieldKey={field.key}
                    defaultLabel={field.defaultLabel}
                    defaultRequired={field.defaultRequired}
                    config={activeConfig.config.fields[field.key] ?? {}}
                    onUpdate={patch => handleUpdateField(field.key, patch)}
                  />
                </div>
              ))}
            </div>

            <p className="font-sans text-xs text-ink-faint">
              Changes apply immediately. Hiding a field removes it from the public form; marking optional keeps it visible but not required.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
