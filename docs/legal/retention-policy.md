# How this site applies SCC’s retention policy

This note is for the people who run the site. It is not legal advice, and it is not SCC’s signed policy. The schedule below is the plan’s default ([§4.3](../scc-improvement-plan.md)). **SCC still has to sign off on the whole schedule** before anyone turns the job from a dry run into a live one. Rows marked **🔎 SCC to confirm** are the ones the plan itself left open.

The short public version belongs on `/privacy`, which [spec L1](../specs/L1-privacy-and-terms.md) has not published yet. That page should link here and should say the backup sentence at the end of this note.

## Who runs it

A database job named `apply-retention` runs every night at 08:45 UTC (about 1:45am Denver time in winter, 2:45am in summer). It calls `private.apply_retention`.

It **only writes a report** until an admin sets `app_settings.retention_live` to `true` in the database, after SCC has signed off. There is no button for that in the app. The demo reset sets the same key back to `false` every night.

A dry run changes no family, volunteer, or signup data. It inserts one report (`retention_runs` and `retention_run_items`): a count per rule. Admins read the latest report at **Setup → Retention**. Parents and volunteers cannot read it.

## Legal hold

An admin can put a family on hold from that same page. The hold is one row in `retention_holds`, which only an admin can write. It is not a column on the parent or camper rows: a parent can edit those, and deleting the contact row must not clear the hold. While the row exists, the job skips that parent and every camper of theirs. It does not clear medical text, anonymize campers, remove parent contact, delete their applications, or clear a volunteer record.

The job, a hold change, and registration writes all take the same database lock, and the job reads the hold again immediately before it changes each row. A hold that lands before that change is kept.

Parents cannot delete a camper while the camper or family is on legal hold, or while the camper has a waiver signature, registration, roll call, incident or consent protected by the age-21 hold. An unknown or unresolved clock keeps those records. A camper with no such records and no legal hold can still be deleted by their parent. Admins and the retention job retain their trusted access.

Clearing the hold lets the job include them again on the next live run. The nightly job never changes the hold.

A conduct note that names no camper, and a “notify me” signup, are not tied to a family, so a hold does not cover them.

## The schedule

“Today” is the date in Denver. “Last session” is the latest session end date on any registration, whatever its status. A section that runs both weeks has no session of its own: the date is the latest end date of sessions in that registration’s year, or 31 December of that year when the year has no sessions. If any registration in the family cannot be dated (no year, no section, a session row that is missing), the job skips the whole family. No session at all means the clock has not started. An unknown date is never treated as old.

| Record | Keep until | Then |
| --- | --- | --- |
| Medical and allergy text, and the free-text “other info” field | 90 days after the camper’s last session | Clear those fields |
| Camper profile: name, email, school, shirt size, demographics, parent and emergency contacts, lunch answers, how they heard about camp | 2 years after the last session | Anonymize (below) |
| Adults listed to pick the camper up, and “place with” notes | Same moment as anonymize | Delete |
| Parent contact, and the parent login the app owns | 2 years after their last camper’s session | Delete or anonymize (below) |
| Waiver signatures, walk-home consent, roll calls, camper incident notes, and the audit rows for that camper | The camper’s 21st birthday 🔎 SCC to confirm | Delete |
| Volunteer application, including the decline reason in its admin notes, and the interview booking | Rejected: 1 year after it was submitted, and not if that application’s season is this camp year or the previous one. Accepted: 2 years after the latest of every date below | Delete |
| Volunteer legal name, preferred name, photo, bio, and the reason they were removed | 2 years after the latest of: every crew season, the day they were accepted, the day they were removed, and every application’s submitted date and season. Anyone with an application, acceptance or crew assignment in the current or previous camp year is kept. A date we cannot resolve keeps them too | Clear |
| Volunteer notes | Same clock as the volunteer record | Delete |
| Conduct incident that names no camper | 1 year after that section’s session (plan question Q-F4) 🔎 SCC to confirm | Delete |
| “Notify me” signup | 60 days after that year’s registration opening time | Delete, including the audit copy of the address |
| Volunteer clearances | As the state requires 🔎 SCC to confirm | Not stored yet (spec L7) |
| Season totals, and year / grade / class on the camper and registration rows | Kept | No personal data in the totals |

Pending applications are not deleted. Someone still has to accept or reject them. A rejected application’s decline reason is the admin note on that row; it goes away with the row, but not while that application belongs to this camp year or the previous one, and not while the person has any other current or previous-season application, acceptance or crew assignment. Applications linked to an account also wait for that person’s two-year volunteer clock. A removal reason is kept on the same clock as the rest of the volunteer record, so a later application can still be read against it during that window. If the camp year itself cannot be determined, or active sessions name more than one year, no volunteer row is touched. Applications are assigned to the summer of submission (through August); submissions from September belong to the next summer. August 15 is the default season end for that clock. An unknown acceptance date also keeps the volunteer.

