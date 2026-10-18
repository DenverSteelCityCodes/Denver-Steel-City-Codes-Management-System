import { useStudents } from '../../hooks/useStudents'
import { useUpdates } from '../../hooks/useUpdates'
import UpdatesFeed from '../../components/UpdatesFeed'
import { PageHead, listCls } from '../volunteer/parts'

// Updates tab: everything the camp posted to this family. Visiting it clears the tab's count.
export default function ParentUpdates() {
  const { updates, loading } = useUpdates(30)
  const { students } = useStudents()
  return (
    <div className="max-w-[760px]">
      <PageHead title="Updates">
        From the camp director and {students.length > 1 ? "your campers' class leads" : "your camper's class lead"}.
      </PageHead>
      <div className={`${listCls} px-4 mt-6`}>
        <UpdatesFeed updates={updates} loading={loading} emptyText="Nothing from the camp yet. Updates from the director and your camper's lead show up here." />
      </div>
    </div>
  )
}
