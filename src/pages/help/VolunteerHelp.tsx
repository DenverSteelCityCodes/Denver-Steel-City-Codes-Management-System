import HelpPage from './HelpPage'
import { VOLUNTEER_GUIDE } from '../../content/help/volunteer'

// /volunteer/help: short, task-first help for volunteers and applicants.
export default function VolunteerHelp() {
  return <HelpPage guide={VOLUNTEER_GUIDE} />
}
