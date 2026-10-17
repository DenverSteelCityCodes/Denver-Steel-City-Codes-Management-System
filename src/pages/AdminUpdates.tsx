import { Megaphone } from 'lucide-react'
import { useUpdates } from '../hooks/useUpdates'
import { useAdminClasses } from '../hooks/useAdminClasses'
import UpdateComposer from '../components/UpdateComposer'
import UpdatesFeed from '../components/UpdatesFeed'

// Admin: post to everyone, all parents, all volunteers, or one section's families, with
// "Also email" to open the mail client with the audience in BCC. Everything posted is listed.
export default function AdminUpdates() {
  const { updates, loading, error, postUpdate, deleteUpdate } = useUpdates(200)
  const { classes } = useAdminClasses()
  const sections = classes.flatMap(c => c.sections.map(s => ({
    id: s.id, label: `${c.name} · ${s.label}${s.week ? ` · Week ${s.week}` : ''}`,
  })))

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-sans font-bold text-2xl text-ink mb-1">Updates</h1>
        <p className="font-sans text-sm text-ink-muted">
          Posts show on parent and volunteer dashboards and in their bells. Tick "Also email" to open your mail app with the right addresses in BCC.
        </p>
      </div>

      <section aria-labelledby="compose-heading" className="bg-surface border border-brand rounded-[14px] shadow-sm p-4 sm:p-5">
        <h2 id="compose-heading" className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-1.5">
          <Megaphone size={13} /> New update
        </h2>
        <UpdateComposer mode={{ kind: 'admin', sections }} onPost={async input => { await postUpdate(input) }} autoFocus={false} />
      </section>

      {error && <div className="px-4 py-3 bg-danger-soft text-danger rounded-[10px] font-sans text-sm">⚠ {error}</div>}

      <section aria-labelledby="feed-heading" className="bg-surface border border-border rounded-[14px] shadow-sm px-4 sm:px-5 py-2">
        <h2 id="feed-heading" className="sr-only">Posted updates</h2>
        <UpdatesFeed
          updates={updates}
          loading={loading}
          canDelete={() => true}
          onDelete={deleteUpdate}
          canCopyEmails={() => true}
          emptyText="Nothing posted yet. Your first update could be a welcome note with drop-off and pickup times."
        />
      </section>
    </div>
  )
}
