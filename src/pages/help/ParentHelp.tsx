import HelpPage from './HelpPage'
import { PARENT_GUIDE } from '../../content/help/parent'

// /parent/help: short, task-first help for families.
export default function ParentHelp() {
  return <HelpPage guide={PARENT_GUIDE} />
}
