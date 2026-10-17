-- Migration (part 2 of 2): waitlist offers with a claim window (spec 10, #79)
-- Apply AFTER migration_waitlist_offers_enum.sql (adds the 'offered' status), and after
-- migration_season_settings.sql, migration_soft_cancel.sql, migration_audit_log.sql and
-- migration_notifications.sql. Safe to re-run.
--
-- Decided 2026-10-16:
--   * a freed seat is OFFERED to the next camper, who has 48 hours to claim it — 12 hours when the
--     session starts within 7 days (season_settings, spec 13);
--   * order: campers displaced by a cancelled section that week first, then by waitlist join time;
--     campers who already hold a seat (or an offer) that week are skipped;
--   * decline or expiry passes the seat to the next camper; admins can still place anyone;
--   * accepting confirms at once and withdraws the camper's other waitlist places that week
--     (any new seat does, however it was got).
-- An offer holds its seat (it counts toward capacity) until it's accepted, declined or expires.

ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS offered_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS offer_expires_at  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS registrations_offer_expiry_idx ON registrations (offer_expires_at) WHERE status = 'offered';

-- ── 1. How long an offer for this section lasts ───────────────
CREATE OR REPLACE FUNCTION private.offer_expiry(p_section_id UUID)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT now() + make_interval(hours =>
    CASE WHEN coalesce(se.start_date, (SELECT min(s2.start_date) FROM sessions s2 WHERE s2.year = coalesce(se.year, (SELECT max(year) FROM sessions WHERE is_active))))
              <= (now() AT TIME ZONE 'America/Denver')::date + 7
         THEN (private.season_settings_for(coalesce(se.year, (SELECT max(year) FROM sessions WHERE is_active))::int)).offer_hours_final_week
         ELSE (private.season_settings_for(coalesce(se.year, (SELECT max(year) FROM sessions WHERE is_active))::int)).offer_hours END)
  FROM sections s LEFT JOIN sessions se ON se.id = s.session_id
  WHERE s.id = p_section_id;
$$;
REVOKE ALL ON FUNCTION private.offer_expiry(UUID) FROM PUBLIC, anon, authenticated;

-- Any move into 'offered' (including an admin's manual offer) gets its window; leaving it clears it.
CREATE OR REPLACE FUNCTION private.registrations_offer_stamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.status = 'offered' AND OLD.status IS DISTINCT FROM 'offered' THEN
    NEW.offered_at := now();
    NEW.offer_expires_at := coalesce(NEW.offer_expires_at, private.offer_expiry(NEW.section_id));
  ELSIF NEW.status IS DISTINCT FROM 'offered' AND OLD.status = 'offered' THEN
    NEW.offer_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.registrations_offer_stamp() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS registrations_offer_stamp ON registrations;
CREATE TRIGGER registrations_offer_stamp BEFORE UPDATE OF status ON registrations
    FOR EACH ROW EXECUTE FUNCTION private.registrations_offer_stamp();

-- ── 2. Offer free seats in a section to the next campers ──────
CREATE OR REPLACE FUNCTION private.offer_next_seat(p_section_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  sec    sections%ROWTYPE;
  taken  INT;
  cand   UUID;
  made   INT := 0;
  prior  TEXT := current_setting('app.reason', true);
BEGIN
  SELECT * INTO sec FROM sections WHERE id = p_section_id FOR UPDATE;
  IF NOT FOUND OR sec.cancelled_at IS NOT NULL THEN RETURN 0; END IF;
  SELECT count(*) INTO taken FROM registrations
   WHERE section_id = sec.id AND status IN ('confirmed', 'pending', 'offered');

  WHILE taken < sec.capacity LOOP
    SELECT w.id INTO cand
      FROM registrations w
     WHERE w.section_id = sec.id AND w.status = 'waitlisted'
       -- Skip campers who already hold a seat or an offer that week.
       AND NOT EXISTS (
         SELECT 1 FROM registrations h JOIN sections hs ON hs.id = h.section_id
          WHERE h.student_id = w.student_id AND h.id <> w.id AND h.year = w.year
            AND h.status IN ('confirmed', 'pending', 'offered')
            AND (hs.week IS NULL OR sec.week IS NULL OR hs.week = sec.week))
     ORDER BY
       -- Campers whose class the camp cancelled that week go first.
       EXISTS (SELECT 1 FROM registrations d JOIN sections ds ON ds.id = d.displaced_from_section
                WHERE d.student_id = w.student_id AND d.cancel_reason = 'section_cancelled' AND d.year = w.year
                  AND (ds.week IS NULL OR sec.week IS NULL OR ds.week = sec.week)) DESC,
       w.created_at, w.id
     LIMIT 1
     FOR UPDATE OF w SKIP LOCKED;
    EXIT WHEN cand IS NULL;
    PERFORM private.set_reason('waitlist_offer');
    UPDATE registrations SET status = 'offered' WHERE id = cand;
    taken := taken + 1;
    made := made + 1;
  END LOOP;
  PERFORM set_config('app.reason', coalesce(prior, ''), true);
  RETURN made;
END;
$$;
REVOKE ALL ON FUNCTION private.offer_next_seat(UUID) FROM PUBLIC, anon, authenticated;

-- ── 3. When a seat frees up (or a section grows), offer it ────
CREATE OR REPLACE FUNCTION private.registrations_offer_freed_seat()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF OLD.status IN ('confirmed', 'pending', 'offered')
     AND (TG_OP = 'DELETE' OR NEW.status NOT IN ('confirmed', 'pending', 'offered') OR NEW.section_id IS DISTINCT FROM OLD.section_id) THEN
    PERFORM private.offer_next_seat(OLD.section_id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.registrations_offer_freed_seat() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS registrations_offer_freed_seat ON registrations;
CREATE TRIGGER registrations_offer_freed_seat AFTER UPDATE OF status, section_id OR DELETE ON registrations
    FOR EACH ROW EXECUTE FUNCTION private.registrations_offer_freed_seat();

CREATE OR REPLACE FUNCTION private.sections_offer_added_capacity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.capacity > OLD.capacity OR (OLD.cancelled_at IS NOT NULL AND NEW.cancelled_at IS NULL) THEN
    PERFORM private.offer_next_seat(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.sections_offer_added_capacity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sections_offer_added_capacity ON sections;
CREATE TRIGGER sections_offer_added_capacity AFTER UPDATE OF capacity, cancelled_at ON sections
    FOR EACH ROW EXECUTE FUNCTION private.sections_offer_added_capacity();

-- ── 4. A camper who gets a seat leaves that week's other waitlists ─
CREATE OR REPLACE FUNCTION private.registrations_withdraw_same_week()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  wk    SMALLINT := (SELECT week FROM sections WHERE id = NEW.section_id);
  prior TEXT := current_setting('app.reason', true);
BEGIN
  IF NEW.status NOT IN ('confirmed', 'pending')
     OR (TG_OP = 'UPDATE' AND OLD.status IN ('confirmed', 'pending') AND OLD.section_id = NEW.section_id) THEN
    RETURN NULL;
  END IF;
  PERFORM private.set_reason('took_other_seat');
  UPDATE registrations r SET status = 'cancelled', cancel_reason = 'took_other_seat'
    FROM sections s
   WHERE s.id = r.section_id AND r.student_id = NEW.student_id AND r.id <> NEW.id AND r.year = NEW.year
     AND r.status IN ('waitlisted', 'offered')
     AND (s.week IS NULL OR wk IS NULL OR s.week = wk);
  PERFORM set_config('app.reason', coalesce(prior, ''), true);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.registrations_withdraw_same_week() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS registrations_withdraw_same_week ON registrations;
CREATE TRIGGER registrations_withdraw_same_week AFTER INSERT OR UPDATE OF status, section_id ON registrations
    FOR EACH ROW EXECUTE FUNCTION private.registrations_withdraw_same_week();

-- ── 5. Parents accept or decline ──────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_offer(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg registrations%ROWTYPE;
BEGIN
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND st.parent_id = auth.uid() FOR UPDATE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'That offer isn''t on your account' USING ERRCODE = '42501'; END IF;
  IF reg.status <> 'offered' THEN RAISE EXCEPTION 'That spot isn''t on offer any more' USING ERRCODE = 'P0001'; END IF;
  IF reg.offer_expires_at <= now() THEN
    RAISE EXCEPTION 'Sorry, this offer has expired. You can join the waitlist again from the class list.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.set_reason('offer_accepted');
  UPDATE registrations SET status = 'confirmed' WHERE id = reg.id;   -- withdraws same-week waitlists (section 4)
  PERFORM private.set_reason(NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_offer(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg registrations%ROWTYPE;
BEGIN
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND st.parent_id = auth.uid() FOR UPDATE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION 'That offer isn''t on your account' USING ERRCODE = '42501'; END IF;
  IF reg.status <> 'offered' THEN RAISE EXCEPTION 'That spot isn''t on offer any more' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.set_reason('declined_offer');
  UPDATE registrations SET status = 'cancelled', cancel_reason = 'declined_offer' WHERE id = reg.id;   -- offers it onward
  PERFORM private.set_reason(NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.decline_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_offer(UUID) TO authenticated;

-- ── 6. Expiry sweep and reminder (pg_cron, every 10 minutes) ──
CREATE OR REPLACE FUNCTION private.sweep_offers()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  r RECORD;
BEGIN
  -- Reminder once, 6 hours before an offer ends.
  FOR r IN SELECT reg.id, st.parent_id, coalesce(nullif(st.first_name, ''), split_part(st.full_name, ' ', 1)) AS camper,
                  c.name AS class, s.label AS section, s.week, reg.offer_expires_at, st.id AS student_id
             FROM registrations reg JOIN students st ON st.id = reg.student_id
             JOIN sections s ON s.id = reg.section_id JOIN classes c ON c.id = s.class_id
            WHERE reg.status = 'offered' AND reg.offer_expires_at > now()
              AND reg.offer_expires_at <= now() + interval '6 hours' LOOP
    PERFORM private.enqueue_notification(r.parent_id, 'offer_expiring',
      jsonb_build_object('camper', r.camper, 'class', r.class, 'section', r.section, 'week', r.week,
                         'offer_expires_at', r.offer_expires_at, 'student_id', r.student_id),
      'offer_expiring:' || r.id || ':' || r.offer_expires_at);
  END LOOP;

  -- Expired offers end, and the seat goes to the next camper.
  PERFORM private.set_reason('offer_expired');
  UPDATE registrations SET status = 'cancelled', cancel_reason = 'offer_expired'
   WHERE status = 'offered' AND offer_expires_at <= now();
  PERFORM private.set_reason(NULL);
END;
$$;
REVOKE ALL ON FUNCTION private.sweep_offers() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('sweep-waitlist-offers') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-waitlist-offers');
  PERFORM cron.schedule('sweep-waitlist-offers', '*/10 * * * *', $cron$SELECT private.sweep_offers()$cron$);
END $$;

-- ── 7. Seats already free with campers waiting: offer them now ─
DO $$
DECLARE
  sid UUID;
BEGIN
  FOR sid IN SELECT DISTINCT section_id FROM registrations WHERE status = 'waitlisted' LOOP
    PERFORM private.offer_next_seat(sid);
  END LOOP;
END $$;
