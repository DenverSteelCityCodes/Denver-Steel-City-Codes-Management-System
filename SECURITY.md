# Security policy

This app stores information about children (names, ages, medical and allergy notes) and their families. Thank you for reporting problems responsibly.

## Reporting a vulnerability

**Please don't open a public issue, discussion or PR for a security problem.** Instead:

- Use **[Report a vulnerability](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/security/advisories/new)** on this repository's Security tab (GitHub private vulnerability reporting), or
- Email **denver@steelcitycodes.org** with "Security" in the subject.

Please include what you found, the steps to reproduce it, and what an attacker could do with it. You'll get an acknowledgement within 5 days. We'll keep you updated until it's fixed and credit you in the fix unless you'd rather not be named.

## Scope

In scope: this repository's code and SQL, and the public demo at [scc.haanie.com](https://scc.haanie.com). Especially:

- One family seeing another family's data, or a volunteer seeing campers outside their own section
- Gaining a role you shouldn't have (parent → volunteer or admin), or getting past admin MFA
- Getting around capacity, age, one-class-per-week, waitlist or deadline rules through the API
- Leaked keys or secrets

Not vulnerabilities:

- The demo's one-click logins and their passwords. They are public on purpose, and the demo holds only fictional data that resets nightly.
- The Supabase URL and anon key in the browser bundle. They are public by design; RLS is what protects the data.
- Missing security headers or rate limits with no demonstrated impact.

## Testing rules

- Test only against the demo or your own copy. Never against a chapter's live registration site.
- Don't run denial-of-service, load or spam tests, and don't send email to addresses you don't own.
- Use the minimum access needed to show the problem, and don't keep any data you reach.

## Supported versions

Only the latest `main` gets security fixes.

For the chapter's own incident process, see [docs/runbooks/security-incident.md](docs/runbooks/security-incident.md).
