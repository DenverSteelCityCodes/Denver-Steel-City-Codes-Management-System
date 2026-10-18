import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import { useUpdates } from '../../hooks/useUpdates'
import UpdateComposer from '../../components/UpdateComposer'
import UpdatesFeed from '../../components/UpdatesFeed'
import { PageHead, inputCls, labelCls, listCls, primaryCls } from './parts'

// Updates tab: one "Post" button for leads (it asks which class only when you lead more than one),
// then everything the camp has posted that you can see.
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
      <PageHead title="Updates" />
      {lead.length > 0 && (composing && section ? (
        <div className="bg-surface border border-brand rounded-[14px] p-4 mt-5 space-y-3">
          {lead.length > 1 && (
            <div>
              <label htmlFor="post-section" className={labelCls}>Which class?</label>
              <select id="post-section" className={inputCls} value={sectionId} onChange={e => setSectionId(e.target.value)}>
                {lead.map(s => <option key={s.id} value={s.id}>{name(s)}</option>)}
              </select>
            </div>
          )}
          <UpdateComposer
            key={section.id}
            mode={{ kind: 'lead', section: { id: section.id, label: name(section) } }}
            onPost={async input => { await postUpdate(input) }}
            onCancel={() => setComposing(false)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setComposing(true)} className={`${primaryCls} w-full mt-5`}>
          <Megaphone size={17} /> Post to your class's families
        </button>
      ))}
      <div className={`${listCls} px-4 mt-5`}>
        <UpdatesFeed
          updates={updates}
          loading={loading}
          canDelete={u => u.author_id === user?.id}
          onDelete={deleteUpdate}
          canCopyEmails={u => u.audience === 'section' && lead.some(s => s.id === u.section_id)}
          emptyText="Nothing posted yet."
        />
      </div>
    </div>
  )
}
