// Email templates for the notifications outbox (spec 09). Plain TypeScript with no Deno or browser
// APIs, so national can edit the wording without touching the sender. Every email: short, says what
// happened, which camper and class, what to do next, and how to reach the camp.

export interface Rendered { subject: string; text: string; html: string }
type Payload = Record<string, unknown>

const CONTACT = 'denver@steelcitycodes.org'

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function time(t: unknown): string {
  if (typeof t !== 'string' || !t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`
}

function dates(p: Payload): string {
  const fmt = (d: unknown) => typeof d === 'string'
    ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    : ''
  const a = fmt(p.start_date), b = fmt(p.end_date)
  return a && b ? `${a} – ${b}` : ''
}

// "Python · PY-A, Week 1 (June 7 – June 11), Mon–Fri 9:00 AM – 3:00 PM, Room 101"
function classLine(p: Payload): string {
  const parts = [
    `${p.class ?? 'the class'}${p.section ? ` · ${p.section}` : ''}`,
    p.week ? `Week ${p.week}${dates(p) ? ` (${dates(p)})` : ''}` : dates(p),
    p.start_time ? `${p.days ?? ''} ${time(p.start_time)}${p.end_time ? ` – ${time(p.end_time)}` : ''}`.trim() : '',
    p.room ? `Room ${p.room}` : '',
  ].filter(Boolean)
  return parts.join(', ')
}

// The notify-me emails (spec 30) end with their own unsubscribe link.
function layout(title: string, paragraphs: string[], cta: { label: string; url: string } | null, unsubscribe?: string): string {
  const body = paragraphs.map(t => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#4A4138">${t}</p>`).join('')
  const button = cta
    ? `<p style="margin:20px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#F1C446;color:#1A1613;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:10px">${esc(cta.label)}</a></p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#FAF6EF;font-family:'Josefin Sans',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EF;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E6DFD3;border-radius:14px">
<tr><td style="background:#1A1613;border-radius:14px 14px 0 0;padding:14px 20px;color:#F1C446;font-weight:700;letter-spacing:.02em">STEEL CITY CODES <span style="color:#CFC6B8;font-weight:400">// DENVER</span></td></tr>
<tr><td style="padding:22px 20px">
<h1 style="margin:0 0 14px;font-size:20px;color:#262019">${esc(title)}</h1>
${body}${button}
<p style="margin:18px 0 0;font-size:13px;color:#7A6E60">Questions? Reply to this email or write to <a href="mailto:${CONTACT}" style="color:#4A4138">${CONTACT}</a>.</p>
${unsubscribe ? `<p style="margin:10px 0 0;font-size:13px;color:#7A6E60">You asked to hear when camp registration opens. <a href="${esc(unsubscribe)}" style="color:#4A4138">Unsubscribe</a>.</p>` : ''}
</td></tr></table></td></tr></table></body></html>`
}

function textVersion(title: string, paragraphs: string[], cta: { label: string; url: string } | null, unsubscribe?: string): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  return [title, '', ...paragraphs.map(strip), ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), '', `Questions? Reply to this email or write to ${CONTACT}.`,
    ...(unsubscribe ? ['', `You asked to hear when camp registration opens. Unsubscribe: ${unsubscribe}`] : [])].join('\n')
}

function build(subject: string, title: string, paragraphs: string[], cta: { label: string; url: string } | null, unsubscribe?: string): Rendered {
  return { subject, text: textVersion(title, paragraphs, cta, unsubscribe), html: layout(title, paragraphs, cta, unsubscribe) }
}

