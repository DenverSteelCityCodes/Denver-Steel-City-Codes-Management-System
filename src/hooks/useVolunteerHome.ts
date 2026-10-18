import { useOutletContext } from 'react-router-dom'
import type { useAssignedClass } from './useAssignedClass'
import type { Session } from '../types/database'

// What VolunteerLayout loads once and hands to every volunteer tab, so switching tabs doesn't
// refetch the sections and rosters.
export interface VolunteerHome {
  assigned: ReturnType<typeof useAssignedClass>
  sessions: Session[]
}

export function useVolunteerHome() {
  return useOutletContext<VolunteerHome>()
}
