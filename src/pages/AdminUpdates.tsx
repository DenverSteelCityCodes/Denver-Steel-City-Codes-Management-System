import { useSearchParams } from 'react-router-dom'
import { useUpdates } from '../hooks/useUpdates'
import { useAdminClasses } from '../hooks/useAdminClasses'
import UpdateComposer from '../components/UpdateComposer'
import UpdatesFeed from '../components/UpdatesFeed'
import EmailLog from '../components/EmailLog'
import AdminPageHead, { pageClass, h2Class } from '../components/AdminPageHead'
import Segmented from '../components/Segmented'

// Admin: post to everyone, all parents, all volunteers, or one section's families, with
// "Also email" to open the mail client with the audience in BCC. Everything posted is listed.
// Sent emails (the app's own notices to families) is the second tab, ?tab=emails.
export default function AdminUpdates() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'emails' ? 'emails' : 'post'
  const { updates, loading, error, postUpdate, deleteUpdate } = useUpdates(200)
  const { classes } = useAdminClasses()
  const sections = classes.flatMap(c => c.sections.map(s => ({
    id: s.id, label: `${c.name} · ${s.label}${s.week ? ` · Week ${s.week}` : ''}`,
  })))

  return (
    <div className={pageClass}>
      <AdminPageHead title="Updates" tabs lede="Posts appear on parent and volunteer dashboards and in their bells." />
      {/* Two views of this page, kept in the URL (?tab=emails for Sent emails). */}
      <Segmented
        mode="tabs"
        idBase="updates"
        label="Updates"
        className="mb-6"
        value={tab}
        onChange={t => setParams(t === 'emails' ? { tab: 'emails' } : {}, { replace: true })}
        options={[{ value: 'post', label: 'Post' }, { value: 'emails', label: 'Sent emails' }]}
      />

      <div role="tabpanel" id={`updates-panel-${tab}`} aria-labelledby={`updates-tab-${tab}`}
        className={tab === 'post' ? 'max-w-[720px]' : 'max-w-[960px]'}>
        {tab === 'post' ? (
          <>
            <section aria-labelledby="compose-heading">
              <h2 id="compose-heading" className="sr-only">New update</h2>
              <UpdateComposer mode={{ kind: 'admin', sections }} onPost={async input => { await postUpdate(input) }} autoFocus={false} />
            </section>

            <section aria-labelledby="feed-heading" className="mt-10">
              <h2 id="feed-heading" className={h2Class}>Posted</h2>
              {error && <p role="alert" title={error} className="mt-3 font-bold text-danger">Couldn't load the posted updates. Reload the page to try again.</p>}
              <div className="mt-3 py-1 border-y-2 border-ink">
                <UpdatesFeed
                  updates={updates}
                  loading={loading}
                  canDelete={() => true}
                  onDelete={deleteUpdate}
                  canCopyEmails={() => true}
                  emptyText="Nothing posted yet. Your first update could be a welcome note with drop-off and pickup times."
                />
              </div>
            </section>
          </>
        ) : (
          <EmailLog />
        )}
      </div>
    </div>
  )
}
