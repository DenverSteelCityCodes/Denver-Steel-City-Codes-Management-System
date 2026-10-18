// send-notifications: drains the notifications outbox (spec 09). Called every minute by pg_cron
// (migration_notifications.sql). Claims up to 50 due emails, renders each template, sends it
// through the provider and records the result; failures retry up to 3 times.
// Urgent safety notices (spec 34, priority > 0) go first: up to 300 per run through the
// provider's batch endpoint, 100 per call, so a whole week's families have them within two minutes.
// Every provider call is idempotent, paced and retried when its outcome is unknown (see below).
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

  // ── Talking to the provider (spec 34) ──
  // Every call carries an Idempotency-Key made from the notification ids, so a retry of a call
  // whose answer was lost (timeout, dropped connection, 5xx) can't send the same email twice. An
  // ambiguous failure is retried unchanged in this run before the rows are marked failed. Calls are
  // spaced 550 ms apart (the provider allows about 2 a second). A 429 puts the rows back without
  // using up an attempt. The run stops starting new calls well before the platform's time limit
  // and puts back what it didn't try; if it dies anyway, the claim time stamped on each row lets
  // private.requeue_stuck_notifications() put them back after 15 minutes.
  const started = Date.now()
  const timeLeft = () => 110_000 - (Date.now() - started)
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  let lastCall = 0
  async function pace() {
    const wait = lastCall + 550 - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
  }
  async function idempotencyKey(kind: string, ids: number[]) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ids.join(',')))
    return `scc-${kind}-${[...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')}`
  }

  type Outcome = { kind: 'ok' | 'rejected' | 'rate_limited' | 'ambiguous'; detail: string | null }
  async function call(url: string, body: unknown, idemKey: string): Promise<Outcome> {
    let detail: string | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        if (timeLeft() < 20_000) break
        await sleep(1000 * attempt)
      }
      await pace()
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        })
        if (res.ok) return { kind: 'ok', detail: null }
        detail = `${res.status} ${(await res.text()).slice(0, 400)}`
        if (res.status === 429) return { kind: 'rate_limited', detail }
        // 409: the same key is still being processed, so the outcome isn't known yet; like a 5xx.
        if (res.status < 500 && res.status !== 409) return { kind: 'rejected', detail }
      } catch (e) {
        detail = e instanceof Error ? e.message : String(e)
      }
    }
    return { kind: 'ambiguous', detail }
  }

  const finish = (ids: number[], ok: boolean, detail: string | null) =>
    Promise.all(ids.map(id => db.rpc('finish_notification', { p_id: id, p_ok: ok, p_error: detail })))
  // Back in the queue without using up an attempt.
  const requeue = (ids: number[], delaySeconds: number) =>
    ids.length ? db.rpc('requeue_notifications', { p_ids: ids, p_delay_seconds: delaySeconds }) : Promise.resolve()

  async function sendOne(id: number, message: Record<string, unknown>) {
    const out = await call('https://api.resend.com/emails', message, await idempotencyKey('one', [id]))
    if (out.kind === 'ok') { await finish([id], true, null); sent++ }
    else if (out.kind === 'rate_limited') { await requeue([id], 60); waiting++ }
    else { await finish([id], false, out.detail); failed++ }
  }

  // Sends one by one until time runs short; whatever is left goes back to the queue untried.
  async function sendEach(items: { id: number; message: Record<string, unknown> }[]) {
    for (let i = 0; i < items.length; i++) {
      if (timeLeft() < 15_000) { await requeue(items.slice(i).map(x => x.id), 0); waiting += items.length - i; return }
      await sendOne(items[i].id, items[i].message)
    }
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
    const ids = chunk.map(c => c.id)
    if (timeLeft() < 20_000) {
      await requeue(ready.slice(i).map(c => c.id), 0)
      waiting += ready.length - i
      break
    }
    const out = await call('https://api.resend.com/emails/batch', chunk.map(c => c.message), await idempotencyKey('batch', ids))
    if (out.kind === 'ok') {
      await finish(ids, true, null)
      sent += chunk.length
    } else if (out.kind === 'rejected') {
      // The batch is all or nothing: one address the provider rejects would hold back the rest.
      // Send this chunk one by one instead (paced), so only the bad address fails.
      await sendEach(chunk)
    } else if (out.kind === 'rate_limited') {
      await requeue(ready.slice(i).map(c => c.id), 60)
      waiting += ready.length - i
      break
    } else {
      // Still no answer after the retries: these rows try again in 5 minutes, with the same keys.
      await finish(ids, false, out.detail)
      failed += chunk.length
    }
  }

  // ── Everything else, one email per call, highest priority then oldest ──
  if (timeLeft() < 40_000) return json({ sent, failed, waiting, note: 'Out of time; the rest waits for the next run.' })
  const { data: rows, error } = await db.rpc('claim_notifications', { p_limit: 50 })
  if (error) return json({ error: error.message, sent, failed, waiting }, 500)

  const singles: { id: number; message: Record<string, unknown> }[] = []
  for (const row of (rows ?? []) as Row[]) {
    const message = await prepare(row)
    if (message) singles.push({ id: row.id, message })
  }
  await sendEach(singles)
  return json({ sent, failed, waiting })
})