// Returns null for an unknown template (the sender marks it failed).
export function render(template: string, p: Payload, appUrl: string): Rendered | null {
  const camper = esc(p.camper ?? 'Your camper')
  const dashboard = { label: 'Open your dashboard', url: `${appUrl}/parent` }
  const pickAnother = { label: 'Pick another class', url: `${appUrl}/parent/classes${p.student_id ? `?camper=${encodeURIComponent(String(p.student_id))}` : ''}` }
  const line = esc(classLine(p))

  switch (template) {
    case 'registration_confirmed':
      return build(`${p.camper ?? 'Your camper'} is confirmed for ${p.class ?? 'camp'}`, `${p.camper ?? 'Your camper'} is in!`, [
        `<strong>${camper}</strong>'s spot is confirmed: ${line}.`,
        'Nothing else to do for now. We\'ll share the daily schedule before camp starts, and you can always see the class, time and room on your dashboard.',
      ], dashboard)

    case 'registration_waitlisted':
      return build(`${p.camper ?? 'Your camper'} is on the waitlist for ${p.class ?? 'a class'}`, 'You\'re on the waitlist', [
        `${esc(p.class)} is full, so <strong>${camper}</strong> is on its waitlist: ${line}.`,
        'If a spot opens, we\'ll email you an offer to claim it. Spots go in the order families joined the waitlist.',
      ], dashboard)

    case 'registration_moved':
      return build(`${p.camper ?? 'Your camper'} has moved to ${p.class ?? 'a new class'}`, 'Class change', [
        `<strong>${camper}</strong> has moved${p.from_class ? ` from ${esc(p.from_class)}` : ''} to ${line}.`,
        'If you didn\'t expect this change, reply to this email and we\'ll sort it out.',
      ], dashboard)

    case 'registration_cancelled': {
      const reason = String(p.cancel_reason ?? '')
      if (reason === 'section_cancelled') {
        return build(`${p.class ?? 'A class'} was cancelled`, 'We\'re sorry: this class was cancelled', [
          `We had to cancel ${line}, so <strong>${camper}</strong> no longer has a spot in it.`,
          'You can pick another class now, and you\'re first in line on that week\'s waitlists.',
        ], pickAnother)
      }
      if (reason === 'parent_cancel') {
        return build(`You cancelled ${p.camper ?? 'your camper'}'s spot in ${p.class ?? 'a class'}`, 'Spot cancelled', [
          `As you asked, <strong>${camper}</strong>'s spot in ${line} is cancelled. The seat goes to the next family on the waitlist.`,
          'Changed your mind? You can sign up again while there are spots.',
        ], dashboard)
      }
      if (reason === 'offer_expired' || reason === 'declined_offer') {
        return build(`The waitlist offer for ${p.camper ?? 'your camper'} has ended`, 'Waitlist offer ended', [
          reason === 'declined_offer'
            ? `You declined the spot in ${line}, so it went to the next family.`
            : `The offer for <strong>${camper}</strong> in ${line} wasn't claimed in time, so it went to the next family.`,
          'You can join the waitlist again anytime from the class list.',
        ], dashboard)
      }
      if (reason === 'took_other_seat') {
        return build(`${p.camper ?? 'Your camper'} left the ${p.class ?? ''} waitlist`, 'Waitlist updated', [
          `<strong>${camper}</strong> now has a spot in another class that week, so we took them off the waitlist for ${line}.`,
        ], dashboard)
      }
      return build(`${p.camper ?? 'Your camper'}'s spot in ${p.class ?? 'a class'} was cancelled`, 'Registration cancelled', [
        `<strong>${camper}</strong>'s registration for ${line} has been cancelled by the camp.`,
        'If you have questions, reply to this email.',
      ], dashboard)
    }

    case 'waitlist_offer':
    case 'offer_expiring': {
      const until = typeof p.offer_expires_at === 'string'
        ? new Date(p.offer_expires_at).toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'soon'
      const claim = { label: 'Claim the spot', url: `${appUrl}/parent` }
      return template === 'waitlist_offer'
        ? build(`A spot opened for ${p.camper ?? 'your camper'} in ${p.class ?? 'a class'}`, 'A spot opened up!', [
            `A seat opened in ${line}, and <strong>${camper}</strong> is next on the waitlist.`,
            `<strong>Claim it by ${esc(until)} (Denver time)</strong> from your dashboard. If you don't, it goes to the next family. Not interested? Decline it there, and the next family gets it sooner.`,
          ], claim)
        : build(`Reminder: claim ${p.camper ?? 'your camper'}'s spot by ${until}`, 'Your offer ends soon', [
            `The spot for <strong>${camper}</strong> in ${line} is held until <strong>${esc(until)} (Denver time)</strong>.`,
            'Claim or decline it on your dashboard.',
          ], claim)
    }

    case 'new_lead':
      // Spec 25: the section's lead was replaced (a volunteer couldn't make it, or a crew change).
      return build(`${p.camper ?? 'Your camper'}'s lead for ${p.class ?? 'camp'} has changed`, 'A new lead for your class', [
        `<strong>${camper}</strong>'s lead in ${esc(p.class)}${p.section ? ` · ${esc(p.section)}` : ''}${p.week ? `, Week ${esc(p.week)}` : ''} is now <strong>${esc(p.lead)}</strong>.`,
        'Nothing changes for drop-off, pickup or the room. Updates from the class keep coming to your dashboard.',
      ], dashboard)

    case 'change_request_resolved': {
      const done = p.status === 'done'
      // A volunteer's crew switch request (spec 25): volunteer wording and the volunteer area.
      if (p.kind === 'crew_switch') {
        return build(done ? 'Your crew switch is done' : 'About your crew switch request', done ? 'Your crew switch is done' : 'About your crew switch request', [
          `You asked: "${esc(p.message)}"`,
          p.note ? `The camp's reply: ${esc(p.note)}` : (done ? 'The camp has updated your crew. Check your section on your volunteer page.' : 'The camp couldn\'t make this switch. Reply to this email if you\'d like to talk it through.'),
        ], { label: 'Open your volunteer page', url: `${appUrl}/volunteer` })
      }
      return build(done ? 'Your change request is done' : 'About your change request', done ? 'Your change request is done' : 'About your change request', [
        `You asked: "${esc(p.message)}"`,
        p.note ? `The camp's reply: ${esc(p.note)}` : (done ? 'The camp has made the change.' : 'The camp couldn\'t make this change. Reply to this email if you\'d like to talk it through.'),
      ], dashboard)
    }

    // Spec 30: the notify-me list. The payload carries the camp year and a signed token; the links
    // open /camp/confirm or /camp/unsubscribe, which ask for a press before acting.
    case 'interest_confirm': {
      const confirm = `${appUrl}/camp/confirm?t=${encodeURIComponent(String(p.token ?? ''))}`
      return build('Confirm: email me when camp registration opens', 'Confirm your email', [
        `Someone, we hope you, asked Steel City Codes Denver to email this address when registration opens for the ${esc(p.year ?? '')} coding camp.`,
        'Press the button to confirm. If you didn\'t ask, ignore this email and you won\'t be added.',
      ], { label: 'Yes, email me', url: confirm })
    }

    case 'registration_opening_soon': {
      const when = typeof p.opens_at === 'string'
        ? new Date(p.opens_at).toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'soon'
      return build(`Camp registration opens ${when} (Denver time)`, 'Registration opens soon', [
        `Registration for the ${esc(p.year ?? '')} coding camp opens <strong>${esc(when)} (Denver time)</strong>.`,
        'Spots are first come, first served. The dates, the place, the classes and what to bring are on the camp page.',
      ], { label: 'See the camp page', url: `${appUrl}/camp` }, unsubscribeUrl(p, appUrl))
    }

    case 'registration_now_open':
      return build('Camp registration is open', 'Registration is open', [
        `Registration for the ${esc(p.year ?? '')} coding camp is open now. Spots are first come, first served.`,
        'Make a parent account, or sign in if you have one, and register your camper.',
      ], { label: 'Register a camper', url: `${appUrl}/camp` }, unsubscribeUrl(p, appUrl))

    // Spec 34: an admin's urgent safety notice, sent to everyone in the post's audience at once.
    // It ignores the announcements opt-out, so it says why it arrived.
    case 'urgent_notice': {
      const body = String(p.body ?? '').trim()
      const first = body.split('\n')[0].trim()
      const posted = typeof p.posted_at === 'string'
        ? new Date(p.posted_at).toLocaleString('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit', weekday: 'long' })
        : ''
      return build(`Urgent camp notice: ${first.length > 60 ? `${first.slice(0, 57)}…` : first}`, 'Urgent camp notice', [
        ...textParagraphs(body),
        `Sent by ${esc(p.author ?? 'the camp')}${posted ? ` on ${esc(posted)} (Denver time)` : ''}. This is a safety notice, so it reaches you even if you turned off camp announcements.`,
      ], { label: 'Open the camp site', url: `${appUrl}/` })
    }

    // Spec 34: an admin tells a camper's family about an incident, in the admin's own words.
    case 'incident_notice': {
      const on = typeof p.occurred_at === 'string'
        ? new Date(p.occurred_at).toLocaleDateString('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'long', day: 'numeric' })
        : ''
      const what: Record<string, string> = {
        injury: 'an injury', behavior: 'a behavior concern', conduct: 'a concern about a crew member’s conduct',
        safety: 'a safety concern', other: 'something we want you to know about',
      }
      const where = `${esc(p.class ?? 'camp')}${p.section ? ` · ${esc(p.section)}` : ''}`
      return build(`About ${p.camper ?? 'your camper'} at camp${on ? ` on ${on}` : ''}`, `A note from camp about ${p.camper ?? 'your camper'}`, [
        `We're writing about <strong>${camper}</strong> in ${where}${on ? ` on ${esc(on)}` : ''}: ${what[String(p.kind)] ?? what.other}.`,
        ...textParagraphs(String(p.message ?? '')),
        'Please reply to this email if you have questions or would like to talk it through.',
      ], dashboard)
    }

    // Spec 29: loaner laptops, one per camper-week. Loaners stay at camp; requests past the week's
    // cap wait in a first-come queue, and the payload's position is the place in it.
    case 'laptop_reserved':
      return build(`A loaner laptop is reserved for ${p.camper ?? 'your camper'}`, 'Laptop reserved', [
        `<strong>${camper}</strong> has a loaner laptop reserved for ${line}.`,
        `Loaners stay at camp: ${camper} uses it in class and leaves it there each day. If ${camper} won't need it after all, release it on your dashboard so the next family gets it.`,
      ], dashboard)

    case 'laptop_queued': {
      const place = Number(p.position) > 0 ? ` <strong>number ${esc(p.position)}</strong> in` : ' in'
      return build(`${p.camper ?? 'Your camper'} is in the laptop queue`, 'You\'re in the laptop queue', [
        `Every loaner laptop for that week is spoken for, so <strong>${camper}</strong> is${place} the laptop queue for ${line}.`,
        'Loaners go in the order families asked. If one frees up, we\'ll reserve it for you and email you. Any laptop or Chromebook with a web browser works, or an iPad with a keyboard: if you find one, leave the queue on your dashboard.',
      ], dashboard)
    }

    case 'laptop_promoted':
      return build(`A loaner laptop opened up for ${p.camper ?? 'your camper'}`, 'A laptop opened up', [
        `A loaner laptop freed up, and it's now reserved for <strong>${camper}</strong>: ${line}.`,
        `Nothing else to do. Loaners stay at camp: ${camper} uses it in class and leaves it there each day. If you don't need it any more, release it on your dashboard.`,
      ], dashboard)

    case 'laptop_released': {
      const reason = String(p.reason ?? '')
      if (reason === 'spot_ended') {
        return build(`${p.camper ?? 'Your camper'}'s laptop request was released`, 'Laptop request released', [
          `<strong>${camper}</strong> no longer has a spot in ${line}, so the loaner laptop request went with it.`,
          `If ${camper} gets a spot in another class and still needs a laptop, request one on your dashboard.`,
        ], dashboard)
      }
      if (reason === 'admin') {
        return build(`The camp released ${p.camper ?? 'your camper'}'s laptop request`, 'Laptop request released', [
          `The camp released the loaner laptop request for <strong>${camper}</strong> in ${line}.`,
          'If that\'s a surprise, reply to this email and we\'ll sort it out.',
        ], dashboard)
      }
      return build(p.was === 'queued' ? `You left the laptop queue for ${p.camper ?? 'your camper'}` : `You released ${p.camper ?? 'your camper'}'s loaner laptop`, 'Laptop released', [
        p.was === 'queued'
          ? `As you asked, <strong>${camper}</strong> is out of the laptop queue for ${line}.`
          : `As you asked, the loaner laptop for <strong>${camper}</strong> in ${line} is released. It goes to the next family in the queue.`,
        'Need one after all? You can ask again on your dashboard until the week starts.',
      ], dashboard)
    }

    // Spec 36: to a section's lead, when a family changes who may collect a camper (or the walk-home
    // consent) during camp week. At most one per camper and 10 minutes, so it never says what
    // changed (a later removal would be hidden): the roll call's dismissal list has the current list.
    case 'pickup_changed':
      return build(`Pickup change for ${p.camper ?? 'a camper'}`, 'Pickup change', [
        `The pickup list for <strong>${esc(p.camper ?? 'a camper')}</strong> changed; the roll call shows the current list.`,
        `${esc(p.class ?? 'Your class')}${p.section ? ` · ${esc(p.section)}` : ''}${p.session ? `, ${esc(p.session)}` : ''}. Check it before dismissal.`,
      ], { label: 'Open roll call', url: `${appUrl}/volunteer` })

    default:
      return null
  }
}

// A plain-text message as escaped paragraphs: blank lines split paragraphs, single line breaks stay.
function textParagraphs(text: string): string[] {
  return text.trim() ? text.trim().split(/\n\s*\n/).map(t => esc(t.trim()).replace(/\n/g, '<br>\n')) : []
}

function unsubscribeUrl(p: Payload, appUrl: string): string {
  return `${appUrl}/camp/unsubscribe?t=${encodeURIComponent(String(p.token ?? ''))}`
}
