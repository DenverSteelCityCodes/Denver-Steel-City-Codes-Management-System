import { forwardRef } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { fieldClass } from '../lib/ui'

// Shared form fields (DESIGN.md › Inputs): 16px text so iOS never zooms, 48px tall, a 2px border
// that stays visible on focus, and an ink focus ring (gold at night). Layout classes still apply.

const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(' ')

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={join(fieldClass, className)} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={join(fieldClass, className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={join(fieldClass, className)} {...props} />
  },
)
