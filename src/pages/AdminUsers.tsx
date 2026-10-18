import { useEffect, useState } from 'react'
import { ShieldCheck, Users, GraduationCap, AlertTriangle } from 'lucide-react'
import { useAdminUsers, fetchCrewAssignments, type AdminUser, type CrewAssignments } from '../hooks/useAdminUsers'
import { useAuth } from '../context/AuthContext'
import InlineConfirm from '../components/InlineConfirm'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types/database'

const ROLE_LABELS: Record<UserRole, { label: string; badge: string }> = {
  admin:     { label: 'Admin',     badge: 'bg-role-admin-soft text-role-admin' },
  volunteer: { label: 'Volunteer', badge: 'bg-role-volunteer-soft text-role-volunteer' },
  parent:    { label: 'Parent',    badge: 'bg-info-soft text-info' },
}

// Section crew spots of a volunteer whose role is being changed (they're cleared on confirm).
type CrewCheck =
  | { userId: string; state: 'loading' }
  | { userId: string; state: 'ok'; crew: CrewAssignments }
  | { userId: string; state: 'error'; message: string }

const listJoin = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

function crewNote(check: CrewCheck | null): string {
  if (!check || check.state === 'loading') return 'Checking their section assignments…'
  if (check.state === 'error') return `Couldn't check their section assignments (${check.message}); any they have will be cleared.`
  const { lead, support } = check.crew
  if (lead.length === 0 && support.length === 0) return "They aren't on any section crew."
  const parts = [
    lead.length > 0 && `lead of ${listJoin(lead)}`,
    support.length > 0 && `support of ${listJoin(support)}`,
  ].filter(Boolean)
  return `They'll be removed as ${parts.join(' and as ')}, leaving ${lead.length + support.length === 1 ? 'that spot' : 'those spots'} open.`
}

// What a role change actually means for the person, spelled out before it happens.
function roleChangeMessage(user: AdminUser, newRole: UserRole, crew: CrewCheck | null) {
  const who = user.display_name
  const leaving = user.role === 'volunteer' ? ` ${crewNote(crew)} Any upcoming duty slots they claimed are released too.` : ''
  if (newRole === 'admin') return `Make ${who} an admin? They'll be able to see every camper's details and change anything, including other people's roles.${leaving}`
  if (newRole === 'volunteer') return `Change ${who} to a volunteer? They'll see the volunteer area, but only get a section and duties once a volunteer record exists (accept their application on the Volunteers page).`
  return `Change ${who} to a parent? They'll lose access to the ${user.role} area and see the parent dashboard instead.${leaving}`
}

