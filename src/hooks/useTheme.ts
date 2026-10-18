import { useCallback, useState } from 'react'

// One theme for the whole app. index.html applies the saved choice (or the OS setting) before the
// first paint; this hook reads that state and lets a shell toggle it.
function apply(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  const toggle = useCallback(() => {
    const next = !dark
    apply(next)
    try { localStorage.setItem('scc-theme', next ? 'dark' : 'light') } catch { /* private mode */ }
    setDark(next)
  }, [dark])

  return { dark, toggle }
}
