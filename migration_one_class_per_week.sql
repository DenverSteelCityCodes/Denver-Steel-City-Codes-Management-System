-- One held spot per camper per camp week.
--
-- Camp runs one class per camper per week (the registration wizard already offers a single
-- class choice per week), but the class browser let a parent hold seats in two classes that
-- run at the same time. The rule is enforced here so it can't be bypassed from the client:
--   * a camper who already holds a spot (pending/confirmed) in a week can't take a second
--     open seat that same week;
--   * joining the WAITLIST of a full class as a backup is still allowed;
--   * admins keep their override (they return early, as before).
--
-- Apply after migration_security_hardening.sql.

CREATE OR REPLACE FUNCTION public.registrations_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  sec     sections%ROWTYPE;
  stu_age SMALLINT;
  taken   INT;
  clash   TEXT;
BEGIN
  -- Row lock serializes concurrent sign-ups for the same section so capacity can't be overrun.
  SELECT * INTO sec FROM sections WHERE id = NEW.section_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That section no longer exists' USING ERRCODE = 'P0001';
  END IF;

  NEW.year := COALESCE(
    (SELECT year FROM sessions WHERE id = sec.session_id),
    (SELECT MAX(year) FROM sessions WHERE is_active),
    NEW.year
  );

  -- Admins (and trusted server contexts) may place anyone anywhere with any status.
  IF auth.uid() IS NULL OR auth_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT age INTO stu_age FROM students WHERE id = NEW.student_id;
  IF stu_age IS NULL OR stu_age < sec.age_min OR stu_age > sec.age_max THEN
    RAISE EXCEPTION 'This section is for ages %–%', sec.age_min, sec.age_max USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO taken FROM registrations
  WHERE section_id = sec.id AND status IN ('confirmed', 'pending');

  NEW.status := CASE WHEN taken >= sec.capacity THEN 'waitlisted'::registration_status
                     ELSE 'pending'::registration_status END;

  -- Same-week clash: only when this insert would HOLD a seat (waitlisting as a backup is fine).
  IF NEW.status = 'pending' THEN
    SELECT c.name INTO clash
    FROM registrations r
    JOIN sections s ON s.id = r.section_id
    JOIN classes  c ON c.id = s.class_id
    WHERE r.student_id = NEW.student_id
      AND r.section_id <> sec.id
      AND r.status IN ('confirmed', 'pending')
      AND r.year = NEW.year
      AND ((sec.session_id IS NOT NULL AND s.session_id = sec.session_id)
        OR (sec.session_id IS NULL AND s.week IS NOT DISTINCT FROM sec.week))
    LIMIT 1;
    IF clash IS NOT NULL THEN
      RAISE EXCEPTION 'This camper already has a spot in % that week', clash USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrations_before_insert() FROM PUBLIC, anon, authenticated;