export default function AdminUsers() {
  const { profile: currentUser } = useAuth()
  const { users, loading, error, updateRole, refetch } = useAdminUsers()

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState<{ userId: string; newRole: UserRole } | null>(null)
  const [crewCheck, setCrewCheck] = useState<CrewCheck | null>(null)

  // Two-step sign-in per admin (spec 27): how many authenticators each has, and resetting a
  // colleague's after a lost phone.
  const [mfa, setMfa] = useState<Map<string, number> | null>(null)
  const [mfaReset, setMfaReset] = useState<string | null>(null)
  const [mfaTick, setMfaTick] = useState(0)
  useEffect(() => {
    let alive = true
    supabase.rpc('admin_mfa_status').then(({ data }) => {
      if (alive && data) setMfa(new Map((data as { user_id: string; factors: number }[]).map(r => [r.user_id, r.factors])))
    })
    return () => { alive = false }
  }, [mfaTick])

  async function confirmMfaReset(userId: string) {
    setBusy(true); setErr(null)
    const { error: e } = await supabase.rpc('admin_reset_mfa', { p_user_id: userId })
    setBusy(false)
    if (e) { setErr(e.message); return }
    setMfaReset(null)
    setMfaTick(t => t + 1)
  }

  function requestRoleChange(user: AdminUser, newRole: UserRole) {
    setErr(null)
    setPending(newRole === user.role ? null : { userId: user.id, newRole })
    // Look up a volunteer's crew spots fresh each time, so the confirm names what gets cleared.
    if (user.role === 'volunteer' && newRole !== user.role) {
      setCrewCheck({ userId: user.id, state: 'loading' })
      fetchCrewAssignments(user.id).then(
        crew => setCrewCheck(cur => cur?.userId === user.id ? { userId: user.id, state: 'ok', crew } : cur),
        (e: unknown) => setCrewCheck(cur => cur?.userId === user.id
          ? { userId: user.id, state: 'error', message: e instanceof Error ? e.message : 'unknown error' }
          : cur),
      )
    }
  }

  async function confirmRoleChange() {
    if (!pending) return
    setBusy(true)
    setErr(null)
    try {
      await updateRole(pending.userId, pending.newRole)
      setPending(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const admins  = users.filter(u => u.role === 'admin')
  const vols    = users.filter(u => u.role === 'volunteer')
  const parents = users.filter(u => u.role === 'parent')

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink mb-1">Users &amp; roles</h1>
        <p className="font-sans text-sm text-ink-muted">Every account and what it can access. Role changes take effect the next time the person loads a page.</p>
      </div>

      {err && (
        <div role="alert" className="flex items-center gap-2 px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface border border-border rounded-[14px] animate-pulse" />)}
        </div>
      ) : error ? (
        <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">
          <span className="flex items-center gap-2"><AlertTriangle size={16} /> Couldn't load accounts: {error}</span>
          <button type="button" onClick={() => void refetch()} className="font-semibold text-xs hover:underline shrink-0">Retry</button>
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { title: 'Admins', icon: ShieldCheck, iconCls: 'text-role-admin', bgCls: 'bg-role-admin-soft', list: admins },
            { title: 'Volunteers', icon: Users, iconCls: 'text-role-volunteer', bgCls: 'bg-role-volunteer-soft', list: vols },
            { title: 'Parents', icon: GraduationCap, iconCls: 'text-info', bgCls: 'bg-info-soft', list: parents },
          ].map(({ title, icon: Icon, iconCls, bgCls, list }) => (
            <section key={title} aria-labelledby={`users-${title}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-full ${bgCls} flex items-center justify-center`}>
                  <Icon size={14} className={iconCls} />
                </div>
                <h2 id={`users-${title}`} className="font-sans font-semibold text-base text-ink">{title}</h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-sunken border border-border-strong text-xs font-semibold text-ink-muted">
                  {list.length}
                </span>
              </div>

              {list.length === 0 ? (
                <p className="font-sans text-sm text-ink-muted pl-9">None yet.</p>
              ) : (
                <ul className="bg-surface border border-border rounded-[14px] overflow-hidden divide-y divide-border">
                  {list.map(user => {
                    const isSelf = user.id === currentUser?.id
                    const isLastAdmin = user.role === 'admin' && admins.length === 1
                    const isPending = pending?.userId === user.id
                    return (
                      <li key={user.id}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full ${bgCls} flex items-center justify-center shrink-0`}>
                              <span className={`font-sans font-bold text-sm ${iconCls}`}>
                                {user.display_name?.[0]?.toUpperCase() ?? '?'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-sans font-semibold text-sm text-ink truncate">
                                {user.display_name}
                                {isSelf && <span className="ml-1.5 text-xs font-normal text-ink-muted">(you)</span>}
                              </p>
                              <p className="font-sans text-xs text-ink-muted truncate">
                                {user.email ?? 'No email on file'}
                                <span className="text-ink-faint"> · joined {new Date(user.created_at).toLocaleDateString()}</span>
                              </p>
                              {user.role === 'admin' && mfa && (
                                <p className="font-sans text-xs text-ink-muted flex flex-wrap items-center gap-x-2">
                                  <span>Two-step sign-in: {(mfa.get(user.id) ?? 0) > 0 ? 'on' : 'not set up yet'}</span>
                                  {!isSelf && (mfa.get(user.id) ?? 0) > 0 && mfaReset !== user.id && (
                                    <button type="button" onClick={() => { setErr(null); setMfaReset(user.id) }}
                                      className="min-h-6 font-semibold text-ink-muted hover:text-danger hover:underline">
                                      Reset
                                    </button>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
                            {isSelf || isLastAdmin ? (
                              <>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_LABELS[user.role].badge}`}>
                                  {ROLE_LABELS[user.role].label}
                                </span>
                                <span className="text-xs text-ink-muted font-sans">
                                  {isSelf ? "You can't change your own role" : 'Only admin'}
                                </span>
                              </>
                            ) : (
                              <>
                                <label htmlFor={`role-${user.id}`} className="font-sans text-xs text-ink-muted">Role</label>
                                <select
                                  id={`role-${user.id}`}
                                  value={isPending ? pending!.newRole : user.role}
                                  disabled={busy && isPending}
                                  onChange={e => requestRoleChange(user, e.target.value as UserRole)}
                                  className="ui-input w-auto min-h-11 py-1.5 pl-2.5 pr-7 cursor-pointer"
                                >
                                  {(['admin', 'volunteer', 'parent'] as UserRole[]).map(r => (
                                    <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                                  ))}
                                </select>
                              </>
                            )}
                          </div>
                        </div>
                        {mfaReset === user.id && (
                          <InlineConfirm
                            message={`Reset ${user.display_name ?? 'this admin'}'s two-step sign-in? Their authenticator is removed and they're signed out everywhere; they set up a new one at their next sign-in. Only do this once you're sure it's really them asking (for example, a lost phone).`}
                            confirmLabel="Reset two-step"
                            busy={busy}
                            onConfirm={() => { void confirmMfaReset(user.id) }}
                            onCancel={() => setMfaReset(null)}
                          />
                        )}
                        {isPending && (
                          <InlineConfirm
                            tone={pending!.newRole === 'admin' ? 'danger' : 'neutral'}
                            message={roleChangeMessage(user, pending!.newRole, crewCheck?.userId === user.id ? crewCheck : null)}
                            confirmLabel={`Make ${ROLE_LABELS[pending!.newRole].label.toLowerCase()}`}
                            busy={busy || (user.role === 'volunteer' && crewCheck?.userId === user.id && crewCheck.state === 'loading')}
                            onConfirm={confirmRoleChange}
                            onCancel={() => setPending(null)}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
