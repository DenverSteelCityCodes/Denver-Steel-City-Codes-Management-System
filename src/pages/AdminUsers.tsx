import { useState } from 'react'
import { ShieldCheck, Users, GraduationCap, AlertTriangle } from 'lucide-react'
import { useAdminUsers, type AdminUser } from '../hooks/useAdminUsers'
import { useAuth } from '../context/AuthContext'
import InlineConfirm from '../components/InlineConfirm'
import type { UserRole } from '../types/database'

const ROLE_LABELS: Record<UserRole, { label: string; badge: string }> = {
  admin:     { label: 'Admin',     badge: 'bg-role-admin-soft text-role-admin' },
  volunteer: { label: 'Volunteer', badge: 'bg-role-volunteer-soft text-role-volunteer' },
  parent:    { label: 'Parent',    badge: 'bg-info-soft text-info' },
}

// What a role change actually means for the person, spelled out before it happens.
function roleChangeMessage(user: AdminUser, newRole: UserRole) {
  const who = user.display_name
  if (newRole === 'admin') return `Make ${who} an admin? They'll be able to see every camper's details and change anything, including other people's roles.`
  if (newRole === 'volunteer') return `Change ${who} to a volunteer? They'll see the volunteer area, but only get a section and duties once a volunteer record exists (accept their application on the Volunteers page).`
  return `Change ${who} to a parent? They'll lose access to the ${user.role} area and see the parent dashboard instead.`
}

export default function AdminUsers() {
  const { profile: currentUser } = useAuth()
  const { users, loading, updateRole } = useAdminUsers()

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState<{ userId: string; newRole: UserRole } | null>(null)

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
        <h1 className="font-sans font-bold text-2xl text-ink mb-1">Users &amp; roles</h1>
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
                                  onChange={e => {
                                    const newRole = e.target.value as UserRole
                                    setErr(null)
                                    setPending(newRole === user.role ? null : { userId: user.id, newRole })
                                  }}
                                  className="h-9 pl-2.5 pr-7 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand transition cursor-pointer"
                                >
                                  {(['admin', 'volunteer', 'parent'] as UserRole[]).map(r => (
                                    <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                                  ))}
                                </select>
                              </>
                            )}
                          </div>
                        </div>
                        {isPending && (
                          <InlineConfirm
                            tone={pending!.newRole === 'admin' ? 'danger' : 'neutral'}
                            message={roleChangeMessage(user, pending!.newRole)}
                            confirmLabel={`Make ${ROLE_LABELS[pending!.newRole].label.toLowerCase()}`}
                            busy={busy}
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