Camper-linked incident notes follow the 21st birthday, not the one-year conduct rule. The one-year rule is only for a conduct note with no camper, and only when that section’s date resolves. A both-weeks section with no dated registrations is kept. Both rules are marked for SCC to confirm because the plan states them differently.

## What “anonymize” means

The camper row stays, and so does every registration. Reports that count a year, a grade, or a class still work.

The name becomes **Former camper** (first name Former, last name camper). Email, school, shirt size, demographics, parent and emergency contacts, lunch answers, and “how they heard” are set to null. Age stays, because the column cannot be empty. Year, grade, and class stay. Waiver fields stay until the 21st birthday.

Returning-family lookup by name works until that anonymize date: two years after the last session. After that, a search for the old name will not find them. Grade, year, and class are still there, so a grade report still works.

## Parent accounts

On a live run, two years after the last session of any of their campers, provided every camper has a resolved clock. A parent who also has volunteer records or applications is kept while the volunteer clock blocks retention:

- While any camper still has records protected by the age-21 hold, the profile **stays**, its display name becomes **Former parent**, and all email, phone and emergency contact fields in `parent_profiles` become null. Both ids and the campers’ `parent_id` links stay, so an admin can still find the anonymized family as “Former parent” and place a hold afterwards. Unknown or unresolved dates keep the family link too.
- Once no camper record remains protected, the contact row is removed. If the account has no volunteer row or application and never authored an update, the profile row is removed too. Campers are **not** removed. `students.parent_id` becomes null so the registration history stays.
- If a volunteer row, application, or an authored update still points at them, the profile stays as **Former parent**. Deleting the profile would cascade into those rows.

Volunteer-only fields follow the volunteer clock. The shared profile name can change only when the parent clock has also passed and the family is not on legal hold, including when the account’s role has changed. A current, recent or undated camper keeps that name even if the volunteer record is old.

The login in `auth.users` is **not** removed by this SQL. An admin deletes that separately, or a service-role Edge Function can. Demo accounts the reset is told to keep are never removed by the job.

## Season totals

The first **live** run that anonymizes anyone in a camp year stores that whole year in one write, taken from the data **before** any name in that year is cleared: registrations by class and status, and campers by grade, gender, lunch, how they heard, and ethnic background. The buckets have no names. If the year already has any stored totals, the job skips the year entirely. It does not add a bucket later and it does not recompute from rows that have already been anonymized.

## The 21st birthday

There is no date of birth on file, and the grade on the camper row can be edited later. The job does not rebuild an age from today’s grade. It assumes the camper was the youngest age the camp takes — 4th grade, age 9 — in their **first** registration year, and holds the records until **1 January after** the year `(first registration year − 9 + 21)`. A camper whose first registration is 2010 is held through 2022, until 1 January 2023, even if the grade now says 9th (that reading would have ended the hold in 2017). The first year is the earliest year on their registrations. A registration with no valid year makes the year unknown. No registrations means no age-21 deletion, even if the camper row has a registration year.

When the first year is unknown, those records are not deleted. 🔎 SCC to confirm this conservative default. It is the site’s stand-in until SCC confirms the age-21 hold.

On that date a live run clears the waiver signatures, deletes walk-home consents, roll calls, and incidents that name the camper, and then deletes the audit rows that still carry that camper’s id (including the anonymize entry, which holds the old name, and every audited table that stores `student_id`, such as change requests). An audit row that names different campers in its old and new values stays until **every** referenced camper is eligible, unheld and past the age-21 hold. A missing, unknown or unresolved camper reference keeps the row. Signed waiver **documents** (the versioned form text) are not deleted. If the later consents table exists and has a camper column, those rows go too.

## Notify-me list

A signup is deleted 60 days after `registration_opens_at` for its year. The audit row is deleted in the same run, because the audit copy includes the email address. A year with no opening time is left alone.

## What the job does not do

- It does not delete rows that reports count, except the ones the schedule names (roll calls, incidents, consents, applications, the parent profile when it is safe).
- It does not scrub the notification outbox. A sent or queued email can still hold a name or an address until that outbox row is gone.
- Deleting a parent profile, a volunteer application, a volunteer note, or a no-camper conduct incident leaves an admin-only audit row with reason `retention`. Camper audit rows are the ones removed at 21, and notify-me audit rows are removed with the signup. That split is deliberate: the spec requires the address copy to go, and the plan requires camper audit to go at 21; the other deletes stay as an admin trail.
- Rows this job deletes are still in backups until those backups expire: 7 days on the Pro plan, longer if point-in-time recovery is on. Say that on the privacy notice.
