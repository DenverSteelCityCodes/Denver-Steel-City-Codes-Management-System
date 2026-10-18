-- Migration: laptop loans per camper-week (spec 29, #149)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: deploy the send-notifications Edge Function BEFORE applying this migration (it must know
-- the four laptop_* templates; a sender that doesn't know a template holds the email queued for 6
-- hours instead of failing it). Then apply after migration_notifications.sql (the outbox),
-- migration_soft_cancel.sql, migration_audit_log.sql, migration_admin_mfa.sql and
-- migration_volunteer_roster_access.sql: this file redefines section_roster() with a laptop_loan
-- column, so re-apply it whenever that file is re-applied. Then re-apply
-- migration_demo_environment.sql on the demo project (its reset deletes laptop loans before
-- registrations, and seeds a loaner cap per week and a few loans).
--
-- Decided (spec 29): a loan belongs to one registration (one camper, one week). Each week has a
-- loaner cap set by an admin; requests past the cap wait in a laptop queue, first come first
-- served (FIFO by request time; the spec's default until the director decides otherwise).
-- Loaners stay on site.
--   * sessions.laptop_loaners: the cap for that week (0 = no loaners yet: every request queues).
--   * laptop_loans: one row per registration. reserved and handed_out count against the cap;
--     queued waits; released (the family withdrew, or the spot ended) and returned don't count.
--   * request_laptop() / release_laptop(): parents, for their own camper's seat, until the week
--     starts (Denver date). Admins any time. Both lock the week's sessions row, so two families
--     asking for the last loaner at once get exactly one reservation.
--   * admin_set_laptop_status(): admins tick handed_out and returned (and can undo a hand-out).
--   * A spot that ends (cancelled, back on a waitlist) releases its reserved or queued loan; a
--     released, returned or extra loaner (cap raised) goes to the oldest queued request that week.
--     A handed-out laptop is never released automatically: the camp has to see it come back.
--   * Moving a camper to another week takes the request along, keeping its request time.
--   * section_roster() gains laptop_loan ('reserved' / 'handed_out', else NULL) for the crew.
--   * Emails through the outbox: laptop_reserved, laptop_queued, laptop_promoted,
--     laptop_released, each deduped per registration and transaction. Like the registration
--     emails, nothing is queued for a change made with no signed-in user and no reason (the SQL
--     editor, private.reset_demo()).
-- students.laptop_available is no longer asked; the column stays, read-only, for past seasons.

-- ── 1. A loaner cap per week ─────────────────────────────────

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS laptop_loaners INT NOT NULL DEFAULT 0;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_laptop_loaners_range;
ALTER TABLE sessions ADD CONSTRAINT sessions_laptop_loaners_range CHECK (laptop_loaners BETWEEN 0 AND 500);
COMMENT ON COLUMN sessions.laptop_loaners IS 'How many loaner laptops the camp can lend that week (spec 29). Requests past it wait in the laptop queue.';

-- ── 2. The loans ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS laptop_loans (
    registration_id  UUID PRIMARY KEY REFERENCES registrations(id) ON DELETE RESTRICT,
    status           TEXT NOT NULL CHECK (status IN ('reserved', 'queued', 'handed_out', 'returned', 'released')),
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    handed_out_at    TIMESTAMPTZ,
    returned_at      TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS laptop_loans_open_idx ON laptop_loans (status, requested_at)
    WHERE status IN ('reserved', 'queued', 'handed_out');
COMMENT ON TABLE laptop_loans IS 'Loaner laptop per registration (spec 29). Written only through request_laptop(), release_laptop(), admin_set_laptop_status() and the triggers below.';

-- Does the signed-in parent own this registration? (Definer, so the policy doesn't chain RLS.)
CREATE OR REPLACE FUNCTION private.auth_parent_has_registration(p_registration_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM registrations r JOIN students st ON st.id = r.student_id
                  WHERE r.id = p_registration_id AND st.parent_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION private.auth_parent_has_registration(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_parent_has_registration(UUID) TO authenticated;   -- RLS policies run it as the caller

ALTER TABLE laptop_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_laptop_loans" ON laptop_loans;
DROP POLICY IF EXISTS "own_read_laptop_loans"   ON laptop_loans;
CREATE POLICY "admin_read_laptop_loans" ON laptop_loans FOR SELECT TO authenticated
    USING (private.auth_user_role() = 'admin');
CREATE POLICY "own_read_laptop_loans" ON laptop_loans FOR SELECT TO authenticated
    USING (private.auth_parent_has_registration(registration_id));
REVOKE ALL ON laptop_loans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON laptop_loans TO authenticated;   -- RLS: admins, and parents for their own campers. No client writes.

DROP TRIGGER IF EXISTS touch_updated_at ON laptop_loans;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON laptop_loans
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
DROP TRIGGER IF EXISTS audit_log_change ON laptop_loans;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON laptop_loans
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('registration_id');

-- ── 3. Helpers ───────────────────────────────────────────────

-- Loaners in use that week: reserved or handed out.
CREATE OR REPLACE FUNCTION private.laptop_in_use(p_session_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM laptop_loans l
    JOIN registrations r ON r.id = l.registration_id
    JOIN sections s ON s.id = r.section_id
   WHERE s.session_id = p_session_id AND l.status IN ('reserved', 'handed_out');
$$;
REVOKE ALL ON FUNCTION private.laptop_in_use(UUID) FROM PUBLIC, anon, authenticated;

-- A queued request's place in its week's laptop queue (1 = next), else NULL.
CREATE OR REPLACE FUNCTION private.laptop_queue_position(p_registration_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 1 + (SELECT count(*)::int FROM laptop_loans q
                JOIN registrations qr ON qr.id = q.registration_id
                JOIN sections qs ON qs.id = qr.section_id
               WHERE qs.session_id = s.session_id AND q.status = 'queued'
                 AND (q.requested_at, q.registration_id) < (l.requested_at, l.registration_id))
    FROM laptop_loans l
    JOIN registrations r ON r.id = l.registration_id
    JOIN sections s ON s.id = r.section_id
   WHERE l.registration_id = p_registration_id AND l.status = 'queued' AND s.session_id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION private.laptop_queue_position(UUID) FROM PUBLIC, anon, authenticated;

-- Queue one laptop email to the camper's family. Same rule as the registration emails: nothing
-- for a change made with no signed-in user and no reason.
CREATE OR REPLACE FUNCTION private.laptop_notify(p_registration_id UUID, p_template TEXT, p_extra JSONB DEFAULT '{}')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  parent  UUID;
  payload JSONB;
BEGIN
  IF auth.uid() IS NULL AND nullif(current_setting('app.reason', true), '') IS NULL THEN RETURN; END IF;
  SELECT st.parent_id,
         jsonb_build_object(
           'camper', coalesce(nullif(st.first_name, ''), split_part(st.full_name, ' ', 1)),
           'class', c.name, 'section', s.label, 'week', s.week, 'session', se.name,
           'start_date', se.start_date, 'end_date', se.end_date, 'student_id', st.id)
           || coalesce(p_extra, '{}')
    INTO parent, payload
  FROM registrations r
  JOIN students st ON st.id = r.student_id
  JOIN sections s ON s.id = r.section_id
  JOIN classes c ON c.id = s.class_id
  LEFT JOIN sessions se ON se.id = s.session_id
  WHERE r.id = p_registration_id;
  IF parent IS NULL THEN RETURN; END IF;
  PERFORM private.enqueue_notification(parent, p_template, payload,
    p_template || ':' || p_registration_id || ':' || txid_current());
END;
$$;
REVOKE ALL ON FUNCTION private.laptop_notify(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- Give free loaners that week to the oldest queued requests (FIFO), and email those families.
-- Locks the week's sessions row first, like every other laptop write.
CREATE OR REPLACE FUNCTION private.laptop_promote(p_session_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  cap   INT;
  used  INT;
  cand  UUID;
  made  INT := 0;
  prior TEXT := current_setting('app.reason', true);
BEGIN
  SELECT laptop_loaners INTO cap FROM sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  used := private.laptop_in_use(p_session_id);
  WHILE used < cap LOOP
    SELECT l.registration_id INTO cand
      FROM laptop_loans l
      JOIN registrations r ON r.id = l.registration_id
      JOIN sections s ON s.id = r.section_id
     WHERE s.session_id = p_session_id AND l.status = 'queued' AND r.status IN ('confirmed', 'pending')
     ORDER BY l.requested_at, l.registration_id
     LIMIT 1
     FOR UPDATE OF l;
    EXIT WHEN cand IS NULL;
    PERFORM private.set_reason('laptop_promoted');
    UPDATE laptop_loans SET status = 'reserved' WHERE registration_id = cand;
    -- The caller's reason decides whether to email (none from the SQL editor or the demo reset).
    PERFORM set_config('app.reason', coalesce(prior, ''), true);
    PERFORM private.laptop_notify(cand, 'laptop_promoted');
    used := used + 1;
    made := made + 1;
  END LOOP;
  PERFORM set_config('app.reason', coalesce(prior, ''), true);
  RETURN made;
END;
$$;
REVOKE ALL ON FUNCTION private.laptop_promote(UUID) FROM PUBLIC, anon, authenticated;

-- ── 4. Parents (and admins): request and release ─────────────
-- Lock order everywhere: the registration row, then the week's sessions row, then the loan.
-- The registration lock means a cancel can't land between the "holds a seat" check and the write.

CREATE OR REPLACE FUNCTION public.request_laptop(p_registration_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  is_admin BOOLEAN := coalesce(private.auth_user_role() = 'admin', false);
  reg      registrations%ROWTYPE;
  sess     sessions%ROWTYPE;
  cur      TEXT;
  next     TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND (is_admin OR st.parent_id = auth.uid())
   FOR SHARE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501'; END IF;
  IF reg.status::text NOT IN ('confirmed', 'pending') THEN
    RAISE EXCEPTION 'A laptop can be borrowed once your camper has a spot in the class' USING ERRCODE = 'P0001';
  END IF;
  SELECT se.* INTO sess FROM sections s JOIN sessions se ON se.id = s.session_id
   WHERE s.id = reg.section_id FOR UPDATE OF se;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This class isn''t scheduled for a camp week yet, so a laptop can''t be reserved for it. Email denver@steelcitycodes.org.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT is_admin AND (now() AT TIME ZONE 'America/Denver')::date >= sess.start_date THEN
    RAISE EXCEPTION '% has started, so laptops can''t be requested online. Ask at check-in.', sess.name USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO cur FROM laptop_loans WHERE registration_id = reg.id FOR UPDATE;
  IF cur IN ('reserved', 'queued', 'handed_out') THEN RETURN cur; END IF;   -- asked already

  -- A free loaner, and nobody waiting ahead: reserved. Otherwise the back of the queue.
  next := CASE WHEN private.laptop_in_use(sess.id) < sess.laptop_loaners
                AND NOT EXISTS (SELECT 1 FROM laptop_loans q JOIN registrations qr ON qr.id = q.registration_id
                                  JOIN sections qs ON qs.id = qr.section_id
                                 WHERE qs.session_id = sess.id AND q.status = 'queued')
               THEN 'reserved' ELSE 'queued' END;
  PERFORM private.set_reason('laptop_request');
  INSERT INTO laptop_loans (registration_id, status, requested_at)
  VALUES (reg.id, next, clock_timestamp())
  ON CONFLICT (registration_id) DO UPDATE
     SET status = EXCLUDED.status, requested_at = EXCLUDED.requested_at, handed_out_at = NULL, returned_at = NULL;
  IF next = 'reserved' THEN
    PERFORM private.laptop_notify(reg.id, 'laptop_reserved');
  ELSE
    PERFORM private.laptop_notify(reg.id, 'laptop_queued',
      jsonb_build_object('position', private.laptop_queue_position(reg.id)));
    PERFORM private.laptop_promote(sess.id);   -- only does anything if loaners sat free behind a queue
  END IF;
  PERFORM private.set_reason(NULL);
  RETURN (SELECT status FROM laptop_loans WHERE registration_id = reg.id);
END;
$$;
REVOKE ALL ON FUNCTION public.request_laptop(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_laptop(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_laptop(p_registration_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  is_admin BOOLEAN := coalesce(private.auth_user_role() = 'admin', false);
  reg      registrations%ROWTYPE;
  sess     sessions%ROWTYPE;
  cur      TEXT;
  own      BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND (is_admin OR st.parent_id = auth.uid())
   FOR SHARE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501'; END IF;
  own := private.auth_parent_has_registration(reg.id);
  SELECT se.* INTO sess FROM sections s JOIN sessions se ON se.id = s.session_id
   WHERE s.id = reg.section_id FOR UPDATE OF se;
  IF NOT is_admin AND sess.id IS NOT NULL AND (now() AT TIME ZONE 'America/Denver')::date >= sess.start_date THEN
    RAISE EXCEPTION '% has started, so laptops can''t be changed online. Tell the camp at check-in.', sess.name USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO cur FROM laptop_loans WHERE registration_id = reg.id FOR UPDATE;
  IF cur IS NULL OR cur IN ('released', 'returned') THEN RETURN cur; END IF;   -- nothing to give back
  IF cur = 'handed_out' THEN
    RAISE EXCEPTION 'That laptop has been handed out. It''s marked returned when it''s back with the camp.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.set_reason('laptop_release');
  UPDATE laptop_loans SET status = 'released' WHERE registration_id = reg.id;
  PERFORM private.laptop_notify(reg.id, 'laptop_released',
    jsonb_build_object('reason', CASE WHEN own THEN 'parent' ELSE 'admin' END, 'was', cur));
  IF cur = 'reserved' AND sess.id IS NOT NULL THEN PERFORM private.laptop_promote(sess.id); END IF;
  PERFORM private.set_reason(NULL);
  RETURN 'released';
END;
$$;
REVOKE ALL ON FUNCTION public.release_laptop(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_laptop(UUID) TO authenticated;

-- ── 5. Admins: hand-out checklist ────────────────────────────
-- 'handed_out' (from any state: the camp can hand a spare to anyone holding a seat, which may run
-- past the cap), 'returned' (from handed_out; frees the loaner for the queue) and 'reserved'
-- (only to undo a hand-out ticked by mistake).
CREATE OR REPLACE FUNCTION public.admin_set_laptop_status(p_registration_id UUID, p_status TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg  registrations%ROWTYPE;
  sid  UUID;
  cur  TEXT;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('handed_out', 'returned', 'reserved') THEN
    RAISE EXCEPTION 'A laptop can be marked handed_out, returned or reserved' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO reg FROM registrations WHERE id = p_registration_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That registration no longer exists' USING ERRCODE = 'P0001'; END IF;
  SELECT s.session_id INTO sid FROM sections s WHERE s.id = reg.section_id;
  IF sid IS NOT NULL THEN PERFORM 1 FROM sessions WHERE id = sid FOR UPDATE; END IF;
  SELECT status INTO cur FROM laptop_loans WHERE registration_id = reg.id FOR UPDATE;
  IF cur IS NOT DISTINCT FROM p_status THEN RETURN cur; END IF;

  PERFORM private.set_reason('laptop_' || p_status);
  IF p_status = 'handed_out' THEN
    IF reg.status::text NOT IN ('confirmed', 'pending') THEN
      RAISE EXCEPTION 'This camper doesn''t hold a spot in the class' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO laptop_loans (registration_id, status, requested_at, handed_out_at)
    VALUES (reg.id, 'handed_out', clock_timestamp(), now())
    ON CONFLICT (registration_id) DO UPDATE
       SET status = 'handed_out', returned_at = NULL,
           -- undoing a "returned" tick keeps the original hand-out time
           handed_out_at = CASE WHEN laptop_loans.status = 'returned' THEN coalesce(laptop_loans.handed_out_at, now()) ELSE now() END;
  ELSIF p_status = 'returned' THEN
    IF cur IS DISTINCT FROM 'handed_out' THEN
      RAISE EXCEPTION 'Only a handed-out laptop can be marked returned' USING ERRCODE = 'P0001';
    END IF;
    UPDATE laptop_loans SET status = 'returned', returned_at = now() WHERE registration_id = reg.id;
    IF sid IS NOT NULL THEN PERFORM private.laptop_promote(sid); END IF;
  ELSE
    IF cur IS DISTINCT FROM 'handed_out' THEN
      RAISE EXCEPTION 'Only a hand-out can be undone this way' USING ERRCODE = 'P0001';
    END IF;
    UPDATE laptop_loans SET status = 'reserved', handed_out_at = NULL WHERE registration_id = reg.id;
  END IF;
  PERFORM private.set_reason(NULL);
  RETURN p_status;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_laptop_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_laptop_status(UUID, TEXT) TO authenticated;

-- ── 6. The parent's view: each camper-week's laptop ──────────
-- One row per registration that holds a seat or has a loan: the loan's status (NULL = never
-- asked), its place in the queue, and whether it can still be changed online (before the week).
CREATE OR REPLACE FUNCTION public.my_laptop_loans()
RETURNS TABLE (registration_id UUID, status TEXT, queue_position INT, changes_open BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT r.id, l.status, private.laptop_queue_position(r.id),
         se.id IS NOT NULL AND (now() AT TIME ZONE 'America/Denver')::date < se.start_date
    FROM registrations r
    JOIN students st ON st.id = r.student_id
    JOIN sections s ON s.id = r.section_id
    LEFT JOIN sessions se ON se.id = s.session_id
    LEFT JOIN laptop_loans l ON l.registration_id = r.id
   WHERE st.parent_id = auth.uid()
     AND (r.status IN ('confirmed', 'pending') OR l.registration_id IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.my_laptop_loans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_laptop_loans() TO authenticated;

-- ── 7. Spots that end, weeks that change, caps that rise ─────

-- A registration that stops holding a seat releases its reserved or queued loan (and a reserved
-- loaner goes to the queue); one moved to another week takes its request along. Fires after
-- registrations_offer_freed_seat (trigger names run in order), and only locks the week when the
-- registration has an open request.
CREATE OR REPLACE FUNCTION private.registrations_release_laptop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  cur      TEXT;
  old_sess UUID;
  new_sess UUID;
  cap      INT;
  next     TEXT;
  prior    TEXT := current_setting('app.reason', true);
BEGIN
  SELECT status INTO cur FROM laptop_loans WHERE registration_id = NEW.id;
  IF cur IS NULL OR cur NOT IN ('reserved', 'queued') THEN RETURN NULL; END IF;
  old_sess := (SELECT session_id FROM sections WHERE id = OLD.section_id);
  new_sess := (SELECT session_id FROM sections WHERE id = NEW.section_id);

  IF NEW.status::text NOT IN ('confirmed', 'pending') OR new_sess IS NULL THEN
    IF old_sess IS NOT NULL THEN PERFORM 1 FROM sessions WHERE id = old_sess FOR UPDATE; END IF;
    PERFORM private.set_reason('laptop_spot_ended');
    UPDATE laptop_loans SET status = 'released' WHERE registration_id = NEW.id;
    PERFORM set_config('app.reason', coalesce(prior, ''), true);
    PERFORM private.laptop_notify(NEW.id, 'laptop_released', jsonb_build_object('reason', 'spot_ended', 'was', cur));
    IF cur = 'reserved' AND old_sess IS NOT NULL THEN PERFORM private.laptop_promote(old_sess); END IF;
  ELSIF old_sess IS DISTINCT FROM new_sess THEN
    -- Both weeks, in a fixed order, so two opposite moves can't deadlock.
    PERFORM 1 FROM sessions WHERE id IN (old_sess, new_sess) ORDER BY id FOR UPDATE;
    SELECT laptop_loaners INTO cap FROM sessions WHERE id = new_sess;
    next := CASE WHEN private.laptop_in_use(new_sess) < cap
                  AND NOT EXISTS (SELECT 1 FROM laptop_loans q JOIN registrations qr ON qr.id = q.registration_id
                                    JOIN sections qs ON qs.id = qr.section_id
                                   WHERE qs.session_id = new_sess AND q.status = 'queued'
                                     AND q.requested_at < (SELECT requested_at FROM laptop_loans WHERE registration_id = NEW.id))
                 THEN 'reserved' ELSE 'queued' END;
    PERFORM private.set_reason('laptop_moved');
    UPDATE laptop_loans SET status = next WHERE registration_id = NEW.id;
    PERFORM set_config('app.reason', coalesce(prior, ''), true);
    IF next <> cur THEN
      PERFORM private.laptop_notify(NEW.id, 'laptop_' || next,
        CASE WHEN next = 'queued' THEN jsonb_build_object('position', private.laptop_queue_position(NEW.id)) ELSE '{}' END);
    END IF;
    IF cur = 'reserved' AND old_sess IS NOT NULL THEN PERFORM private.laptop_promote(old_sess); END IF;
    PERFORM private.laptop_promote(new_sess);
  END IF;
  PERFORM set_config('app.reason', coalesce(prior, ''), true);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.registrations_release_laptop() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS registrations_release_laptop ON registrations;
CREATE TRIGGER registrations_release_laptop AFTER UPDATE OF status, section_id ON registrations
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.section_id IS DISTINCT FROM NEW.section_id)
    EXECUTE FUNCTION private.registrations_release_laptop();

-- More loaners that week: the queue moves up.
CREATE OR REPLACE FUNCTION private.sessions_laptop_cap_raised()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.laptop_loaners > OLD.laptop_loaners THEN
    PERFORM private.laptop_promote(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.sessions_laptop_cap_raised() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sessions_laptop_cap_raised ON sessions;
CREATE TRIGGER sessions_laptop_cap_raised AFTER UPDATE OF laptop_loaners ON sessions
    FOR EACH ROW EXECUTE FUNCTION private.sessions_laptop_cap_raised();

-- ── 8. The crew's roster shows who borrows a laptop ──────────
-- Same as migration_volunteer_roster_access.sql, plus laptop_loan: 'reserved' or 'handed_out'
-- for a camper borrowing one that week, else NULL. Dropped first: the columns change.

DROP FUNCTION IF EXISTS public.section_roster(UUID);
CREATE FUNCTION public.section_roster(p_section_id UUID)
RETURNS TABLE (
    id                         UUID,
    full_name                  TEXT,
    age                        INT,
    allergies                  TEXT,
    medical_conditions         TEXT,
    medical_info               TEXT,
    emergency_contact_name     TEXT,
    emergency_contact_phone    TEXT,
    emergency_contact_relation TEXT,
    parent_name                TEXT,
    parent_phone               TEXT,
    laptop_loan                TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  -- coalesce: a NULL role or helper result must fail the check, not skip it.
  IF auth.uid() IS NULL
     OR NOT (coalesce(private.auth_user_role() = 'admin', false)
             OR coalesce(private.auth_volunteer_has_section(p_section_id), false)) THEN
    RAISE EXCEPTION 'Only this section''s crew or an admin can see its roster' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT st.id, st.full_name, st.age::int, st.allergies, st.medical_conditions, st.medical_info,
           st.emergency_contact_name, st.emergency_contact_phone, st.emergency_contact_relation,
           st.parent_name, st.parent_phone,
           CASE WHEN l.status IN ('reserved', 'handed_out') THEN l.status END
    FROM registrations r
    JOIN students st ON st.id = r.student_id
    LEFT JOIN laptop_loans l ON l.registration_id = r.id
    WHERE r.section_id = p_section_id
      AND r.status IN ('confirmed', 'pending')
    ORDER BY st.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.section_roster(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.section_roster(UUID) TO authenticated;
