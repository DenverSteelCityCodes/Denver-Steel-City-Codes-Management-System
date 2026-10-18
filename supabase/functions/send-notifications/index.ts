// send-notifications: drains the notifications outbox (spec 09). Called every minute by pg_cron
// (migration_notifications.sql). Claims up to 50 due emails, renders each template, sends it
// through the provider and records the result; failures retry up to 3 times.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   the provider key. Without it nothing is sent and rows stay queued.
//   NOTIFY_FROM      sender, e.g. "Steel City Codes Denver <no-reply@steelcitycodes.org>"
//                    (the domain must be verified with the provider: SPF/DKIM, spec 02).
//   NOTIFY_REPLY_TO  defaults to denver@steelcitycodes.org.
//   APP_URL          links in emails, e.g. https://register.steelcitycodes.org.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { render } from './templates.ts'

// UTF-8 text → base64 (btoa alone only takes Latin-1).
const base64 = (text: string) => {
  let bin = ''
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b)
  return btoa(bin)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return json({ sent: 0, note: 'RESEND_API_KEY is not set; emails stay queued.' })

  const from = Deno.env.get('NOTIFY_FROM') ?? 'Steel City Codes Denver <no-reply@steelcitycodes.org>'
  const replyTo = Deno.env.get('NOTIFY_REPLY_TO') ?? 'denver@steelcitycodes.org'
  const appUrl = (Deno.env.get('APP_URL') ?? 'https://scc.haanie.com').replace(/\/$/, '')
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: rows, error } = await db.rpc('claim_notifications', { p_limit: 50 })
  if (error) return json({ error: error.message }, 500)

  let sent = 0, failed = 0, waiting = 0
  for (const row of (rows ?? []) as { id: number; attempts: number; recipient_email: string | null; template: string; payload: Record<string, unknown> }[]) {
    const email = render(row.template, row.payload ?? {}, appUrl)
    if (!email) {
      // A template this deploy doesn't know yet (a migration ran before the function was
      // redeployed): put the row back as it was, without using up an attempt, and look again in
      // 6 hours. Failing it would lose the email for good, since the job that queued it has
      // already marked it sent and its dedupe key blocks a second copy. The long hold matters:
      // the claim takes the oldest due rows first, so held rows due every few minutes would fill
      // every batch and starve registration confirmations and waitlist offers.
      console.warn(`send-notifications: unknown template "${row.template}" (notification ${row.id}); held 6 hours, until this function is redeployed with it`)
      await db.from('notifications').update({
        status: 'queued',
        attempts: Math.max(0, (row.attempts ?? 1) - 1),
        next_attempt_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
        last_error: `Waiting for a sender that knows the template ${row.template}`,
      }).eq('id', row.id)
      waiting++
      continue
    }
    if (!row.recipient_email) {
      await db.rpc('finish_notification', { p_id: row.id, p_ok: false, p_error: 'No recipient address' })
      failed++
      continue
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [row.recipient_email], reply_to: replyTo, subject: email.subject, html: email.html, text: email.text,
          // Spec 35: the interview's calendar file. The provider takes base64 content.
          ...(email.attachments?.length ? { attachments: email.attachments.map(a => ({ filename: a.filename, content: base64(a.content), content_type: a.contentType })) } : {}),
        }),
      })
      const detail = res.ok ? null : `${res.status} ${(await res.text()).slice(0, 400)}`
      await db.rpc('finish_notification', { p_id: row.id, p_ok: res.ok, p_error: detail })
      if (res.ok) sent++; else failed++
    } catch (e) {
      await db.rpc('finish_notification', { p_id: row.id, p_ok: false, p_error: e instanceof Error ? e.message : String(e) })
      failed++
    }
  }
  return json({ sent, failed, waiting })
})
