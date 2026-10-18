import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import SeatGrid from '../SeatGrid'
import SignBand from '../SignBand'
import type { ClassWithSections } from '../../hooks/useAdminClasses'

const render = (ui: React.ReactElement) => renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>)

const pyA = {
  id: 's1', class_id: 'c1', label: 'PY-A', age_min: 9, age_max: 13, capacity: 10, week: 1 as const, lead_id: null,
  days: 'Mon–Fri', start_time: null, end_time: null, room: null, created_at: '', lead: null, supports: [],
  registered_count: 10, waitlist_count: 1,
}
const python = { id: 'c1', name: 'Intro to Python', sections: [pyA], enrolled: 10, total_capacity: 10 } as unknown as ClassWithSections

describe('Today › Seats', () => {
  it("says the sections couldn't load instead of claiming there are none", () => {
    const html = render(<SeatGrid classes={[]} weeks={[]} countsMissing={false} error="Failed to fetch" />)
    expect(html).toContain("Couldn&#x27;t load the sections")
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('No sections yet')
  })

  it('says there are no sections only after a good read', () => {
    expect(render(<SeatGrid classes={[]} weeks={[]} countsMissing={false} />)).toContain('No sections yet')
  })

  it('shows a full section in ink with its waitlist and no lead, linked to its class', () => {
    const html = render(<SeatGrid classes={[python]} weeks={[]} countsMissing={false} />)
    expect(html).toContain('10/10')
    expect(html).toContain('1 wait')
    expect(html).toContain('No lead')
    expect(html).toContain('href="/admin/classes?open=c1"')
    expect(html).toContain('bg-ink')
    expect(html).not.toMatch(/danger|alarm/)
  })

  it('shows capacity, never zeros, when the seat counts did not load', () => {
    const html = render(<SeatGrid classes={[python]} weeks={[]} countsMissing />)
    expect(html).toContain('10 seats')
    expect(html).not.toContain('10/10')
  })
})

describe('SignBand', () => {
  it('leads with the message when there is no figure to show', () => {
    const html = render(<SignBand context="Registration" message="Couldn't check whether registration is open" to="/admin/sessions" label="x" />)
    expect(html).toContain('Couldn&#x27;t check whether registration is open')
    expect(html).not.toContain('text-[3.5rem]')
  })
})
