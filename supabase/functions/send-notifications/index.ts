// send-notifications: drains the notifications outbox (spec 09). Called every minute by pg_cron
// (migration_notifications.sql). Claims up to 50 due emails, renders each template, sends it
// through the provider and records the result; failures retry up to 3 times.
// Urgent safety notices (spec 34, priority > 0) go first: up to 300 per run through the
// provider's batch endpoint, 100 per call, so a whole week's families have them within two minutes.
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return json({ sent: 0, note: 'RESEND_API_KEY is not set; emails stay queued.' })

  const from = Deno.env.get('NOTIFY_FROM') ?? 'Steel City Codes Denver <no-reply@steelcitycodes.org>'
  const replyTo = Deno.env.get('NOTIFY_REPLY_TO') ?? 'denver@steelcitycodes.org'
  const appUrl = (Deno.env.get('APP_URL') ?? 'https://scc.haanie.com').replace(/\/$/, '')
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  type Row = { id: number; attempts: number; recipient_email: string | null; template: string; payload: Record<string, unknown> }
  let sent = 0, failed = 0, waiting = 0

  // A row this run can't send: an unknown template is held, a missing address fails. Returns the
  // rendered email otherwise.
  async function prepare(row: Row) {
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
      return null
    }
    if (!row.recipient_email) {
      await db.rpc('finish_notification', { p_id: row.id, p_ok: false, p_error: 'No recipient address' })
      failed++
      return null
    }
    return { from, to: [row.recipient_email], reply_to: replyTo, subject: email.subject, html: email.html, text: email.text }
  }

  // ── Urgent first, in bulk (spec 34). A database without the urgent claim yet just skips this. ──
  const { data: urgent, error: urgentError } = await db.rpc('claim_urgent_notifications', { p_limit: 300 })
  if (urgentError) console.warn(`send-notifications: no urgent claim (${urgentError.message}); sending in order`)
  const ready: { id: number; message: Record<string, unknown> }[] = []
  for (const row of (urgent ?? []) as Row[]) {
    const message = await prepare(row)
    if (message) ready.push({ id: row.id, message })
  }
  for (let i = 0; i < ready.length; i += 100) {
    const chunk = ready.slice(i, i + 100)
    let ok = false, detail: string | null = null
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map(c => c.message)),
      })
      ok = res.ok
      detail = res.ok ? null : `${res.status} ${(await res.text()).slice(0, 400)}`
    } catch (e) {
      detail = e instanceof Error ? e.message : String(e)
    }
    // The batch is all or nothing: every row in it is sent, or every row retries.
    await Promise.all(chunk.map(c => db.rpc('finish_notification', { p_id: c.id, p_ok: ok, p_error: detail })))
    if (ok) sent += chunk.length; else failed += chunk.length
  }

  // ── Everything else, one email per call, highest priority then oldest ──
  const { data: rows, error } = await db.rpc('claim_notifications', { p_limit: 50 })
  if (error) return json({ error: error.message, sent, failed, waiting }, 500)

  for (const row of (rows ?? []) as Row[]) {
    const message = await prepare(row)
    if (!message) continue
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
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
