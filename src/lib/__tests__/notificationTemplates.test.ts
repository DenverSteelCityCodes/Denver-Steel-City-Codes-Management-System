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
