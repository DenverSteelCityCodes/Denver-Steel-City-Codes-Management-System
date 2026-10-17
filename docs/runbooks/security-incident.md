# Security-incident runbook (registration site)

**Owner:** Regional Director, SCC Denver · **Applies to:** the registration and camp-management site, its Supabase project, its Vercel deployment and its email provider.
**Status:** draft for review by the Regional Director and SCC national (spec L5, #93). Not legal advice: SCC's legal contacts decide what the law requires in a real incident.

This covers incidents in **the website and its data**. Anything wider (SCC's own accounts, devices, insurance) goes into SCC's existing incident process. This runbook hands off to it at step 1.

---

## 0. What counts as an incident

Treat it as an incident and start at step 1 if any of these happen:

- Someone who shouldn't have it may have seen camper or family data. Examples: a lost or stolen phone or laptop that is signed in as an admin or volunteer; a roster printout or CSV export left somewhere public; a shared screen.
- An admin or volunteer account may be compromised: an unexpected sign-in, a reused or leaked password, or changes nobody remembers making.
- A key or secret is exposed: a Supabase service-role or secret key, the JWT secret, the email provider key, or a Vercel token pasted somewhere public or committed to Git.
- The site shows one family another family's data, or a volunteer sees campers outside their section.
- Data is missing or changed and the audit log doesn't explain it.

If you're unsure, start the log (step 1) anyway. A false alarm costs ten minutes.

## 1. Roles and first hour

| Role | Who | Does |
|---|---|---|
| **Incident lead** | Regional Director (`denver@steelcitycodes.org`) | Owns the incident, decides on containment and notice, keeps the log, talks to SCC national |
| **Technical lead** | Whoever maintains the site (fill in: name, phone) | Runs the containment and assessment steps below |
| **SCC national contact** | (fill in: name, email, phone) | Brings in SCC's incident process and legal contacts. National is the data controller (Q-L1), so notices go out in its name |

In the first hour:
1. Open an incident log: a private doc titled `Incident YYYY-MM-DD – short name`. Write down every action with the time (Denver time) and who did it. The notice decision and any legal review depend on this log.
2. Tell the SCC national contact, even if it might be nothing.
3. Contain (step 2) **before** investigating in depth.

## 2. Contain

Do what fits the incident. Each step lists where to do it.

| Situation | Action | Where |
|---|---|---|
| A person's device or account is compromised | **Sign them out everywhere:** `delete from auth.sessions where user_id = '<id>'; delete from auth.refresh_tokens where user_id = '<id>';` Access tokens already issued stay valid until they expire (1 hour by default), so also do the next row | Supabase → SQL editor |
| | **Block the account:** Supabase → Authentication → Users → the user → *Ban user*, or `update auth.users set banned_until = 'infinity' where id = '<id>';`. For an admin, also change their role in Admin → Users | Supabase / Admin → Users |
| | Have them change their password, and their email password if it's the same | The person |
| A key is exposed | **Rotate it.** Supabase → Project Settings → API keys (secret/service keys) or JWT keys. Rotating the JWT secret signs **everyone** out and replaces the anon and service keys. Then update: Vercel env vars (`VITE_SUPABASE_ANON_KEY` / publishable key) and redeploy; Edge Function secrets; the Vault secret `notify_function_key` (`select vault.update_secret(...)`) | Supabase, Vercel |
| | Email provider key exposed: revoke it in the provider dashboard, create a new one, set `RESEND_API_KEY` in Supabase → Edge Functions → Secrets | Provider, Supabase |
| Data is leaking through the site itself (a bug) | **Close registration:** Admin → Forms → camper registration → *Close form*. If the leak is wider, take the site down: Vercel → the project → *Pause* or roll back to the last good deployment | Admin, Vercel |
| Printouts or exports are out in the world | Note what was printed or exported, when and by whom (the audit log doesn't record prints). Try to get them back | People |

Don't delete logs, accounts or data while containing: they're the evidence for step 3. Ban accounts; don't delete them.

## 3. Assess: what data, whose, and since when

Write the answers in the incident log.

1. **What happened in the data:** the audit log (spec 05) records every change to campers, registrations, sections, profiles and more, with who and when.
   - `select at, actor_id, actor_role, table_name, row_id, action, reason from audit.log where at > now() - interval '7 days' order by at desc;`
   - Narrow it to one person with `where actor_id = '<id>'`, or to one camper's record with `admin_history('students', '<id>')`.
2. **Who signed in and from where:** Supabase → Logs → Auth (sign-ins, IP addresses, user agents). The API logs show which tables were read; look for unusual volume from one user or IP.
3. **What emails went out:** the `notifications` table, Admin → Updates → email log, and the email provider's dashboard.
4. **Deployments and config:** Vercel → Deployments and Activity; GitHub → the repository's recent commits and Actions.
5. **Scope:** list the people affected (families, campers, volunteers) and **which fields** were exposed. The kind of data decides the notice duty:
   - **Name with medical information** (allergies, medical conditions) or a **username or email with its password** is the kind of "personal information" Colorado's breach law covers 🔎 ([Mintz](https://www.mintz.com/mintz-matrix/colorado); confirm with SCC's legal contacts).
   - Names, ages, grades, school and contact details on their own are sensitive (they're about children) but may not trigger the statute. Tell families anyway when it's the right thing to do: SCC decides.

Write down the **determination time**: when we concluded that a breach of covered personal information happened. The notice clock starts there.

## 4. Decide on notice (Colorado, for the Denver chapter)

🔎 From [Mintz's Colorado summary](https://www.mintz.com/mintz-matrix/colorado), loaded October 2026; SCC's legal contacts confirm before anything is sent:

- **Affected Colorado residents:** within **30 days** of the determination. The notice says what happened, what data, when, what we're doing, and how to reach us.
- **The Colorado Attorney General:** also within 30 days, if **500 or more** Colorado residents are notified.
- **Consumer reporting agencies:** if **1,000 or more** residents are notified.
- A family in another state is covered by **its own state's** law; ask SCC's legal contacts.
- Volunteers are residents too: count them.

The incident lead records the decision (notify or not, and why) in the log, signed off by the SCC national contact.

## 5. Notice templates

Send from `denver@steelcitycodes.org` (or SCC national's address if national decides), plain text, one email per family. Don't attach the data. Fill in every `[ ]`.

**To families**

> Subject: Important: a security issue with Steel City Codes camp registration
>
> Dear [parent name],
>
> We're writing to tell you about a security issue that affected information about [camper first name] in the Steel City Codes Denver camp registration site.
>
> **What happened:** On [date], [one or two plain sentences: e.g. "a volunteer's phone that was signed in to the site was stolen"]. We found out on [date] and [what we did: e.g. "signed that account out and blocked it the same day"].
>
> **What information was involved:** [list the fields, e.g. "your child's name, age, class, and the allergy and medical notes you gave us"]. [Say what was NOT involved, e.g. "No payment details are stored on the site."]
>
> **What we're doing:** [e.g. "We've changed the affected passwords and keys, reviewed who can see camper information, and added …"].
>
> **What you can do:** [e.g. "There's nothing you need to do. If you use the same password for the camp site and other accounts, change it."]
>
> If you have questions, reply to this email or write to denver@steelcitycodes.org. [Phone, if any.]
>
> We're sorry this happened.
>
> [Name], Regional Director, Steel City Codes Denver

**To volunteers:** use the same structure. "What information" lists the volunteer's own data (contact details, application answers, clearances) and, if relevant, which campers' data they could see.

## 6. After the incident (within two weeks)

A 30-minute review with the incident lead, the technical lead and the SCC national contact. Write up:

- a timeline (from the log);
- what worked and what didn't;
- the root cause;
- changes to make, each with an owner and a date (for example: fewer people with admin, MFA, shorter roster access, a code fix);
- what to change in this runbook.

Keep the write-up with the incident log. Add one line to the log at the bottom of this file.

## 7. Quarterly access review

Every three months (suggested: January, April, July, October) and whenever someone leaves the team:

- [ ] List the admins (Supabase → SQL editor): `select p.display_name, u.email, u.last_sign_in_at from profiles p join auth.users u on u.id = p.id where p.role = 'admin' order by u.last_sign_in_at;`
- [ ] Confirm each one still needs admin. Change anyone who doesn't to parent or volunteer.
- [ ] Every admin shows **Two-step sign-in: on** in Admin → Users (spec 27). Use **Reset** there only after confirming in person or by phone that it's really them.
- [ ] Volunteers: confirm last season's leads and helpers are no longer assigned to sections (Admin → Classes). Volunteer access to campers follows section assignment (spec 04).
- [ ] Remove or ban accounts of people who have left.
- [ ] Shared credentials (if any: a shared Vercel, Supabase or email-provider login) are rotated, and shared logins are replaced by personal accounts where the service allows it.
- [ ] Who has Supabase, Vercel, GitHub and email-provider dashboard access? Remove anyone who no longer needs it.
- [ ] Record the review in the log below.

## 8. Contacts

| Who | How | When |
|---|---|---|
| Supabase support | Supabase dashboard → Support (supabase.com/dashboard/support/new) | Suspected platform issue, key rotation help, log retention |
| Vercel support | vercel.com/help | Deployment or account compromise |
| Email provider | The provider's dashboard → support (Resend once spec 02 is set up) | Key leak, suspicious sends |
| SCC national contact | (fill in) | Every incident |
| SCC legal contact | (fill in, via national) | Any notice decision |
| Colorado Attorney General | coag.gov → consumer protection → data breach reporting (confirm the current page) | Notice to 500+ residents |

## 9. Tabletop exercise (once before February)

30 minutes, incident lead + technical lead (+ SCC national if possible). Scenario: **"Monday 10:30 AM, Week 1. A volunteer lead tells you their phone was stolen at lunch. It was unlocked with the roster page open, signed in to the site."** Walk through steps 1–5 out loud, then answer:

- How do you find out which campers that volunteer could see? (Their section's roster, plus any other sections they're assigned to.)
- Which fields were on the screen? (Names, ages, allergies, medical notes, emergency contacts.)
- How quickly can you sign them out and ban the account? Try it on the demo site.
- Does this need notice under step 4? Who decides, and by when?
- Draft the first two sentences of the family email.

Notes:

> (date, who took part, what was slow or unclear, what changed afterwards)

## Log

| Date | Type (incident / review / exercise) | Summary | By |
|---|---|---|---|
| | | | |
