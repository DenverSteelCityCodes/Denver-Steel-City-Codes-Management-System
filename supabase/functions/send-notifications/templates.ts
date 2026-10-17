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

function layout(title: string, paragraphs: string[], cta: { label: string; url: string } | null): string {
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
</td></tr></table></td></tr></table></body></html>`
}

function textVersion(title: string, paragraphs: string[], cta: { label: string; url: string } | null): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  return [title, '', ...paragraphs.map(strip), ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), '', `Questions? Reply to this email or write to ${CONTACT}.`].join('\n')
}

function build(subject: string, title: string, paragraphs: string[], cta: { label: string; url: string } | null): Rendered {
  return { subject, text: textVersion(title, paragraphs, cta), html: layout(title, paragraphs, cta) }
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
      return build(done ? 'Your change request is done' : 'About your change request', done ? 'Your change request is done' : 'About your change request', [
        `You asked: "${esc(p.message)}"`,
        p.note ? `The camp's reply: ${esc(p.note)}` : (done ? 'The camp has made the change.' : 'The camp couldn\'t make this change. Reply to this email if you\'d like to talk it through.'),
      ], dashboard)
    }

    default:
      return null
  }
}
