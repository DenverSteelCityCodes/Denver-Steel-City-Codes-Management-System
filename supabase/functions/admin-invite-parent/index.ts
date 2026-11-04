// admin-invite-parent: an admin adds a family that has no account yet (spec 32), so a late,
// walk-in or phone sign-up can be attached to it. Called from Campers › Add registration.
//
// POST { email, display_name?, phone? } with the admin's session (verify_jwt on). The caller's
// own JWT runs admin_find_parent(), which refuses anyone but an admin past the MFA step, so this
// function never decides who is an admin itself. Then, with the service role:
//   1. invite the email (Supabase Auth sends the invite; the link lands on /reset to set a password);
//   2. if the invite email can't be sent (the built-in sender only reaches the project's team and
//      is capped per hour until custom SMTP, spec 02), create the account without it, and say so:
//      the family can use "Forgot password" later;
//   3. save the email and phone on parent_profiles.
// Returns { id, invited }.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the platform;
// APP_URL is the same secret send-notifications uses.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const body = await req.json().catch(() => ({})) as { email?: string; display_name?: string; phone?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter the family’s email address.' }, 400)
  const name = (body.display_name ?? '').trim().slice(0, 120)
  const phone = (body.phone ?? '').trim().slice(0, 40)

  const url = Deno.env.get('SUPABASE_URL')!
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: found, error: denied } = await asCaller.rpc('admin_find_parent', { p_email: email })
  if (denied) return json({ error: 'Admins only.' }, 403)
  if (Array.isArray(found) && found.length > 0) return json({ id: found[0].id, invited: false, existing: true })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const appUrl = (Deno.env.get('APP_URL') ?? 'https://scc.haanie.com').replace(/\/$/, '')
  const data = name ? { display_name: name } : undefined

  let id: string | undefined
  let invited = true
  const invite = await admin.auth.admin.inviteUserByEmail(email, { data, redirectTo: `${appUrl}/reset` })
  if (invite.data.user) {
    id = invite.data.user.id
  } else {
    invited = false
    const made = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: data })
    if (made.error || !made.data.user) return json({ error: 'Couldn’t create the account. Try again.' }, 502)
    id = made.data.user.id
  }

  // The new-user trigger made the profile (role parent); keep the contact details with it.
  const saved = await admin.from('parent_profiles').upsert({ id, email, ...(phone ? { phone } : {}) })
  if (saved.error) return json({ id, invited, warning: 'Account created, but the contact details weren’t saved.' })
  return json({ id, invited })
})
