import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useAdminUsers, fetchCrewAssignments, type AdminUser, type CrewAssignments } from '../hooks/useAdminUsers'
import { useAuth } from '../context/AuthContext'
import InlineConfirm from '../components/InlineConfirm'
import Button from '../components/Button'
import { Input, Select } from '../components/Field'
import Segmented from '../components/Segmented'
import AdminPageHead, { pageClass } from '../components/AdminPageHead'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types/database'

const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', volunteer: 'Volunteer', parent: 'Parent' }
const PAGE = 25

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

const joined = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function AdminUsers() {
  const { profile: currentUser } = useAuth()
  const { users, loading, error, updateRole, refetch } = useAdminUsers()

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState<{ userId: string; newRole: UserRole } | null>(null)
  const [crewCheck, setCrewCheck] = useState<CrewCheck | null>(null)
  const [roleTab, setRoleTab] = useState<UserRole>('volunteer')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [changing, setChanging] = useState<string | null>(null)

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
      setChanging(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const q = query.trim().toLowerCase()
  const matches = q
    ? users.filter(u => (u.display_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
    : users
  const byRole = (r: UserRole) => matches.filter(u => u.role === r)
  const list = byRole(roleTab)

  return (
    <div className={pageClass}>
      <AdminPageHead title="Users & roles" lede="Role changes apply the next time the person loads a page." />

      <div className="max-w-[880px]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-[1_1_16rem] min-w-0">
            <label htmlFor="user-q" className="sr-only">Search people by name or email</label>
            <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <Input id="user-q" type="search" className="pl-10" placeholder="Search people by name or email"
              value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE) }} />
          </div>
          <Segmented
            label="Role"
            value={roleTab}
            onChange={r => { setRoleTab(r); setShown(PAGE) }}
            options={(['admin', 'volunteer', 'parent'] as UserRole[]).map(r => ({
              value: r, label: `${ROLE_LABELS[r]}s`, count: loading ? undefined : byRole(r).length,
            }))}
          />
        </div>

        {err && <p role="alert" className="mb-4 text-sm font-bold text-danger text-pretty">{err}</p>}

        {loading ? (
          <div aria-busy="true" aria-label="Loading accounts" className="border-y-2 border-ink">
            {[1, 2, 3].map(i => <div key={i} className="h-14 my-1 rounded bg-surface-sunken animate-pulse" />)}
          </div>
        ) : error ? (
          <div role="alert" className="py-4 border-y-2 border-ink flex flex-wrap items-center gap-x-4 gap-y-2">
            <p title={error} className="flex-1 min-w-[min(100%,16rem)] font-bold text-danger">Couldn't load accounts. Check your connection, then try again.</p>
            <Button onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : list.length === 0 ? (
          <p className="py-4 border-y-2 border-ink font-bold">
            {q ? `No ${ROLE_LABELS[roleTab].toLowerCase()}s match “${query.trim()}”.` : `No ${ROLE_LABELS[roleTab].toLowerCase()}s yet.`}
          </p>
        ) : (
          <>
            <ul className="border-y-2 border-ink">
              {list.slice(0, shown).map(user => {
                const isSelf = user.id === currentUser?.id
                const isLastAdmin = user.role === 'admin' && admins.length === 1
                const isPending = pending?.userId === user.id
                const open = changing === user.id
                const factors = mfa?.get(user.id) ?? 0
                return (
                  <li key={user.id} className="py-3 border-t border-border first:border-t-0">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                      <div className="flex-1 min-w-[min(100%,16rem)]">
                        <p className="[overflow-wrap:anywhere]">
                          <b className="font-bold">{user.display_name}</b>
                          {isSelf && <span className="text-ink-muted"> (you)</span>}
                        </p>
                        <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">
                          {user.email ?? 'No email on file'} · joined {joined(user.created_at)}
                          {user.role === 'admin' && mfa && ` · two-step sign-in ${factors > 0 ? 'on' : 'not set up'}`}
                        </p>
                      </div>
                      {user.role === 'admin' && !isSelf && factors > 0 && mfaReset !== user.id && (
                        <Button variant="text" onClick={() => { setErr(null); setMfaReset(user.id) }}>
                          Reset two-step<span className="sr-only"> for {user.display_name}</span>
                        </Button>
                      )}
                      {isSelf || isLastAdmin ? (
                        <span className="text-sm text-ink-muted">{isSelf ? "You can't change your own role" : 'Only admin, so the role stays'}</span>
                      ) : (
                        <Button variant="text" aria-expanded={open} aria-controls={`role-${user.id}-panel`}
                          onClick={() => { setPending(null); setChanging(open ? null : user.id) }}>
                          Change role<span className="sr-only"> for {user.display_name}</span>
                        </Button>
                      )}
                    </div>

                    {open && (
                      <div id={`role-${user.id}-panel`} className="mt-2 pb-1 space-y-3">
                        <div className="max-w-[20rem]">
                          <label htmlFor={`role-${user.id}`} className="block font-bold mb-1.5">Role for {user.display_name}</label>
                          <Select
                            id={`role-${user.id}`}
                            autoFocus
                            value={isPending ? pending!.newRole : user.role}
                            disabled={busy && isPending}
                            onChange={e => requestRoleChange(user, e.target.value as UserRole)}
                          >
                            {(['admin', 'volunteer', 'parent'] as UserRole[]).map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}{r === user.role ? ' (now)' : ''}</option>
                            ))}
                          </Select>
                        </div>
                        {isPending && (
                          <InlineConfirm
                            frame
                            tone={pending!.newRole === 'admin' ? 'danger' : 'neutral'}
                            message={roleChangeMessage(user, pending!.newRole, crewCheck?.userId === user.id ? crewCheck : null)}
                            confirmLabel={`Make ${ROLE_LABELS[pending!.newRole].toLowerCase()}`}
                            cancelLabel={`Keep as ${ROLE_LABELS[user.role].toLowerCase()}`}
                            busy={busy || (user.role === 'volunteer' && crewCheck?.userId === user.id && crewCheck.state === 'loading')}
                            onConfirm={confirmRoleChange}
                            onCancel={() => setPending(null)}
                          />
                        )}
                      </div>
                    )}

                    {mfaReset === user.id && (
                      <div className="mt-2">
                        <InlineConfirm
                          frame
                          message={`Reset ${user.display_name ?? 'this admin'}'s two-step sign-in? Their authenticator is removed and they're signed out everywhere; they set up a new one at their next sign-in. Only do this once you're sure it's really them asking (for example, a lost phone).`}
                          confirmLabel="Reset two-step"
                          cancelLabel="Keep it"
                          busy={busy}
                          onConfirm={() => { void confirmMfaReset(user.id) }}
                          onCancel={() => setMfaReset(null)}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {list.length > shown && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button onClick={() => setShown(n => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</Button>
                <span className="text-sm text-ink-muted">Showing {shown} of {list.length}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
