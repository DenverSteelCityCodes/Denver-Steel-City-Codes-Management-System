// Ref callback that focuses an element once, when it mounts (L6a). Stable identity, so React
// doesn't call it again on re-renders (an inline `el => el?.focus()` would steal focus each time).
export function focusOnMount(el: HTMLElement | null) {
  el?.focus()
}
