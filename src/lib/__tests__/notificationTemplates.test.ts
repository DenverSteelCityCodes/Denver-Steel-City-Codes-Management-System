import { describe, expect, it } from 'vitest'
import { render } from '../../../supabase/functions/send-notifications/templates'

const APP = 'https://camp.example'

describe('change_request_resolved', () => {
  it('sends parents to the parent dashboard', () => {
    const r = render('change_request_resolved', { status: 'done', message: 'Move to Java', kind: 'swap', camper: 'Ava' }, APP)!
    expect(r.subject).toBe('Your change request is done')
    expect(r.text).toContain(`${APP}/parent`)
  })
  it('still works for requests queued before the kind was added', () => {
    const r = render('change_request_resolved', { status: 'declined', message: 'Move to Java' }, APP)!
    expect(r.subject).toBe('About your change request')
    expect(r.text).toContain(`${APP}/parent`)
  })
  it('writes to volunteers about crew switches and links to the volunteer area', () => {
    const done = render('change_request_resolved', { status: 'done', message: 'Afternoon Java?', kind: 'crew_switch' }, APP)!
    expect(done.subject).toBe('Your crew switch is done')
    expect(done.text).toContain(`${APP}/volunteer`)
    expect(done.text).not.toContain('/parent')
    expect(done.html).not.toMatch(/camper/i)
    const declined = render('change_request_resolved', { status: 'declined', message: 'Afternoon Java?', note: 'That section is full', kind: 'crew_switch' }, APP)!
    expect(declined.subject).toBe('About your crew switch request')
    expect(declined.text).toContain("The camp's reply: That section is full")
  })
})

describe('notify-me list (spec 30)', () => {
  it('asks for a confirmation through /camp/confirm, with no unsubscribe line yet', () => {
    const r = render('interest_confirm', { year: 2027, token: 'abc.def' }, APP)!
    expect(r.subject).toBe('Confirm: email me when camp registration opens')
    expect(r.text).toContain(`${APP}/camp/confirm?t=abc.def`)
    expect(r.text).not.toContain('Unsubscribe')
  })
  it('announces the opening time in Denver time, with a working unsubscribe link', () => {
    const r = render('registration_opening_soon', { year: 2027, opens_at: '2027-02-06T16:00:00Z', token: 'abc.def' }, APP)!
    expect(r.subject).toContain('February 6')
    expect(r.subject).toContain('(Denver time)')
    expect(r.text).toContain('9:00 AM')
    expect(r.text).toContain(`${APP}/camp`)
    expect(r.text).toContain(`Unsubscribe: ${APP}/camp/unsubscribe?t=abc.def`)
    expect(r.html).toContain(`href="${APP}/camp/unsubscribe?t=abc.def"`)
  })
  it('says registration is open, with a working unsubscribe link', () => {
    const r = render('registration_now_open', { year: 2027, token: 'abc.def' }, APP)!
    expect(r.subject).toBe('Camp registration is open')
    expect(r.text).toContain(`Unsubscribe: ${APP}/camp/unsubscribe?t=abc.def`)
  })
})

describe('laptop loans (spec 29)', () => {
  const base = { camper: 'Ava', class: 'Intro to Python', section: 'PY-A', week: 2, start_date: '2027-06-14', end_date: '2027-06-18', student_id: 's1' }
  it('has a template for every laptop email the migration queues', () => {
    for (const t of ['laptop_reserved', 'laptop_queued', 'laptop_promoted', 'laptop_released']) {
      expect(render(t, base, APP), t).not.toBeNull()
    }
  })
  it('says loaners stay at camp and links to the dashboard', () => {
    const r = render('laptop_reserved', base, APP)!
    expect(r.subject).toBe('A loaner laptop is reserved for Ava')
    expect(r.text).toContain('Intro to Python · PY-A, Week 2 (June 14 – June 18)')
    expect(r.text).toContain('stay at camp')
    expect(r.text).toContain(`${APP}/parent`)
  })
  it('gives the place in the queue, and copes without one', () => {
    expect(render('laptop_queued', { ...base, position: 3 }, APP)!.text).toContain('Ava is number 3 in the laptop queue')
    expect(render('laptop_queued', base, APP)!.text).toContain('Ava is in the laptop queue')
  })
  it('words a release by who released it', () => {
    expect(render('laptop_released', { ...base, reason: 'parent', was: 'reserved' }, APP)!.subject).toBe("You released Ava's loaner laptop")
    expect(render('laptop_released', { ...base, reason: 'parent', was: 'queued' }, APP)!.subject).toBe('You left the laptop queue for Ava')
    expect(render('laptop_released', { ...base, reason: 'spot_ended', was: 'reserved' }, APP)!.text).toContain('no longer has a spot')
    expect(render('laptop_released', { ...base, reason: 'admin' }, APP)!.subject).toBe("The camp released Ava's laptop request")
  })
  it('escapes names in the HTML', () => {
    expect(render('laptop_promoted', { ...base, camper: '<b>Ava</b>' }, APP)!.html).not.toContain('<b>Ava</b>')
  })
})
