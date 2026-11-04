import { useEffect, useRef } from 'react'
import { campSessions } from '../lib/campYear'
import type { Session, WeekRole } from '../types/database'

export default function WeekRoleCards({ roles, sessions, error }: { roles: WeekRole[]; sessions: Session[]; error: string | null }) {
  const alert = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (error) alert.current?.focus() }, [error])
  const weeks = campSessions(sessions)
  return <>
    {error && <p tabIndex={-1} ref={alert} role="alert" className="font-bold text-danger">Couldn’t load your week roles: {error}</p>}
    {roles.filter(r => weeks.some(s => s.id === r.session_id)).map(r => <section key={r.id} aria-labelledby={`role-${r.id}`} className="border-y-2 border-ink py-5 my-5">
      <h2 id={`role-${r.id}`} className="font-bold text-xl">Week {weeks.findIndex(s => s.id === r.session_id) + 1}: {r.role === 'admin_room' ? 'Admin room' : 'Floater'}</h2>
      {r.note && <p className="mt-2 whitespace-pre-wrap break-words">{r.note}</p>}
    </section>)}
  </>
}
