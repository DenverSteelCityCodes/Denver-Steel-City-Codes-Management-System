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

describe('urgent notices and incidents (spec 34)', () => {
  it('sends the urgent notice in full, escaped, with why it arrived', () => {
    const r = render('urgent_notice', {
      body: 'Site hold at the school.\nStay in your rooms.\n\nPickup <may> be late.', author: 'Jordan Rivera', posted_at: '2026-07-14T16:05:00Z',
    }, APP)!
    expect(r.subject).toBe('Urgent camp notice: Site hold at the school.')
    expect(r.html).toContain('Site hold at the school.<br>')
    expect(r.html).toContain('Pickup &lt;may&gt; be late.')
    expect(r.text).toContain('Stay in your rooms.')
    expect(r.text).toContain('even if you turned off camp announcements')
    expect(r.text).toContain('10:05 AM')
  })
  it('shortens a long first line in the subject', () => {
    const r = render('urgent_notice', { body: 'x'.repeat(100) }, APP)!
    expect(r.subject.length).toBeLessThanOrEqual('Urgent camp notice: '.length + 58)
  })
  it("tells the family about an incident in the admin's words, not the crew's", () => {
    const r = render('incident_notice', {
      camper: 'Ava', class: 'Intro to Python', section: 'PY-A', kind: 'injury', occurred_at: '2026-07-14T17:30:00Z',
      message: 'She scraped her knee at recess. We cleaned it and she rejoined the class.',
    }, APP)!
    expect(r.subject).toBe('About Ava at camp on Tuesday, July 14')
    expect(r.text).toContain('an injury')
    expect(r.text).toContain('She scraped her knee')
    expect(r.text).toContain(`${APP}/parent`)
  })
  it('has a sensible incident notice with no message', () => {
    const r = render('incident_notice', { camper: 'Ava', kind: 'nonsense' }, APP)!
    expect(r.text).toContain('something we want you to know about')
  })
})
