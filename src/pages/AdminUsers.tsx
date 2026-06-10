import { useState } from 'react'
import { ArrowLeft, ShieldCheck, Users, GraduationCap, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdminUsers } from '../hooks/useAdminUsers'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types/database'

const ROLE_LABELS: Record<UserRole, { label: string; badge: string }> = {
  admin:     { label: 'Admin',     badge: 'bg-role-admin-soft text-role-admin' },
  volunteer: { label: 'Volunteer', badge: 'bg-role-volunteer-soft text-role-volunteer' },
  parent:    { label: 'Parent',    badge: 'bg-info-soft text-info' },
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const { profile: currentUser } = useAuth()
  const { users, loading, updateRole } = useAdminUsers()

  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    userId: string
    name: string
    newRole: UserRole
  } | null>(null)

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setBusy(userId)
    setErr(null)
    try {
      await updateRole(userId, newRole)
      setConfirmAction(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  const admins    = users.filter(u => u.role === 'admin')
  const vols      = users.filter(u => u.role === 'volunteer')
  const parents   = users.filter(u => u.role === 'parent')

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-16 bg-ink-900 flex items-center px-6 gap-4 shadow-sm">
        <button onClick={() => navigate('/admin')} className="text-white/60 hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <span className="font-sans font-bold text-white text-base tracking-tight">User management</span>
      </header>

      <main className="max-w-[900px] mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="font-sans font-bold text-2xl text-ink mb-1">Users &amp; roles</h1>
          <p className="font-sans text-sm text-ink-muted">Promote volunteers to admin or adjust roles. Role changes take effect immediately.</p>
        </div>

        {err && (
          <div className="flex items-center gap-2 px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">
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
              <section key={title}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-full ${bgCls} flex items-center justify-center`}>
                    <Icon size={14} className={iconCls} />
                  </div>
                  <h2 className="font-sans font-semibold text-base text-ink">{title}</h2>
                  <span className="px-2 py-0.5 rounded-full bg-surface-sunken border border-border-strong text-xs font-semibold text-ink-muted">
                    {list.length}
                  </span>
                </div>

                {list.length === 0 ? (
                  <p className="font-sans text-sm text-ink-muted pl-9">None yet.</p>
                ) : (
                  <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
                    {list.map((user, idx) => {
                      const isSelf = user.id === currentUser?.id
                      const isLastAdmin = user.role === 'admin' && admins.length === 1
                      return (
                        <div key={user.id} className={`flex items-center justify-between px-5 py-3.5 ${idx < list.length - 1 ? 'border-b border-border' : ''}`}>
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
                              <p className="font-sans text-xs text-ink-muted">
                                {new Date(user.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_LABELS[user.role].badge}`}>
                              {ROLE_LABELS[user.role].label}
                            </span>
                            {!isSelf && !isLastAdmin && (
                              <select
                                value={user.role}
                                disabled={busy === user.id}
                                onChange={e => {
                                  const newRole = e.target.value as UserRole
                                  setConfirmAction({ userId: user.id, name: user.display_name, newRole })
                                }}
                                className="h-8 pl-2.5 pr-7 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-xs focus:outline-none focus:ring-2 focus:ring-brand transition cursor-pointer"
                              >
                                {(['admin', 'volunteer', 'parent'] as UserRole[]).map(r => (
                                  <option key={r} value={r} className="capitalize">{r}</option>
                                ))}
                              </select>
                            )}
                            {(isSelf || isLastAdmin) && (
                              <span className="text-xs text-ink-muted font-sans">
                                {isLastAdmin ? 'Last admin' : 'Cannot change own role'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>

      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmAction(null)}>
          <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-sans font-bold text-lg text-ink">Confirm role change</h2>
            <p className="font-sans text-sm text-ink-muted">
              Change <strong className="text-ink">{confirmAction.name}</strong>'s role to{' '}
              <strong className="text-ink capitalize">{confirmAction.newRole}</strong>? This takes effect immediately.
            </p>
            {err && <p className="text-danger text-sm font-sans">⚠ {err}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmAction(null); setErr(null) }}
                className="flex-1 h-10 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] hover:bg-surface-sunken transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRoleChange(confirmAction.userId, confirmAction.newRole)}
                disabled={busy === confirmAction.userId}
                className="flex-1 h-10 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] transition disabled:opacity-50 flex items-center justify-center"
              >
                {busy === confirmAction.userId
                  ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
                  : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
