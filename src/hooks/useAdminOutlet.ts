import { useOutletContext } from 'react-router-dom'

// What AdminLayout hands every admin page through <Outlet context>.
export interface AdminOutlet {
  // Reloads the To do queue (the rail's Today count and the bell) now, not at the next navigation.
  refreshAttention: () => void
}

// Undefined outside AdminLayout (a page rendered on its own, a test).
export function useAdminOutlet(): AdminOutlet | undefined {
  return useOutletContext<AdminOutlet | undefined>()
}
