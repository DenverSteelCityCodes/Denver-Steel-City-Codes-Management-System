import { useEffect } from 'react'

// Live-ish data without sockets: refetch when the tab regains focus and on a slow poll.
export function useRefetchOnFocus(refetch: () => void, intervalMs = 60_000, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    function onVisible() { if (document.visibilityState === 'visible') refetch() }
    window.addEventListener('focus', refetch)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refetch() }, intervalMs)
    return () => {
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [refetch, intervalMs, enabled])
}
