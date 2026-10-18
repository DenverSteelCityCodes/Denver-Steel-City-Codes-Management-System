import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

// 44px icon-only button for the ink bars (bell, theme, menu). `label` is required: an icon-only
// control needs an accessible name.
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { label: string }

const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, className, type = 'button', ...props }, ref,
) {
  return <button ref={ref} type={type} aria-label={label} className={['ui-iconbtn', className].filter(Boolean).join(' ')} {...props} />
})

export default IconButton
