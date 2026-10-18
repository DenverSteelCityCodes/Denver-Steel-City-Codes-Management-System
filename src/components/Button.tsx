import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { buttonClass } from '../lib/ui'
import type { ButtonVariant } from '../lib/ui'

// Shared button (DESIGN.md › Buttons): 48px, 4px corners, 800 weight. Variants live in lib/ui.ts.
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; block?: boolean }

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', block = false, className, type = 'button', ...props }, ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, className, block)} {...props} />
})

export default Button
