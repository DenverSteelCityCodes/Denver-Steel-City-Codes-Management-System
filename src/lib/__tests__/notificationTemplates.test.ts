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

describe('volunteer interviews and onboarding (spec 35)', () => {
  const booked = { first_name: 'Riley', application_id: 'app-1', slot_id: 'slot-1', slot_datetime: '2026-10-20T22:00:00Z', duration_minutes: 15, meeting_url: 'https://meet.example.com/abc-defg' }

  it('books in Denver time, with the private link, a link to the volunteer area and an .ics file', () => {
    const r = render('interview_booked', booked, APP)!
    expect(r.subject).toBe('Your interview is booked: Tuesday, October 20 at 4:00 PM')
    expect(r.text).toContain('Hi Riley')
    expect(r.text).toContain('https://meet.example.com/abc-defg')
    expect(r.text).toContain(`${APP}/volunteer`)
    expect(r.text).not.toContain('/parent')
    expect(r.attachments).toHaveLength(1)
    const ics = r.attachments![0]
    expect(ics.filename).toBe('interview.ics')
    expect(ics.contentType).toBe('text/calendar')
    expect(ics.content).toContain('DTSTART:20261020T220000Z')
    expect(ics.content).toContain('DTEND:20261020T221500Z')
    expect(ics.content).toContain('URL:https://meet.example.com/abc-defg')
    expect(ics.content.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })

  it('says when a booking moved, and promises the link when there is none yet', () => {
    const r = render('interview_booked', { ...booked, moved: true, meeting_url: null }, APP)!
    expect(r.subject).toBe('Your interview moved to Tuesday, October 20 at 4:00 PM')
    expect(r.text).toContain('The meeting link will be on your application page')
    expect(r.attachments![0].content).toContain('LOCATION:Online')
  })

  it('never uses a link that is not https', () => {
    const r = render('interview_reminder', { ...booked, kind: '1h', meeting_url: 'javascript:alert(1)' }, APP)!
    expect(r.html).not.toContain('javascript:')
    expect(r.text).toContain(`Open your application: ${APP}/volunteer`)
  })

  it('reminds 24 hours and 1 hour before, with the link as the button', () => {
    const day = render('interview_reminder', { ...booked, kind: '24h' }, APP)!
    expect(day.subject).toBe('Reminder: your interview is Tuesday, October 20 at 4:00 PM')
    expect(day.text).toContain('Join the interview: https://meet.example.com/abc-defg')
    const hour = render('interview_reminder', { ...booked, kind: '1h' }, APP)!
    expect(hour.subject).toBe('Your interview starts in an hour')
  })

  it('posts new times and nudges, pointing at the application page', () => {
    const posted = render('interview_times_posted', { first_name: 'Riley', first_slot: '2026-10-21T22:30:00Z' }, APP)!
    expect(posted.text).toContain('starting Wednesday, October 21 at 4:30 PM (Denver time)')
    expect(posted.text).toContain(`Pick a time: ${APP}/volunteer`)
    expect(render('interview_nudge', { first_name: 'Riley', open_times: 3 }, APP)!.text).toContain('3 times are open right now')
    expect(render('interview_nudge', { first_name: 'Riley', open_times: 0 }, APP)!.text).toContain("We'll email you as soon as new ones are posted")
  })

  it('welcomes an accepted volunteer with the checklist and its deadlines', () => {
    const r = render('application_accepted', { first_name: 'Riley', tasks: [{ label: 'Join the crew Discord', due_hours: 24 }, { label: 'Read the welcome doc', due_hours: 48 }, { label: 'Quick one', due_hours: 6 }] }, APP)!
    expect(r.subject).toBe('Welcome to the crew, Riley!')
    expect(r.text).toContain('• Join the crew Discord (within 1 day)')
    expect(r.text).toContain('• Read the welcome doc (within 2 days)')
    expect(r.text).toContain('• Quick one (within 6 hours)')
  })

  it('declines and removes kindly, with the camp\'s note escaped', () => {
    expect(render('application_declined', { first_name: 'Riley' }, APP)!.text).toContain("We weren't able to offer you a spot this year")
    const removed = render('volunteer_removed', { first_name: 'Sam', year: 2027, reason: 'Missed <b>onboarding</b>' }, APP)!
    expect(removed.subject).toBe("You're no longer on the 2027 volunteer crew")
    expect(removed.html).toContain('Missed &lt;b&gt;onboarding&lt;/b&gt;')
  })
})
