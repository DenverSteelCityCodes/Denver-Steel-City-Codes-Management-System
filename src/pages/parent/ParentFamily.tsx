import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, LogOut, Pencil, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../hooks/useStudents'
import ContactDetailsCard from '../../components/ContactDetailsCard'
import CamperEditor from '../../components/CamperEditor'
import { realNote } from '../../lib/campers'
import type { Student } from '../../types/database'
import { PageHead, Sect, btnCls, listCls } from '../volunteer/parts'

// Family details (avatar menu): the contact details and each camper's details, read-only first with
// an inline Edit. These used to sit at the bottom of the dashboard and on every camper card.
export default function ParentFamily() {
  const { signOut } = useAuth()
  const { students, loading, updateStudent } = useStudents()
  return (
    <>
      <Link to="/parent" className="-mt-2 mb-1 min-h-11 inline-flex items-center gap-1 font-sans font-semibold text-[15px] text-ink-muted hover:text-ink">
        <ChevronLeft size={17} /> Back
      </Link>
      <PageHead title="Family details">The camp uses these for every class. Change them any time.</PageHead>
      <div className="sm:grid sm:grid-cols-2 sm:gap-10 sm:items-start">
        <ContactDetailsCard />
        <div>
          <Sect title="Campers" id="campers-h">
            {loading ? <div className="h-32 bg-surface-sunken rounded-[14px] animate-pulse" />
              : students.length === 0 ? <p className="font-sans text-[15px] text-ink-muted">No campers yet.</p>
              : <div className={listCls}>{students.map(s => <CamperDetails key={s.id} student={s} onSave={async (id, patch) => { await updateStudent(id, patch) }} />)}</div>}
            <Link to="/parent/register" className={`${btnCls} mt-3`}><UserPlus size={16} /> Register a new camper</Link>
          </Sect>
          <button type="button" onClick={signOut} className={`${btnCls} mt-9`}><LogOut size={16} /> Sign out</button>
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
  const initials = student.full_name.split(/\s+/).map(n => n.match(/\p{L}/u)?.[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
  return (
    <details className="group border-b border-border last:border-0">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center gap-3 px-4 py-3 min-h-16 hover:bg-surface-sunken transition">
        <span aria-hidden="true" className="w-9 h-9 rounded-full bg-role-parent-soft text-role-parent grid place-items-center font-sans font-bold text-[13px] shrink-0">{initials}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-sans text-[16.5px] font-semibold text-ink leading-snug">{student.full_name}</span>
          <span className="block font-sans text-sm text-ink-muted">
            {[student.grade ? `Grade ${student.grade}` : `Age ${student.age}`, (allergies || medical) && 'has health notes'].filter(Boolean).join(', ')}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className="text-ink-muted transition group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">
        {editing ? (
          <CamperEditor student={student} onSave={onSave} onDone={() => { setEditing(false); setSaved(true) }} />
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 font-sans text-base">
              <dt className="text-ink-muted">Grade</dt><dd className="text-ink font-semibold">{student.grade ? `${student.grade} this fall` : 'Not added yet'}</dd>
              <dt className="text-ink-muted">Health</dt>
              <dd className="text-ink font-semibold">{allergies || medical ? <>{allergies && <span className="block">Allergies: {allergies}</span>}{medical && <span className="block">{medical}</span>}</> : 'None'}</dd>
              <dt className="text-ink-muted">Emergency</dt>
              <dd className="text-ink font-semibold">
                {student.emergency_contact_name
                  ? <>{student.emergency_contact_name}{student.emergency_contact_relation ? ` (${student.emergency_contact_relation})` : ''}{student.emergency_contact_phone && <><br />{student.emergency_contact_phone}</>}</>
                  : 'Not added yet'}
              </dd>
            </dl>
            {saved && <p role="status" className="mt-2.5 font-sans text-[15px] font-semibold text-success flex items-center gap-1.5"><Check size={16} /> Saved</p>}
            <button type="button" onClick={() => { setEditing(true); setSaved(false) }} className={`${btnCls} mt-3`}>
              <Pencil size={15} /> Edit {student.first_name ?? student.full_name.split(' ')[0]}'s details
            </button>
          </>
        )}
      </div>
    </details>
  )
}
