import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, LogOut, Pencil, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../hooks/useStudents'
import ContactDetailsCard from '../../components/ContactDetailsCard'
import CamperEditor from '../../components/CamperEditor'
import { realNote } from '../../lib/campers'
import type { Student } from '../../types/database'
import { buttonClass } from '../../lib/ui'
import { PageHead, Sect, framedCls, mutedTextBtn, rowCls } from './parts'

const btnCls = buttonClass('secondary')

// Family details (avatar menu): the contact details and each camper's details, read-only first with
// an inline Edit. These used to sit at the bottom of the dashboard and on every camper card.
// Facts and rows sit on the floor between 2px ink rules: no cards, no initials discs.
export default function ParentFamily() {
  const { signOut } = useAuth()
  const { students, loading, updateStudent } = useStudents()
  return (
    <>
      <Link to="/parent" className={`${mutedTextBtn} -mt-2 mb-1 gap-1 no-underline hover:text-ink`}>
        <ChevronLeft size={20} strokeWidth={2.25} aria-hidden="true" /> Back
      </Link>
      <PageHead title="Family details">The camp uses these for every class. Change them any time.</PageHead>
      <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
        <ContactDetailsCard />
        <div>
          <Sect title="Campers" id="campers-h">
            {loading ? <div className="h-32 bg-surface-sunken rounded animate-pulse" />
              : students.length === 0 ? <p className="text-ink-muted">No campers yet.</p>
              : <ul className={framedCls}>{students.map(s => <CamperDetails key={s.id} student={s} onSave={async (id, patch) => { await updateStudent(id, patch) }} />)}</ul>}
            <Link to="/parent/register" className={`${btnCls} mt-4`}><UserPlus size={20} strokeWidth={2.25} aria-hidden="true" /> Register a new camper</Link>
          </Sect>
          <button type="button" onClick={signOut} className={`${btnCls} mt-10`}><LogOut size={20} strokeWidth={2.25} aria-hidden="true" /> Sign out</button>
        </div>
      </div>
    </>
  )
}

function CamperDetails({ student, onSave }: { student: Student; onSave: Parameters<typeof CamperEditor>[0]['onSave'] }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const allergies = realNote(student.allergies)
  const medical = realNote(student.medical_conditions) ?? realNote(student.medical_info)
  const dt = 'text-sm text-ink-muted pt-0.5'
  return (
    <li className={rowCls}>
    <details className="group">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center gap-3 py-3 min-h-16 hover:bg-ink/[0.04] transition-colors">
        <span className="flex-1 min-w-0">
          <span className="block text-lg font-bold leading-snug">{student.full_name}</span>
          <span className="block text-sm text-ink-muted">
            {[student.grade ? `Grade ${student.grade}` : `Age ${student.age}`, (allergies || medical) && 'has health notes'].filter(Boolean).join(', ')}
          </span>
        </span>
        <ChevronDown size={20} strokeWidth={2.25} aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4">
        {editing ? (
          <CamperEditor student={student} onSave={onSave} onDone={() => { setEditing(false); setSaved(true) }} />
        ) : (
          <>
            <dl className="grid grid-cols-[fit-content(8.5rem)_1fr] gap-x-4 gap-y-1.5">
              <dt className={dt}>Grade</dt><dd className="font-bold">{student.grade ? `${student.grade} this fall` : 'Not added yet'}</dd>
              <dt className={dt}>Health</dt>
              <dd className="font-bold min-w-0 break-words">{allergies || medical ? <>{allergies && <span className="block">Allergies: {allergies}</span>}{medical && <span className="block">{medical}</span>}</> : 'None'}</dd>
              <dt className={dt}>Emergency</dt>
              <dd className="font-bold min-w-0 break-words">
                {student.emergency_contact_name
                  ? <>{student.emergency_contact_name}{student.emergency_contact_relation ? ` (${student.emergency_contact_relation})` : ''}{student.emergency_contact_phone && <><br />{student.emergency_contact_phone}</>}</>
                  : 'Not added yet'}
              </dd>
            </dl>
            {saved && <p role="status" className="mt-2.5 text-sm font-bold text-success flex items-center gap-1.5"><Check size={16} strokeWidth={2.5} aria-hidden="true" /> Saved</p>}
            <button type="button" onClick={() => { setEditing(true); setSaved(false) }} className={`${btnCls} mt-3`}>
              <Pencil size={20} strokeWidth={2.25} aria-hidden="true" /> Edit {student.first_name ?? student.full_name.split(' ')[0]}'s details
            </button>
          </>
        )}
      </div>
    </details>
    </li>
  )
}
