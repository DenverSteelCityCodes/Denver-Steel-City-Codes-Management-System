import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/campDay'
import { classRuleLine, type RuleClass } from '../lib/courseRules'
import { Input } from './Field'

// Admin: open change requests from families (spec 11) and volunteers (spec 25), first on Campers.
// One decision per line between 2px ink rules: who and what, who asked, their words, then an
// optional reply and Mark done / Decline. Resolving emails the person who asked, with the reply.
// An exception request (spec 31) names a class the camper's grade or prerequisite rules out: the
// line shows that class, its rules and the camper's grade.
interface RequestRow {
  id: string
  message: string | null
  kind: string
  created_at: string
  section_id: string | null
  student_id: string | null
  student: { full_name: string; first_name: string | null; grade: string | null } | null
  requester: { display_name: string } | null
  registration: { status: string; sections: { label: string; week: number | null; classes: { name: string } | null } | null } | null
}

export default function AdminChangeRequests({ onResolved }: { onResolved?: () => void }) {
  const { hash } = useLocation()
  const [rows, setRows] = useState<RequestRow[] | null>(null)
  const [error, setError] = useState<{ what: 'load' | 'save'; message: string } | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  // Exception requests name their section in a plain column (no embed): looked up separately.
  const [targets, setTargets] = useState<Map<string, { label: string; week: number | null; cls: RuleClass | null }>>(new Map())
  const [ruleClasses, setRuleClasses] = useState<RuleClass[]>([])
  // The weeks each camper with an exception request already has a class in (null = both weeks).
  const [heldWeeks, setHeldWeeks] = useState<Map<string, (number | null)[]>>(new Map())
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let alive = true
    supabase
      .from('change_requests')
      .select(`id, message, kind, created_at, section_id, student_id,
        student:students ( full_name, first_name, grade ),
        requester:profiles!change_requests_requested_by_fkey ( display_name ),
        registration:registrations ( status, sections ( label, week, classes ( name ) ) )`)
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setError({ what: 'load', message: error.message })
        else { setError(null); setRows((data ?? []) as unknown as RequestRow[]) }
      })
    return () => { alive = false }
  }, [version])

  const exceptionRows = (rows ?? []).filter(r => r.kind === 'exception' && r.section_id && r.student_id)
  const exceptionSections = [...new Set(exceptionRows.map(r => r.section_id as string))].sort().join(',')
  const exceptionStudents = [...new Set(exceptionRows.map(r => r.student_id as string))].sort().join(',')
  useEffect(() => {
    if (!exceptionSections) return
    let alive = true
    void Promise.all([
      supabase.from('sections').select('id, label, week, class_id').in('id', exceptionSections.split(',')),
      supabase.from('classes').select('id, name, grades_allowed, requires_class_id, requirement_note, next_class_id'),
      supabase.from('registrations').select('student_id, sections ( week )')
        .in('student_id', exceptionStudents.split(',')).in('status', ['confirmed', 'pending', 'offered', 'waitlisted']),
    ]).then(([secs, cls, regs]) => {
      if (!alive) return
      const held = new Map<string, (number | null)[]>()
      for (const x of (regs.data ?? []) as unknown as { student_id: string; sections: { week: number | null } | null }[]) {
        held.set(x.student_id, [...(held.get(x.student_id) ?? []), x.sections?.week ?? null])
      }
      setHeldWeeks(held)
      const classes = (cls.data ?? []) as RuleClass[]
      setRuleClasses(classes)
      setTargets(new Map(((secs.data ?? []) as { id: string; label: string; week: number | null; class_id: string }[])
        .map(x => [x.id, { label: x.label, week: x.week, cls: classes.find(c => c.id === x.class_id) ?? null }])))
    })
    return () => { alive = false }
  }, [exceptionSections, exceptionStudents])

  // Today's "Review requests" links to #requests: land on the heading once the list is in.
  const hasRows = !!rows && rows.length > 0
  useEffect(() => {
    if (hash === '#requests' && hasRows) headingRef.current?.focus()
  }, [hash, hasRows])

  async function resolve(id: string, status: 'done' | 'declined') {
    setBusy(id)
    const { error } = await supabase.from('change_requests')
      .update({ status, resolution_note: notes[id]?.trim() || null }).eq('id', id)
    setBusy(null)
    if (error) { setError({ what: 'save', message: error.message }); return }
    setError(null)
    setVersion(v => v + 1)
    onResolved?.()
  }

  if (rows && rows.length === 0 && !error) return null
  return (
    <section id="requests" aria-labelledby="requests-heading" className="mb-10 scroll-mt-32 lg:scroll-mt-20">
      <h2 id="requests-heading" ref={headingRef} tabIndex={-1}
        className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] focus:outline-none">
        Change requests{rows ? ` (${rows.length})` : ''}
      </h2>
      <p className="mt-2 text-sm text-ink-muted text-pretty max-w-[68ch]">
        Make the change in the camper's row below (or the section, for a volunteer), then mark the request done.
        The person who asked gets an email either way, with your reply.
      </p>
      {/* A failed reload blocks nothing (the list stays), so it's a neutral note; a failed save or
          first load is an error. */}
      {error && (error.what === 'load' && rows ? (
        <p role="status" title={error.message} className="mt-3 font-bold text-pretty">
          Couldn't reload the change requests, so this list may be out of date. Check your connection.
        </p>
      ) : (
        <p role="alert" title={error.message} className="mt-3 font-bold text-danger text-pretty">
          {error.what === 'save'
            ? "Couldn't save that. Check your connection, then try again."
            : "Couldn't load the change requests. Check your connection, then try again."}
        </p>
      ))}
      {!rows ? (
        !error && <div aria-hidden="true" className="mt-3 h-28 rounded bg-surface-sunken animate-pulse" />
      ) : (
        <ul className="mt-3 border-b-2 border-ink">
          {rows.map(r => {
            const sec = r.registration?.sections
            const who = r.kind === 'crew_switch' ? 'Volunteer section switch' : r.student?.full_name ?? 'A camper'
            const target = r.kind === 'exception' && r.section_id ? targets.get(r.section_id) : undefined
            const where = r.kind === 'exception'
              ? `Exception for ${target ? `${target.cls?.name ?? 'a class'}, ${target.label}${target.week ? ` · Week ${target.week}` : ''}` : 'a class'}`
              : sec ? `${sec.classes?.name ?? ''}${sec.classes?.name ? ', ' : ''}${sec.label}${sec.week ? ` · Week ${sec.week}` : ''}` : null
            const first = r.student?.first_name?.trim() || r.student?.full_name.split(' ')[0] || 'the camper'
            const rules = target?.cls ? classRuleLine(target.cls, ruleClasses) : null
            // Agreeing means moving the camper's class that week into this one (admin moves skip the
            // rules). A camper with no class that week can't be signed up here until register-on-behalf.
            const weeks = r.student_id ? heldWeeks.get(r.student_id) ?? [] : []
            const canMove = !!target && weeks.some(w => w === null || target.week === null || w === target.week)
            const asker = r.requester?.display_name ?? (r.kind === 'crew_switch' ? 'a volunteer' : 'a parent')
            return (
              <li key={r.id} className="py-4 border-t-2 border-ink">
                <p className="text-lg font-bold leading-[1.3] text-pretty">{who}{where && <> · {where}</>}</p>
                <p className="mt-1 text-ink-muted">From {asker} · {timeAgo(r.created_at)}</p>
                {r.kind === 'exception' && (
                  <p className="mt-1 max-w-[68ch] text-pretty">
                    {rules && <>{rules} </>}{r.student?.grade ? `${first} is entering ${r.student.grade}.` : `No grade on file for ${first}.`}
                    {canMove && <> To agree, move {first}'s class that week into this one from their row below (admin moves skip the rules), then mark it done.</>}
                  </p>
                )}
                {r.message && <p className="mt-2 max-w-[68ch] text-pretty">“{r.message}”</p>}
                <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
                  <div className="flex-[1_1_320px] max-w-[480px] min-w-0">
                    <label htmlFor={`note-${r.id}`} className="block font-bold">Reply <span className="font-normal text-ink-muted">(optional)</span></label>
                    <Input id={`note-${r.id}`} className="mt-1.5" value={notes[r.id] ?? ''}
                      onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                  </div>
                  <div className="flex flex-wrap gap-x-5">
                    <button type="button" disabled={busy === r.id} onClick={() => { void resolve(r.id, 'done') }}
                      className="ui-btn ui-btn--text">Mark done</button>
                    <button type="button" disabled={busy === r.id} onClick={() => { void resolve(r.id, 'declined') }}
                      className="ui-btn ui-btn--text text-ink-muted font-semibold">Decline</button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
