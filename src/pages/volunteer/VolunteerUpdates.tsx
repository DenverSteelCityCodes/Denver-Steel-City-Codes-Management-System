import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import { useUpdates } from '../../hooks/useUpdates'
import UpdateComposer from '../../components/UpdateComposer'
import UpdatesFeed from '../../components/UpdatesFeed'
import { btnCls, h2Cls, inputCls, listCls } from './parts'

// Updates tab: one "Post" button for leads (it asks which class only when you lead more than one),
// then everything the camp has posted that you can see. Reading is the page's job, so posting is a
// secondary action; the active tab already names the page, so its h1 is for screen readers.
export default function VolunteerUpdates() {
  const { user } = useAuth()
  const { assigned: { assignedSections } } = useVolunteerHome()
  const { updates, loading, postUpdate, deleteUpdate } = useUpdates(30)
  const location = useLocation()
  const lead = assignedSections.filter(s => s.is_lead)
  const preset = (location.state as { compose?: string } | null)?.compose
  const [composing, setComposing] = useState(!!preset && lead.some(s => s.id === preset))
  const [sectionId, setSectionId] = useState(preset && lead.some(s => s.id === preset) ? preset : lead[0]?.id ?? '')
  const section = lead.find(s => s.id === sectionId)
  const name = (s: typeof lead[number]) => `${s.class_name} ${s.label}${s.week ? `, Week ${s.week}` : ''}`

  return (
    <div className="max-w-[760px]">
      <h1 className="sr-only">Updates</h1>
      {lead.length > 0 && (composing && section ? (
        <section aria-labelledby="post-h" className="border-y-2 border-ink pt-4 pb-5">
          <h2 id="post-h" className={h2Cls}>Post to your class's families</h2>
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {lead.length > 1 ? (
              <>
                <label htmlFor="post-section" className="font-bold text-ink">To: families in</label>
                <select id="post-section" className={`${inputCls} flex-[1_1_12rem] w-auto`} value={sectionId} onChange={e => setSectionId(e.target.value)}>
                  {lead.map(s => <option key={s.id} value={s.id}>{name(s)}</option>)}
                </select>
              </>
            ) : (
              <p className="text-ink"><b className="font-bold">To:</b> families in {name(section)}</p>
            )}
          </div>
          <UpdateComposer
            key={section.id}
            mode={{ kind: 'lead', section: { id: section.id, label: name(section) } }}
            onPost={async input => { await postUpdate(input) }}
            onCancel={() => setComposing(false)}
          />
        </section>
      ) : (
        <button type="button" onClick={() => setComposing(true)} className={`${btnCls} w-full`}>
          <PenLine size={18} strokeWidth={2.25} aria-hidden="true" /> Post to your class's families
        </button>
      ))}
      <section aria-labelledby="feed-h" className={lead.length > 0 ? 'mt-10' : undefined}>
        <h2 id="feed-h" className={`${h2Cls} mb-3`}>From the camp</h2>
        <div className={listCls}>
          <UpdatesFeed
            updates={updates}
            loading={loading}
            canDelete={u => u.author_id === user?.id}
            onDelete={deleteUpdate}
            canCopyEmails={u => u.audience === 'section' && lead.some(s => s.id === u.section_id)}
            emptyText="Nothing posted yet."
          />
        </div>
      </section>
    </div>
  )
}
