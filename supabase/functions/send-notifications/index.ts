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

  type Row = { id: number; attempts: number; recipient_email: string | null; template: string; payload: Record<string, unknown>; batch_key?: string | null }
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
  // Every call carries an Idempotency-Key: this project's ref plus the notification id, or, for a
  // batch, a hash of its sorted ids. A batch's key is stored on its rows before the call, so if the
  // answer never comes (timeout, 5xx, or this run dies) the rows go out again together under the
  // same key and the provider can't deliver them twice. An ambiguous failure is first retried
  // unchanged in this run. Calls are spaced 550 ms apart (the provider allows about 2 a second).
  // The first 429 stops this run's sending: everything left goes back to the queue, without using
  // up an attempt, until Retry-After (else 15 minutes), with the reason in last_error. The run also
  // stops starting calls well before the platform's time limit and puts back what it didn't try;
  // if it dies anyway, the claim time on each row lets private.requeue_stuck_notifications() put
  // them back after 15 minutes.
  const project = new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0]
  const singleKey = (id: number) => `${project}-n-${id}`
  async function batchKey(ids: number[]) {
    const sorted = [...ids].sort((a, b) => a - b).join(',')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sorted))
    return `${project}-b-${[...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')}`
  }
  const started = Date.now()
  const timeLeft = () => 110_000 - (Date.now() - started)
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  let lastCall = 0
  async function pace() {
    const wait = lastCall + 550 - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
  }

  type Outcome = { kind: 'ok' | 'rejected' | 'rate_limited' | 'ambiguous'; detail: string | null; retryAfter?: number }
  // Set by the first 429: no more provider calls this run.
  let throttled = null as { retryAfter: number; detail: string } | null

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
        if (res.status === 429) {
          const ra = res.headers.get('retry-after')
          const secs = ra === null ? NaN : Number.isFinite(Number(ra)) ? Number(ra) : (Date.parse(ra) - Date.now()) / 1000
          return { kind: 'rate_limited', detail, retryAfter: Number.isFinite(secs) && secs > 0 ? Math.ceil(secs) : 900 }
        }
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
  async function requeue(ids: number[], delaySeconds: number, reason: string) {
    if (ids.length === 0) return
    await db.rpc('requeue_notifications', { p_ids: ids, p_delay_seconds: delaySeconds, p_error: reason })
    waiting += ids.length
  }
  const throttleReason = () => `Provider rate limit or quota (429), waiting ${throttled!.retryAfter}s: ${throttled!.detail}`.slice(0, 500)
  function noteThrottle(out: Outcome) {
    throttled = { retryAfter: out.retryAfter ?? 900, detail: out.detail ?? '429' }
  }

  // One by one, paced; stops at the first 429 or when time runs short, putting the rest back.
  async function sendEach(items: { id: number; message: Record<string, unknown> }[]) {
    for (let i = 0; i < items.length; i++) {
      if (throttled) return requeue(items.slice(i).map(x => x.id), throttled.retryAfter, throttleReason())
      if (timeLeft() < 15_000) return requeue(items.slice(i).map(x => x.id), 0, 'Out of time this run; next run sends it')
      const { id, message } = items[i]
      const out = await call('https://api.resend.com/emails', message, singleKey(id))
      if (out.kind === 'ok') { await finish([id], true, null); sent++ }
      else if (out.kind === 'rate_limited') { noteThrottle(out); await requeue([id], throttled!.retryAfter, throttleReason()) }
      else { await finish([id], false, out.detail); failed++ }
    }
  }

  // ── Urgent first, in bulk (spec 34). A database without the urgent claim yet just skips this. ──
  const { data: urgent, error: urgentError } = await db.rpc('claim_urgent_notifications', { p_limit: 300 })
  if (urgentError) console.warn(`send-notifications: no urgent claim (${urgentError.message}); sending in order`)
  type Ready = { id: number; message: Record<string, unknown>; batchKey: string | null }
  const ready: Ready[] = []
  for (const row of ((urgent ?? []) as Row[]).sort((a, b) => a.id - b.id)) {
    const message = await prepare(row)
    if (message) ready.push({ id: row.id, message, batchKey: row.batch_key ?? null })
  }
  // Batches with an unknown outcome go again as they were (same rows, same key); the rest are
  // chunked by id, 100 to a call.
  const groups: { key: string | null; items: Ready[] }[] = []
  const unfinished = new Map<string, Ready[]>()
  const fresh: Ready[] = []
  for (const r of ready) {
    if (r.batchKey) unfinished.set(r.batchKey, [...(unfinished.get(r.batchKey) ?? []), r])
    else fresh.push(r)
  }
  for (const [k, items] of unfinished) groups.push({ key: k, items })
  for (let i = 0; i < fresh.length; i += 100) groups.push({ key: null, items: fresh.slice(i, i + 100) })

  for (let g = 0; g < groups.length; g++) {
    const rest = () => groups.slice(g).flatMap(x => x.items.map(i => i.id))
    if (throttled) { await requeue(rest(), throttled.retryAfter, throttleReason()); break }
    if (timeLeft() < 20_000) { await requeue(rest(), 0, 'Out of time this run; next run sends it'); break }
    const { items } = groups[g]
    const ids = items.map(x => x.id)
    const k = groups[g].key ?? await batchKey(ids)
    if (!groups[g].key) await db.rpc('set_notification_batch', { p_ids: ids, p_batch_key: k })
    const out = await call('https://api.resend.com/emails/batch', items.map(x => x.message), k)
    if (out.kind === 'ok') {
      await finish(ids, true, null)
      sent += ids.length
    } else if (out.kind === 'rejected') {
      // The batch is all or nothing and the provider refused it, so nothing in it was sent: one bad
      // address would hold back the rest. Send this chunk one by one instead, so only it fails.
      await db.rpc('set_notification_batch', { p_ids: ids, p_batch_key: null })
      await sendEach(items)
    } else if (out.kind === 'rate_limited') {
      noteThrottle(out)
      await requeue(rest(), throttled!.retryAfter, throttleReason())
      break
    } else {
      // Still no answer after the retries: these rows keep the batch key and try again in
      // 5 minutes, together, under the same key.
      await finish(ids, false, out.detail)
      failed += ids.length
    }
  }

  // ── Everything else, one email per call, highest priority then oldest ──
  if (throttled) return json({ sent, failed, waiting, note: throttleReason() })
  if (timeLeft() < 40_000) return json({ sent, failed, waiting, note: 'Out of time; the rest waits for the next run.' })
  const { data: rows, error } = await db.rpc('claim_notifications', { p_limit: 50 })
  if (error) return json({ error: error.message, sent, failed, waiting }, 500)

  const singles: { id: number; message: Record<string, unknown> }[] = []
  for (const row of (rows ?? []) as Row[]) {
    const message = await prepare(row)
    if (message) singles.push({ id: row.id, message })
  }
  await sendEach(singles)
  if (throttled) return json({ sent, failed, waiting, note: throttleReason() })
  return json({ sent, failed, waiting })
})
