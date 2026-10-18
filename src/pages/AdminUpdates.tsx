import { useSearchParams } from 'react-router-dom'
import { useUpdates } from '../hooks/useUpdates'
import { useAdminClasses } from '../hooks/useAdminClasses'
import { useSessions, campSessions } from '../hooks/useSessions'
import UpdateComposer from '../components/UpdateComposer'
import UpdatesFeed from '../components/UpdatesFeed'
import EmailLog from '../components/EmailLog'
import AdminPageHead, { pageClass, h2Class } from '../components/AdminPageHead'
import Segmented from '../components/Segmented'

// Admin: post to everyone, all parents, all volunteers, one week's families or crew, or one
// section's families, with "Also email" to open the mail client with the audience in BCC, or as an
// urgent notice the database emails at once (spec 34). Everything posted is listed.
// Sent emails (the app's own notices to families) is the second tab, ?tab=emails.
export default function AdminUpdates() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'emails' ? 'emails' : 'post'
  const { updates, loading, error, postUpdate, deleteUpdate } = useUpdates(200)
  const { classes } = useAdminClasses()
  const sections = classes.flatMap(c => c.sections.map(s => ({
    id: s.id, label: `${c.name} · ${s.label}${s.week ? ` · Week ${s.week}` : ''}`,
  })))
  // This season's weeks, for "Families in Week N" and "Crew in Week N".
  const { sessions } = useSessions()
  const weeks = campSessions(sessions).map(s => ({ id: s.id, label: s.name }))

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

      {/* Both panels stay mounted (an unsent post survives a look at Sent emails); the other one is hidden. */}
      <div role="tabpanel" id="updates-panel-post" aria-labelledby="updates-tab-post" hidden={tab !== 'post'} className="max-w-[720px]">
        <section aria-labelledby="compose-heading">
          <h2 id="compose-heading" className="sr-only">New update</h2>
          <UpdateComposer mode={{ kind: 'admin', sections, weeks }} onPost={async input => { await postUpdate(input) }} autoFocus={false} />
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
      </div>
      <div role="tabpanel" id="updates-panel-emails" aria-labelledby="updates-tab-emails" hidden={tab !== 'emails'} tabIndex={0}
        className="max-w-[960px] focus-visible:outline-offset-4">
        <EmailLog />
      </div>
    </div>
  )
}
