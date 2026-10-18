import { flushSync } from 'react-dom'

// Ref callback that focuses an element once, when it mounts (L6a). Stable identity, so React
// doesn't call it again on re-renders (an inline `el => el?.focus()` would steal focus each time).
export function focusOnMount(el: HTMLElement | null) {
  el?.focus()
}

// An element id, an element, or nothing (skipped).
export type FocusTarget = string | HTMLElement | null | undefined | false

// Focus the first target that is on the page and can take focus (a disabled or removed control is
// skipped). For after a save removes or disables the control that held focus: the next row's
// control, or else the list heading (which needs tabIndex={-1}). Never leaves focus on <body> if
// any target is there.
export function focusFirst(...targets: FocusTarget[]) {
  for (const t of targets) {
    const el = typeof t === 'string' ? document.getElementById(t) : t || null
    if (!el || !el.isConnected) continue
    el.focus()
    if (document.activeElement === el) return true
  }
  return false
}

// Inline editors and confirms close in place (no modals). When one closes (Cancel, Keep, Esc, or
// a save that leaves its opener on screen), focus goes back to the control that opened it, never
// to <body>. close() is committed first so the opener is back in the DOM; the targets after the
// first are fallbacks (a row heading, the list heading).
export function closeAndFocus(close: () => void, ...targets: FocusTarget[]) {
  flushSync(close)
  focusFirst(...targets)
}

// The enabled controls matching `selector` that come after `from` inside `scope`, in page order:
// "the next row's control" to land on once a save takes the current row away.
export function controlsAfter(from: Element, scope: Element | null, selector: string): HTMLElement[] {
  if (!scope) return []
  return [...scope.querySelectorAll<HTMLElement>(selector)]
    .filter(el => el !== from && !!(from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))
}
