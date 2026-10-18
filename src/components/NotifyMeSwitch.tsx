import { useEffect, useId, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// The signed-in parent's "notify me" (spec 30): on the countdown card, one switch that puts their
// login email on the opening list, or takes it off. Sign-up already confirmed that address, so
// there's no confirmation email. Saves on change; a failed save flips back and says why.
export default function NotifyMeSwitch() {
  const { user } = useAuth()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hintId = useId()
  const errorId = useId()

  useEffect(() => {
    let alive = true
    void supabase.rpc('my_interest').then(({ data, error }) => {
      if (!alive) return
      if (error) setError("Couldn't load this setting. Reload the page to try again.")
      else setOn(data === true)
    })
    return () => { alive = false }
  }, [])

  async function change(next: boolean) {
    setBusy(true)
    setError(null)
    setOn(next)
    const { data, error } = await supabase.rpc('set_my_interest', { p_on: next })
    if (error) {
      setOn(!next)
      setError("That didn't save. Check your connection and try again.")
    } else setOn(data === true)
    setBusy(false)
  }

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <label className="flex items-center gap-3 min-h-11 cursor-pointer">
        <span className="flex-1 min-w-0">
          <span className="block font-bold">Email me when it opens</span>
          <span id={hintId} className="block text-sm text-ink-muted [overflow-wrap:anywhere]">
            {user?.email ? `To ${user.email}: once with the opening time, once when it opens.` : 'Once with the opening time, once when it opens.'}
          </span>
        </span>
        <input type="checkbox" role="switch" className="ui-switch" checked={on === true} disabled={on === null || busy}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId} onChange={e => { void change(e.target.checked) }} />
      </label>
      {error && (
        <p id={errorId} role="alert" className="mt-1 flex items-start gap-1.5 text-sm font-bold text-danger text-pretty">
          <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
