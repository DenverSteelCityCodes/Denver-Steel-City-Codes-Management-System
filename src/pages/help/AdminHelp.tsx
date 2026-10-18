import HelpPage from './HelpPage'
import { ADMIN_GUIDE } from '../../content/help/admin'

// /admin/help: the admin guide and the "when something goes wrong" playbook.
export default function AdminHelp() {
  return <HelpPage guide={ADMIN_GUIDE} framed />
}
