import { useStudents } from '../../hooks/useStudents'
import { useUpdates } from '../../hooks/useUpdates'
import UpdatesFeed from '../../components/UpdatesFeed'
import { PageHead, framedCls } from './parts'

// Updates tab: everything the camp posted to this family. Visiting it clears the tab's count.
// A reading column on the floor between 2px ink rules.
export default function ParentUpdates() {
  const { updates, loading } = useUpdates(30)
  const { students } = useStudents()
  return (
    <div className="max-w-[760px]">
      <PageHead title="Updates">
        From the camp director and {students.length > 1 ? "your campers' class leads" : "your camper's class lead"}.
      </PageHead>
      <div className={`${framedCls} py-1 mt-5`}>
        <UpdatesFeed updates={updates} loading={loading} emptyText="Nothing from the camp yet. Updates from the director and your camper's lead show up here." />
      </div>
    </div>
  )
}
