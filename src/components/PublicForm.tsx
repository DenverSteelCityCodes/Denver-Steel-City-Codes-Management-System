import { forwardRef, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Input } from './Field'

// Form pieces for the signed-out pages (DESIGN.md › Inputs). Local to these pages for now; they
// can be promoted to shared primitives later. Labels sit above fields, hints between label and
// field, and an error sits under its field in red with a drawn icon, tied to it by
// aria-describedby and aria-invalid.

export interface FieldA11y {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

export function FormField({ id, label, hint, error, optional, aside, children }: {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  // An inline action on the label row (Forgot password?), kept to a 44px target.
  aside?: ReactNode
  children: (a11y: FieldA11y) => ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className="grid gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-bold">
          {label}{optional && <span className="font-normal text-ink-muted"> (optional)</span>}
        </label>
        {aside}
      </div>
      {hint && <p id={hintId} className="text-sm text-ink-muted text-pretty">{hint}</p>}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children, alert }: { id?: string; children: ReactNode; alert?: boolean }) {
  return (
    <p id={id} role={alert ? 'alert' : undefined} className="flex gap-1.5 text-sm font-bold text-danger text-pretty">
      <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  )
}

// A form-level failure (wrong password, server down). Announced, with any recovery links under it.
export function FormError({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div role="alert" className="grid gap-1">
      <FieldError>{children}</FieldError>
      {actions && <p className="flex flex-wrap gap-x-5 pl-[22px]">{actions}</p>}
    </div>
  )
}

// A password field with a Show/Hide toggle inside it (44px target).
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function PasswordInput({ className, ...props }, ref) {
    const [shown, setShown] = useState(false)
    return (
      <div className="relative">
        <Input ref={ref} {...props} type={shown ? 'text' : 'password'} className={['pr-[84px]', className].filter(Boolean).join(' ')} />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          className="absolute top-[2px] bottom-[2px] right-[2px] min-w-[72px] px-3 border-l border-border rounded-r-[2px] font-bold text-ink hover:bg-ink/5"
        >
          {shown ? 'Hide' : 'Show'}<span className="sr-only"> password</span>
        </button>
      </div>
    )
  },
)

// A real radio or checkbox in a 52px white row; the checked row gets a 2px ink frame.
export function ChoiceRow({ children, className, ...input }: InputHTMLAttributes<HTMLInputElement> & { type: 'radio' | 'checkbox' }) {
  return (
    <label className={['flex items-center gap-3 min-h-[52px] px-4 py-2 bg-surface border-2 border-border rounded cursor-pointer has-checked:border-ink', className].filter(Boolean).join(' ')}>
      <input {...input} className="w-[22px] h-[22px] m-0 shrink-0 cursor-pointer" />
      <span className="flex-1 min-w-0">{children}</span>
    </label>
  )
}

export function Spinner() {
  return <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
}
